/*
 * routes/claims.js
 * -----------------------------------------------------------------------
 * Insurance claim routes.
 *
 * Endpoints:
 *   POST /api/claims/initiate         -- File a new claim.
 *   GET  /api/claims/history/:workerId -- All claims for a worker.
 *   GET  /api/claims/status/:claimId   -- Single claim status.
 *
 * CLAIM LIFECYCLE:
 *   1. Worker submits a claim with their GPS coords, session duration,
 *      and the trigger type they experienced.
 *   2. fraudService.scoreFraud() runs all heuristic checks.
 *   3. Based on the fraud score the claim is AUTO_APPROVE, SOFT_HOLD,
 *      MANUAL_REVIEW, or AUTO_REJECT.
 *   4. If AUTO_APPROVE, a Payment document is created for the payout
 *      and the claim status is set to 'paid'.
 *   5. The payout amount is: min(coverageCap, hourlyRate * session_hours)
 *      where hourlyRate is the worker's dailyIncome / 8 (assuming 8-hr day).
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');
const { scoreFraud } = require('../services/fraudService');

// -----------------------------------------------------------------------
// Helper: calculate payout amount
// -----------------------------------------------------------------------

/**
 * calculatePayout
 * Determines how much to pay out for an approved claim.
 *
 * Formula: hourlyRate * sessionHours, capped at the policy's coverageCap.
 *   hourlyRate  = dailyIncome / 8  (assuming 8-hour working day)
 *   sessionHours = sessionMinutes / 60
 *
 * @param {number} dailyIncome    - Worker's daily income in Rs.
 * @param {number} sessionMinutes - Duration of the disrupted session in min.
 * @param {number} coverageCap    - Maximum payout allowed by the policy (Rs.).
 * @returns {number} Payout in Rs., rounded to nearest rupee.
 */
function calculatePayout(dailyIncome, sessionMinutes, coverageCap) {
  const hourlyRate = dailyIncome / 8;
  const sessionHours = (sessionMinutes || 30) / 60; // default 30 min if null
  const raw = hourlyRate * sessionHours;
  return Math.min(Math.round(raw), coverageCap);
}

// -----------------------------------------------------------------------
// POST /api/claims/initiate
// -----------------------------------------------------------------------

