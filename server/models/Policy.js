/*
 * models/Policy.js
 * -----------------------------------------------------------------------
 * Mongoose schema and model for an insurance policy.
 *
 * A policy represents a single coverage contract between GigInsure and
 * one worker. When a worker pays a premium they get a policy document
 * with a start date, an end date, and a coverage cap.
 *
 * Business rules encoded in this schema:
 *   - A policy belongs to exactly one worker (workerId ref).
 *   - A policy has a plan tier (basic / standard / premium) that
 *     determines the coverage cap and maximum claimable hours.
 *   - Status can be 'active', 'expired', or 'cancelled'.
 *   - One worker may have many historical policies but at most one
 *     whose status is 'active'. That invariant is enforced in the
 *     route handler (policy.js), not in the schema.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    // Foreign key linking this policy to a Worker document.
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: [true, 'workerId is required'],
      index: true,   // speeds up queries like "get all policies for worker X"
    },

    // Insurance plan tier chosen by the worker at purchase time.
    plan: {
      type: String,
      required: [true, 'Plan is required'],
      enum: {
        values: ['basic', 'standard', 'premium'],
        message: 'Plan must be basic, standard, or premium',
      },
    },

    // The weekly premium amount the worker actually paid (in Rs.).
    // Stored so we can calculate loss ratio in the admin dashboard.
    premiumPaid: {
      type: Number,
      required: [true, 'premiumPaid is required'],
      min: 0,
    },

    // Maximum total payout allowed under this policy (in Rs.).
    // Derived from the plan tier at the time of purchase.
    // basic=500, standard=900, premium=1400
    coverageCap: {
      type: Number,
      required: true,
      min: 0,
    },

    // Maximum number of hours that can be claimed in total across all
    // claims under this policy. Mirrors the plan tier limits.
    // basic=10, standard=18, premium=28
    maxHours: {
      type: Number,
      required: true,
      min: 0,
    },

    // Calendar date when coverage begins (usually the day of purchase).
    startDate: {
      type: Date,
      required: true,
    },

    // Calendar date when coverage ends (startDate + tenure days).
    endDate: {
      type: Date,
      required: true,
    },

    // Current lifecycle state of the policy.
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: quickly find a worker's active policy.
policySchema.index({ workerId: 1, status: 1 });

module.exports = mongoose.model('Policy', policySchema);
