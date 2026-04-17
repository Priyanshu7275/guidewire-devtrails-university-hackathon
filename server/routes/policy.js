/*
 * routes/policy.js
 * -----------------------------------------------------------------------
 * Insurance policy management routes.
 *
 * Endpoints:
 *   POST /api/policy/create          -- Create a new policy for a worker.
 *   GET  /api/policy/active/:workerId -- Fetch a worker's active policy.
 *   GET  /api/policy/history/:workerId -- List all policies (all statuses).
 *
 * Business rules enforced here:
 *   - A worker can only have ONE active policy at a time. Attempting to
 *     create a second one returns 409 Conflict.
 *   - After creating a policy, the worker's activePolicyId field is
 *     updated to point to the new policy.
 *   - Policy duration: we default to 30 days (one month) per premium
 *     payment. A multi-month purchase would pass `tenure_days` in the body.
 *   - On creation, the worker's tenureDays counter is incremented by the
 *     policy duration so future premium calculations give the loyalty
 *     discount correctly.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const { calculateAllPlans, getZoneRiskScore } = require('../services/premiumService');
const authMiddleware = require('../middleware/auth');

// -----------------------------------------------------------------------
// POST /api/policy/create
// -----------------------------------------------------------------------

/**
 * Create a new insurance policy for a worker.
 * Requires: Authorization: Bearer <token>
 * Body: { worker_id, plan, premium_paid, tenure_days? }
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { worker_id, plan, premium_paid, tenure_days } = req.body;

    // Validate required fields.
    if (!worker_id || !plan || premium_paid == null) {
      return res.status(400).json({
        success: false,
        error: 'worker_id, plan, and premium_paid are required.',
      });
    }

    if (!['basic', 'standard', 'premium'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'plan must be one of: basic, standard, premium',
      });
    }

    // Fetch the worker document.
    const worker = await Worker.findById(worker_id);
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found.' });
    }

    // Enforce one-active-policy rule.
    const existingActive = await Policy.findOne({ workerId: worker_id, status: 'active' });
    if (existingActive) {
      return res.status(409).json({
        success: false,
        error: 'Worker already has an active policy. Cancel it before purchasing a new one.',
        activePolicyId: existingActive._id.toString(),
      });
    }

    // Determine policy duration. Default to 30 days per payment cycle.
    const durationDays = tenure_days ? parseInt(tenure_days, 10) : 30;

    // Look up plan parameters from the premium service.
    const planData  = await calculateAllPlans(worker.pincode, worker.tenureDays);
    const planDetails = planData.plans[plan] || { coverageCap: 500, maxHours: 10 };

    // Build start and end dates.
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Create the policy document.
    const policy = await Policy.create({
      workerId: worker._id,
      plan,
      premiumPaid: parseFloat(premium_paid),
      coverageCap: planDetails.coverageCap,
      maxHours: planDetails.maxHours,
      startDate,
      endDate,
      status: 'active',
    });

    // Update worker's activePolicyId and extend tenureDays.
    worker.activePolicyId = policy._id;
    worker.tenureDays += durationDays;
    await worker.save();

    // Calculate days left from now until end date.
    const daysLeft = Math.max(
      0,
      Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    return res.status(201).json({
      success: true,
      policy: {
        policyId:    policy._id.toString(),
        plan:        policy.plan,
        premiumPaid: policy.premiumPaid,
        coverageCap: policy.coverageCap,
        maxHours:    policy.maxHours,
        startDate:   policy.startDate,
        endDate:     policy.endDate,
        daysLeft,
        status:      policy.status,
      },
    });
  } catch (err) {
    console.error('[policy/create]', err);
    return res.status(500).json({ success: false, error: 'Failed to create policy.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/policy/active/:workerId
// -----------------------------------------------------------------------

/**
 * Fetch the currently active policy for a worker.
 * Returns { has_policy: false } if no active policy exists.
 * Requires: Authorization: Bearer <token>
 */
router.get('/active/:workerId', authMiddleware, async (req, res) => {
  try {
    const { workerId } = req.params;

    const policy = await Policy.findOne({ workerId, status: 'active' });

    if (!policy) {
      return res.status(200).json({ hasPolicy: false, policy: null });
    }

    const daysLeft = Math.max(
      0,
      Math.ceil((policy.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    // Expire the policy if its end date has passed.
    if (daysLeft === 0 && policy.status === 'active') {
      policy.status = 'expired';
      await policy.save();

      // Clear the worker's activePolicyId reference.
      await Worker.findByIdAndUpdate(workerId, { activePolicyId: null });

      return res.status(200).json({ hasPolicy: false, policy: null });
    }

    return res.status(200).json({
      hasPolicy: true,
      policy: {
        policyId:    policy._id.toString(),
        plan:        policy.plan,
        premiumPaid: policy.premiumPaid,
        coverageCap: policy.coverageCap,
        maxHours:    policy.maxHours,
        startDate:   policy.startDate,
        endDate:     policy.endDate,
        daysLeft,
        status:      policy.status,
      },
    });
  } catch (err) {
    console.error('[policy/active/:workerId]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch active policy.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/policy/history/:workerId
// -----------------------------------------------------------------------

/**
 * List all policies (active, expired, cancelled) for a worker.
 * Requires: Authorization: Bearer <token>
 */
router.get('/history/:workerId', authMiddleware, async (req, res) => {
  try {
    const { workerId } = req.params;

    const policies = await Policy.find({ workerId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = policies.map((p) => ({
      policyId:    p._id.toString(),
      plan:        p.plan,
      premiumPaid: p.premiumPaid,
      coverageCap: p.coverageCap,
      maxHours:    p.maxHours,
      startDate:   p.startDate,
      endDate:     p.endDate,
      status:      p.status,
      createdAt:   p.createdAt,
    }));

    return res.status(200).json({
      total: formatted.length,
      policies: formatted,
    });
  } catch (err) {
    console.error('[policy/history/:workerId]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch policy history.' });
  }
});

module.exports = router;
