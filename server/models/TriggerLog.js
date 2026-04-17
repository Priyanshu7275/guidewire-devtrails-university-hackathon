/*
 * models/TriggerLog.js
 * -----------------------------------------------------------------------
 * Mongoose schema and model for trigger event logs.
 *
 * Every time the node-cron scheduler detects a qualifying disruption
 * event (or a worker manually checks via GET /api/triggers/check/:pincode)
 * a TriggerLog document is written to MongoDB.
 *
 * Two purposes:
 *   1. FRAUD DETECTION -- the fraud service looks up whether a matching
 *      TriggerLog exists for the pincode and trigger type within the
 *      last hour. If it does NOT exist (trigger_verified = false), the
 *      fraud score jumps by +0.50 (CRITICAL signal). This prevents
 *      workers from fabricating disruptions.
 *
 *   2. DEDUPLICATION -- the scheduler checks this collection before
 *      writing a new log so it does not flood the DB with duplicate
 *      entries every 5 minutes. It skips writing if the same trigger
 *      was already logged for the same pincode within the last 30 min.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const triggerLogSchema = new mongoose.Schema(
  {
    // The postal code zone where the disruption was detected.
    pincode: {
      type: String,
      required: [true, 'pincode is required'],
      match: [/^\d{6}$/, 'pincode must be a 6-digit number'],
      index: true,
    },

    // Category of the trigger event.
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

    // The actual measured value that crossed the threshold.
    // E.g. rain_mm = 18.2 when threshold is 15 mm/hr.
    value: {
      type: Number,
      required: true,
    },

    // The threshold value that defines when a trigger fires.
    // Stored so the fraud service can show workers the exact reasoning.
    threshold: {
      type: Number,
      required: true,
    },

    // Whether the trigger actually fired (value exceeded threshold).
    // We log non-firing checks too so the zone-summary route can show
    // "no triggers active" for a given pincode.
    fired: {
      type: Boolean,
      default: false,
    },

    // Where the data came from: 'openweathermap', 'newsapi', or 'mock'.
    source: {
      type: String,
      enum: ['openweathermap', 'newsapi', 'mock', 'manual', 'demo'],
      default: 'openweathermap',
    },

    // When the trigger was detected. Used for deduplication and fraud
    // verification time windows.
    detectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index used by both the scheduler (deduplication) and the
// fraud service (verify that a trigger existed for pincode+type).
triggerLogSchema.index({ pincode: 1, triggerType: 1, detectedAt: -1 });

module.exports = mongoose.model('TriggerLog', triggerLogSchema);