/**
 * File a new insurance claim.
 * Requires: Authorization: Bearer <token>
 * Body: {
 *   worker_id, policy_id, trigger_type, trigger_value,
 *   session_minutes, device_flag?,
 *   gps: { lat, lng }
 * }
 */
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const {
      worker_id,
      policy_id,
      trigger_type,
      trigger_value,
      session_minutes,
      device_flag,
      gps,
      device_id,
    } = req.body;

    // Capture client IP for IP_GPS_MISMATCH fraud signal
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || null;

    // Validate required fields.
    if (!worker_id || !policy_id || !trigger_type || trigger_value == null) {
      return res.status(400).json({
        success: false,
        error: 'worker_id, policy_id, trigger_type, and trigger_value are required.',
      });
    }

    const validTriggers = [
      'heavy_rain', 'extreme_heat', 'dangerous_aqi',
      'curfew', 'platform_outage', 'flood', 'cyclone',
    ];
    if (!validTriggers.includes(trigger_type)) {
      return res.status(400).json({
        success: false,
        error: `trigger_type must be one of: ${validTriggers.join(', ')}`,
      });
    }

    // Fetch worker and policy.
    const worker = await Worker.findById(worker_id);
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found.' });
    }

    const policy = await Policy.findById(policy_id);
    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found.' });
    }

    // Verify the policy belongs to this worker and is still active.
    if (policy.workerId.toString() !== worker_id) {
      return res.status(403).json({ success: false, error: 'Policy does not belong to this worker.' });
    }
    if (policy.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Policy is ${policy.status}. Only active policies can have claims filed against them.`,
      });
    }

    // Extract GPS coordinates (may be null if not provided).
    const claimLat = gps && gps.lat != null ? parseFloat(gps.lat) : null;
    const claimLon = gps && gps.lng != null ? parseFloat(gps.lng) : null;

    // Run the fraud scoring engine.
    const fraudResult = await scoreFraud({
      workerId:       worker._id,
      pincode:        worker.pincode,
      triggerType:    trigger_type,
      claimLat,
      claimLon,
      sessionMinutes: session_minutes != null ? parseFloat(session_minutes) : null,
      deviceFlag:     device_flag === true,
      deviceId:       device_id || null,
      ipAddress,
    });

    // Determine claim status based on decision.
    const statusMap = {
      AUTO_APPROVE: 'approved',
      SOFT_HOLD: 'pending',
      MANUAL_REVIEW: 'under_review',
      AUTO_REJECT: 'rejected',
    };
    const claimStatus = statusMap[fraudResult.decision] || 'pending';

    // Calculate payout only for approved claims.
    let payoutAmount = 0;
    if (fraudResult.decision === 'AUTO_APPROVE') {
      payoutAmount = calculatePayout(
        worker.dailyIncome,
        session_minutes,
        policy.coverageCap
      );
    }

    // Create the claim document.
    const claim = await Claim.create({
      policyId:      policy._id,
      workerId:      worker._id,
      triggerType:   trigger_type,
      triggerValue:  parseFloat(trigger_value),
      fraudScore:    fraudResult.finalScore,
      decision:      fraudResult.decision,
      payoutAmount,
      status:        claimStatus,
      gpsLat:        claimLat,
      gpsLng:        claimLon,
      gpsVerified:   fraudResult.gpsZoneMatch,
      sessionMinutes: session_minutes != null ? parseFloat(session_minutes) : null,
      deviceFlag:    device_flag === true,
      deviceInfo:    device_id ? { deviceId: device_id } : undefined,
      ipAddress,
      initiatedAt:   new Date(),
      resolvedAt: fraudResult.decision === 'AUTO_APPROVE' || fraudResult.decision === 'AUTO_REJECT'
        ? new Date()
        : null,
    });

    // If auto-approved, also create a payout Payment document.
    if (fraudResult.decision === 'AUTO_APPROVE' && payoutAmount > 0) {
      await Payment.create({
        workerId: worker._id,
        referenceId: claim._id,
        paymentType: 'payout',
        amount: payoutAmount,
        transactionId: `mock_payout_${claim._id}`,
        status: 'completed',
        gateway: 'mock',
        settledAt: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      claimId: claim._id.toString(),
      decision: fraudResult.decision,
      fraudScore: fraudResult.finalScore,
      fraudSignals: fraudResult.signals,
      gpsVerified: fraudResult.gpsZoneMatch,
      payout: payoutAmount,
      status: claimStatus,
      message: fraudResult.message,
      processedAt: new Date(),
    });
  } catch (err) {
    console.error('[claims/initiate]', err);
    return res.status(500).json({ success: false, error: 'Failed to process claim.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/claims/history/:workerId
// -----------------------------------------------------------------------

/**
 * List all claims for a worker, with total amount paid out.
 * Requires: Authorization: Bearer <token>
 */
router.get('/history/:workerId', authMiddleware, async (req, res) => {
  try {
    const { workerId } = req.params;

    const claims = await Claim.find({ workerId })
      .sort({ initiatedAt: -1 })
      .lean();

    const totalPaid = claims.reduce(
      (sum, c) => sum + (c.status === 'paid' || c.status === 'approved' ? c.payoutAmount : 0),
      0
    );

    const formatted = claims.map((c) => ({
      claimId: c._id.toString(),
      policyId: c.policyId.toString(),
      triggerType: c.triggerType,
      triggerValue: c.triggerValue,
      fraudScore: c.fraudScore,
      decision: c.decision,
      payout: c.payoutAmount,
      status: c.status,
      gpsVerified: c.gpsVerified,
      initiatedAt: c.initiatedAt,
      resolvedAt: c.resolvedAt,
    }));

    return res.status(200).json({
      total: formatted.length,
      totalPaid,
      claims: formatted,
    });
  } catch (err) {
    console.error('[claims/history/:workerId]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch claim history.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/claims/status/:claimId
// -----------------------------------------------------------------------

/**
 * Fetch the current status of a single claim.
 * Requires: Authorization: Bearer <token>
 */
router.get('/status/:claimId', authMiddleware, async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findById(claimId).lean();
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }

    return res.status(200).json({
      claimId: claim._id.toString(),
      decision: claim.decision,
      fraudScore: claim.fraudScore,
      payout: claim.payoutAmount,
      status: claim.status,
      trigger: {
        type: claim.triggerType,
        value: claim.triggerValue,
      },
    });
  } catch (err) {
    console.error('[claims/status/:claimId]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch claim status.' });
  }
});

// -----------------------------------------------------------------------
// PATCH /api/claims/:claimId/review
// Admin: approve or decline a SOFT_HOLD / MANUAL_REVIEW claim
// Body: { action: 'approve' | 'decline' }
// -----------------------------------------------------------------------
router.patch('/:claimId/review', async (req, res) => {
  try {
    const { claimId } = req.params;
    const { action } = req.body;

    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be "approve" or "decline".' });
    }

    const claim = await Claim.findById(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found.' });
    }

    const reviewable = ['SOFT_HOLD', 'MANUAL_REVIEW'];
    if (!reviewable.includes(claim.decision)) {
      return res.status(400).json({ success: false, error: 'Only SOFT_HOLD or MANUAL_REVIEW claims can be reviewed.' });
    }

    if (action === 'approve') {
      // Calculate payout using policy + worker data
      const policy = await Policy.findById(claim.policyId);
      const worker = await Worker.findById(claim.workerId);
      const payout = policy && worker
        ? calculatePayout(worker.dailyIncome, claim.sessionMinutes, policy.coverageCap)
        : 0;

      claim.decision      = 'ADMIN_APPROVED';
      claim.status        = 'paid';
      claim.payoutAmount  = payout;
      claim.resolvedAt    = new Date();
      await claim.save();

      if (payout > 0) {
        await Payment.create({
          workerId:      claim.workerId,
          referenceId:   claim._id,
          paymentType:   'payout',
          amount:        payout,
          transactionId: `admin_payout_${claim._id}`,
          status:        'completed',
          gateway:       'mock',
          settledAt:     new Date(),
        });
      }

      return res.json({ success: true, decision: 'ADMIN_APPROVED', payoutAmount: payout });
    } else {
      claim.decision   = 'ADMIN_DECLINED';
      claim.status     = 'rejected';
      claim.resolvedAt = new Date();
      await claim.save();

      return res.json({ success: true, decision: 'ADMIN_DECLINED', payoutAmount: 0 });
    }
  } catch (err) {
    console.error('[claims/:claimId/review]', err);
    return res.status(500).json({ success: false, error: 'Failed to review claim.' });
  }
});

module.exports = router;
