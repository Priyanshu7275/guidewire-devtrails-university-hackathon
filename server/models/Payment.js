/*
 * models/Payment.js
 * -----------------------------------------------------------------------
 * Mongoose schema and model for UPI / Razorpay payment transactions.
 *
 * Two distinct payment flows are recorded here:
 *
 *   1. PREMIUM PAYMENT  -- worker pays premium to activate a policy.
 *      paymentType = 'premium'
 *      referenceId = policy ObjectId
 *
 *   2. CLAIM PAYOUT     -- GigInsure pays the worker after a claim
 *      is approved.
 *      paymentType = 'payout'
 *      referenceId = claim ObjectId
 *
 * In production the Razorpay SDK would be used to create orders and
 * verify HMAC signatures. In this implementation we mock that flow
 * (generate a fake order ID and accept any payment ID) but the data
 * model mirrors what a real Razorpay integration stores.
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // The worker this transaction belongs to.
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Worker',
      required: [true, 'workerId is required'],
      index: true,
    },

    // The related document ID. For premiums this is a Policy ObjectId;
    // for payouts this is a Claim ObjectId.
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Distinguishes between money flowing IN (premium) vs OUT (payout).
    paymentType: {
      type: String,
      required: true,
      enum: ['premium', 'payout'],
    },

    // Amount in Indian Rupees (whole number, no paise sub-units).
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: 0,
    },

    // Worker's UPI handle (e.g. "ravi@upi"). Collected at checkout.
    upiId: {
      type: String,
      trim: true,
      default: null,
    },

    // Razorpay transaction ID returned after a successful payment.
    // In mock mode we generate a fake ID prefixed with 'mock_'.
    transactionId: {
      type: String,
      default: null,
    },

    // Razorpay order ID created before presenting the payment modal.
    orderId: {
      type: String,
      default: null,
    },

    // Final state of the transaction.
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },

    // Payment gateway used. 'razorpay' for real payments, 'mock' in dev.
    gateway: {
      type: String,
      enum: ['razorpay', 'mock'],
      default: 'mock',
    },

    // When the payment was confirmed by the gateway. Null if pending.
    settledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index used by GET /api/payments/history/:workerId.
paymentSchema.index({ workerId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
