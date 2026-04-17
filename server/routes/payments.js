/*
 * routes/payments.js
 * -----------------------------------------------------------------------
 * UPI / Razorpay payment routes.
 *
 * Endpoints:
 *   POST /api/payments/create-order    -- Create a Razorpay payment order.
 *   POST /api/payments/verify          -- Verify payment and activate policy.
 *   GET  /api/payments/history/:workerId -- Full payment history.
 *
 * RAZORPAY MOCK FLOW:
 *   In the real integration you would:
 *     1. Call Razorpay Orders API to create an order (returns order_id).
 *     2. Pass order_id + key_id to the frontend Razorpay checkout widget.
 *     3. The widget calls Razorpay, which calls your webhook or the
 *        /verify endpoint with a payment_id and signature.
 *     4. You verify the HMAC-SHA256 signature server-side.
 *
 *   Since we do not import the Razorpay SDK (would require real credentials),
 *   we generate a mock order_id, accept any payment_id in /verify, and
 *   compute the HMAC ourselves using the RAZORPAY_KEY_SECRET from .env.
 *   The frontend receives a `sandbox: true` flag so it knows to skip
 *   the real Razorpay checkout widget.
 *
 * IMPORTANT:
 *   In production, remove the mock paths and use the official
 *   razorpay npm package. The data model (Payment schema) is already
 *   production-ready.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/keys');

// -----------------------------------------------------------------------
// POST /api/payments/create-order
// -----------------------------------------------------------------------

/**
 * Create a mock Razorpay order for a premium payment.
 * Requires: Authorization: Bearer <token>
 * Body: { worker_id, plan, amount }
 */
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { worker_id, plan, amount } = req.body;

    if (!worker_id || !plan || amount == null) {
      return res.status(400).json({
        success: false,
        error: 'worker_id, plan, and amount are required.',
      });
    }

    const worker = await Worker.findById(worker_id);
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found.' });
    }

    // Generate a mock Razorpay order ID.
    // Real format: "order_" followed by 14 alphanumeric characters.
    const orderId = `order_mock_${uuidv4().replace(/-/g, '').slice(0, 14)}`;

    // Build a UPI deep-link. In production this would come from Razorpay.
    // The upi:// scheme launches UPI apps on Android.
    const upiLink = `upi://pay?pa=giginsure@upi&pn=GigInsure&am=${amount}&cu=INR&tn=Premium_${plan}`;

    // Store the pending payment record.
    await Payment.create({
      workerId: worker._id,
      paymentType: 'premium',
      amount: parseFloat(amount),
      orderId,
      status: 'pending',
      gateway: 'mock',
    });

    return res.status(200).json({
      order_id: orderId,
      amount_inr: parseFloat(amount),
      upi_link: upiLink,
      key_id: RAZORPAY_KEY_ID,
      sandbox: true,
    });
  } catch (err) {
    console.error('[payments/create-order]', err);
    return res.status(500).json({ success: false, error: 'Failed to create payment order.' });
  }
});

// -----------------------------------------------------------------------
// POST /api/payments/verify
// -----------------------------------------------------------------------

/**
 * Verify a completed payment and mark the policy as paid.
 * In real Razorpay integration we verify the HMAC-SHA256 signature.
 * In mock mode we accept any payment_id and generate a transaction_id.
 * Requires: Authorization: Bearer <token>
 * Body: { worker_id, policy_id, order_id, payment_id, signature, amount, upi_id }
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { worker_id, policy_id, order_id, payment_id, signature, amount, upi_id } = req.body;

    if (!worker_id || !order_id) {
      return res.status(400).json({
        success: false,
        error: 'worker_id and order_id are required.',
      });
    }

    // In a real Razorpay flow we verify:
    //   HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET) === signature
    // For mock, we skip real verification but still show the calculation.
    let signatureValid = true;
    if (payment_id && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${order_id}|${payment_id}`)
        .digest('hex');
      signatureValid = expectedSignature === signature;
      // In mock / sandbox mode we allow mismatched signatures.
      // Remove this override in production!
      signatureValid = true;
    }

    if (!signatureValid) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
    }

    // Generate a mock transaction ID.
    const transactionId = `mock_txn_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Find and update the pending payment record for this order.
    const paymentRecord = await Payment.findOne({ orderId: order_id, workerId: worker_id });
    if (paymentRecord) {
      paymentRecord.transactionId = transactionId;
      paymentRecord.paymentId = payment_id || `mock_pay_${uuidv4().slice(0, 8)}`;
      paymentRecord.upiId = upi_id || null;
      paymentRecord.status = 'completed';
      paymentRecord.settledAt = new Date();
      if (policy_id) paymentRecord.referenceId = policy_id;
      await paymentRecord.save();
    }

    return res.status(200).json({
      success: true,
      transaction_id: transactionId,
      amount_inr: parseFloat(amount) || (paymentRecord ? paymentRecord.amount : 0),
      status: 'completed',
    });
  } catch (err) {
    console.error('[payments/verify]', err);
    return res.status(500).json({ success: false, error: 'Payment verification failed.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/payments/history/:workerId
// -----------------------------------------------------------------------

/**
 * Full payment history for a worker (both premiums paid and payouts received).
 * Requires: Authorization: Bearer <token>
 */
router.get('/history/:workerId', authMiddleware, async (req, res) => {
  try {
    const { workerId } = req.params;

    const payments = await Payment.find({ workerId })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate totals.
    const totalPremium = payments
      .filter((p) => p.paymentType === 'premium' && p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPayouts = payments
      .filter((p) => p.paymentType === 'payout' && p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    // net_benefit is what the worker gained: payouts - premiums paid.
    const netBenefit = totalPayouts - totalPremium;

    const history = payments.map((p) => ({
      payment_id: p._id.toString(),
      payment_type: p.paymentType,
      amount: p.amount,
      status: p.status,
      order_id: p.orderId,
      transaction_id: p.transactionId,
      upi_id: p.upiId,
      created_at: p.createdAt,
      settled_at: p.settledAt,
    }));

    return res.status(200).json({
      total_premium: totalPremium,
      total_payouts: totalPayouts,
      net_benefit: netBenefit,
      history,
    });
  } catch (err) {
    console.error('[payments/history/:workerId]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch payment history.' });
  }
});

module.exports = router;
