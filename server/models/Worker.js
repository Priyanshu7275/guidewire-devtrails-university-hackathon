/*
 * models/Worker.js
 * -----------------------------------------------------------------------
 * Mongoose schema and model for a GigInsure worker (the end user).
 *
 * A "schema" defines the shape of a document stored in a MongoDB
 * collection. Think of it as the blueprint -- it lists every field,
 * its data type, and any validation rules.
 *
 * A "model" is a class that Mongoose generates from a schema. We use
 * the model to create, read, update, and delete documents in the
 * "workers" collection.
 *
 * Each worker represents one gig economy driver / delivery agent who
 * has registered with GigInsure. Workers can hold one active policy at
 * a time and file claims against that policy.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

// -------------------------------------------------------------------
// Schema definition
// -------------------------------------------------------------------
const workerSchema = new mongoose.Schema(
  {
    // Full name of the worker (e.g. "Ravi Kumar").
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    // 10-digit Indian mobile number. Used as username for login.
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      unique: true,            // no two workers can share a phone number
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'],
    },

    // Bcrypt hash of the worker's password. We never store plain-text
    // passwords -- that would be a serious security vulnerability.
    passwordHash: {
      type: String,
      required: true,
    },

    // The delivery platform the worker is registered with.
    platform: {
      type: String,
      required: [true, 'Platform is required'],
      lowercase: true,
    },

    // 6-digit Indian postal code of the worker's primary delivery zone.
    pincode: {
      type: Number,
      required: [true, 'Pincode is required'],
    },

    // City name derived from the pincode (e.g. "Noida", "Delhi").
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },

    // Vehicle type used for deliveries.
    vehicle: {
      type: String,
      default: 'motorcycle',
    },

    // Worker's self-reported average daily income in Indian Rupees.
    // This is used by the premium calculator to set coverage caps.
    dailyIncome: {
      type: Number,
      required: [true, 'Daily income is required'],
      min: [100, 'Daily income must be at least Rs.100'],
      max: [5000, 'Daily income cannot exceed Rs.5000'],
    },

    // Risk score for the worker's pincode zone, calculated by the
    // premium service using a lookup table that mirrors XGBoost output.
    // Range: 0-100. Higher = riskier zone (more disruptions expected).
    zoneRiskScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },

    // Number of days the worker has been registered on GigInsure.
    // Longer tenure = small discount on premiums.
    tenureDays: {
      type: Number,
      default: 0,
    },

    // Reference to the worker's currently active Policy document.
    // Null if the worker has no active policy.
    activePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Policy',
      default: null,
    },

    // Device fingerprint captured at first login/registration.
    // Used by fraudService to detect DEVICE_MISMATCH (different device filing claims).
    deviceInfo: {
      deviceId:  { type: String, default: null },
      platform:  { type: String, default: null },   // 'android' | 'ios' | 'web'
      userAgent: { type: String, default: null },
    },
  },
  {
    // Mongoose automatically adds `createdAt` and `updatedAt` fields
    // when timestamps: true is set.
    timestamps: true,
  }
);

// -------------------------------------------------------------------
// Indexes
// -------------------------------------------------------------------
// The phone field already has unique: true, which creates an index.
// We add an additional index on pincode because the scheduler and
// analytics routes frequently query workers by pincode.
workerSchema.index({ pincode: 1 });

// -------------------------------------------------------------------
// Export model
// -------------------------------------------------------------------
// The first argument 'Worker' becomes the collection name 'workers'
// in MongoDB (Mongoose lowercases and pluralises it automatically).
module.exports = mongoose.model('Worker', workerSchema);
