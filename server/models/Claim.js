/*
 * models/Claim.js
 * -----------------------------------------------------------------------
 * Mongoose schema and model for an insurance claim.
 *
 * A claim is filed by a worker when they believe a trigger event
 * (heavy rain, extreme heat, dangerous AQI, curfew, platform outage)
 * caused them to lose income. Each claim goes through fraud analysis
 * and receives one of four decisions:
 *
 *   AUTO_APPROVE   - fraud score <= 0.35. Payout is sent immediately.
 *   SOFT_HOLD      - fraud score 0.35-0.65. System waits for more data.
 *   MANUAL_REVIEW  - fraud score 0.65-0.85. A human admin reviews it.
 *   AUTO_REJECT    - fraud score > 0.85. Claim is denied.
 *
 * Claims reference both the worker (workerId) and the policy
 * (policyId) so we can look up claims from either direction.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    // The policy under which this claim is filed.
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Policy',
      required: [true, 'policyId is required'],
    },

    // The worker who filed this claim. Denormalised here so we can
    // query "all claims by worker X" without joining through Policy.
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: [true, 'workerId is required'],
      index: true,
    },

    // The category of disruption event that caused the income loss.
    triggerType: {
      type: String,
      required: [true, 'triggerType is required'],
      enum: [
        'heavy_rain',
        'extreme_heat',
        'dangerous_aqi',
        'curfew',
        'platform_outage',
        'flood',
        'cyclone',
      ],
    },

    // Numeric reading for the trigger at claim time.
    // E.g. 22.5 (mm/hr of rain), 45 (degrees C), 310 (AQI index).
    triggerValue: {
      type: Number,
      required: true,
    },

    // Fraud score produced by fraudService.js. Range 0.0 to 1.0.
    // Lower is cleaner; higher means more suspicious signals.
    fraudScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },

    // The decision string returned by fraudService.js.
    decision: {
      type: String,
      enum: ['AUTO_APPROVE', 'SOFT_HOLD', 'MANUAL_REVIEW', 'AUTO_REJECT', 'ADMIN_APPROVED', 'ADMIN_DECLINED'],
      default: 'SOFT_HOLD',
    },

    // Rupee amount approved for payout. 0 if rejected or pending.
    payoutAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Lifecycle state used by the payment pipeline.
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'under_review'],
      default: 'pending',
    },

    // Worker's GPS latitude at claim submission time.
    gpsLat: {
      type: Number,
      default: null,
    },

    // Worker's GPS longitude at claim submission time.
    gpsLng: {
      type: Number,
      default: null,
    },

    // Whether the GPS coordinates matched the registered pincode zone.
    // false = potential GPS spoofing, which raises the fraud score.
    gpsVerified: {
      type: Boolean,
      default: true,
    },

    // Session duration in minutes submitted by the worker's app.
    // Very short sessions (< 2 min) are a bot-speed fraud signal.
    sessionMinutes: {
      type: Number,
      default: null,
    },

    // Optional flag sent from the device (e.g. rooted phone detection).
    deviceFlag: {
      type: Boolean,
      default: false,
    },

    // Device fingerprint at claim submission — used for DEVICE_MISMATCH detection.
    deviceInfo: {
      deviceId:  { type: String, default: null },
      userAgent: { type: String, default: null },
    },

    // IP address of the request — used for IP_GPS_MISMATCH detection.
    ipAddress: {
      type: String,
      default: null,
    },

    // Timestamp when the worker submitted the claim.
    initiatedAt: {
      type: Date,
      default: Date.now,
    },

    // Timestamp when the claim was resolved (approved or rejected).
    // Null means it is still in flight.
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index used by the fraud service to count recent claims.
claimSchema.index({ workerId: 1, initiatedAt: -1 });

// Index used by admin dashboard to fetch all pending/review claims.
claimSchema.index({ decision: 1, status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
