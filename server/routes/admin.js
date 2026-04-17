/*
 * routes/admin.js
 * -----------------------------------------------------------------------
 * Admin dashboard routes.
 *
 * Endpoints:
 *   GET /api/admin/dashboard -- High-level KPI summary.
 *   GET /api/admin/workers   -- Full worker list with policy status.
 *   GET /api/admin/claims    -- All claims with fraud scores.
 *
 * SECURITY NOTE:
 *   In a production system these routes would require an admin-role JWT
 *   (a separate admin user collection with role:'admin'). For this demo
 *   we protect them with the same worker JWT middleware and add a TODO
 *   comment where the role check should go.
 *
 * LOSS RATIO:
 *   Total payouts / Total premiums collected * 100
 *   A loss ratio > 100% means the product is losing money.
 *   A loss ratio < 60% means premiums may be overpriced.
 *   Target: 60-80%.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');

// -----------------------------------------------------------------------
// GET /api/admin/dashboard
// -----------------------------------------------------------------------

/**
 * Return high-level platform KPIs for the admin dashboard.
 * Requires: Authorization: Bearer <token>
 * (In production: also require role === 'admin')
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Run all aggregation queries concurrently using Promise.all.
    // This is much faster than running them sequentially (6 DB calls in ~1x time).
    const [
      totalWorkers,
      activePolicies,
      totalClaims,
      payoutAgg,
      premiumAgg,
      fraudFlagged,
    ] = await Promise.all([
      Worker.countDocuments(),
      Policy.countDocuments({ status: 'active' }),
      Claim.countDocuments(),

      // Total approved payouts.
      Payment.aggregate([
        { $match: { paymentType: 'payout', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Total premiums collected.
      Payment.aggregate([
        { $match: { paymentType: 'premium', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      // Claims with fraud_score > 0.35 (flagged).
      Claim.countDocuments({ fraudScore: { $gt: 0.35 } }),
    ]);

    const totalPaidInr = payoutAgg.length ? payoutAgg[0].total : 0;
    const totalPremiumInr = premiumAgg.length ? premiumAgg[0].total : 0;

    // Loss ratio: (total payouts / total premiums) * 100.
    const lossRatioPct =
      totalPremiumInr > 0
        ? parseFloat(((totalPaidInr / totalPremiumInr) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      totalWorkers,
      activePolicies,
      totalClaims,
      totalPaidInr,
      totalPremiumInr,
      fraudFlagged,
      lossRatioPct,
    });
  } catch (err) {
    console.error('[admin/dashboard]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard data.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/admin/workers
// -----------------------------------------------------------------------

/**
 * Return all workers with their current policy status.
 * Supports query params:
 *   platform -- filter by platform (e.g. ?platform=swiggy)
 *   pincode  -- filter by pincode  (e.g. ?pincode=201301)
 *   page     -- pagination page (default: 1)
 *   limit    -- results per page (default: 50)
 */
router.get('/workers', async (req, res) => {
  try {
    const { platform, pincode, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (platform) filter.platform = platform.toLowerCase();
    if (pincode) filter.pincode = pincode;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Worker.countDocuments(filter),
    ]);

    // Batch-fetch active policies for the returned worker IDs.
    const workerIds = workers.map((w) => w._id);
    const activePolicies = await Policy.find({
      workerId: { $in: workerIds },
      status: 'active',
    }).lean();

    // Build a map from workerId string -> policy for O(1) lookup.
    const policyMap = {};
    for (const p of activePolicies) {
      policyMap[p.workerId.toString()] = p;
    }

    const formatted = workers.map((w) => {
      const pol = policyMap[w._id.toString()];
      return {
        workerId: w._id.toString(),
        name: w.name,
        phone: w.phone,
        platform: w.platform,
        pincode: w.pincode,
        city: w.city,
        dailyIncome: w.dailyIncome,
        zoneRiskScore: w.zoneRiskScore,
        tenureDays: w.tenureDays,
        hasActivePolicy: !!pol,
        activePlan: pol ? pol.plan : null,
        createdAt: w.createdAt,
      };
    });

    return res.status(200).json({
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      workers: formatted,
    });
  } catch (err) {
    console.error('[admin/workers]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch workers.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/admin/claims
// -----------------------------------------------------------------------

/**
 * Return all claims with worker and fraud details.
 * Supports query params:
 *   decision -- filter by decision (AUTO_APPROVE, SOFT_HOLD, etc.)
 *   status   -- filter by status (pending, approved, paid, etc.)
 *   page, limit -- pagination
 */
router.get('/claims', async (req, res) => {
  try {
    const { decision, status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (decision) filter.decision = decision.toUpperCase();
    if (status) filter.status = status.toLowerCase();

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [claims, total] = await Promise.all([
      Claim.find(filter)
        .sort({ initiatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate('workerId', 'name phone platform pincode')
        .lean(),
      Claim.countDocuments(filter),
    ]);

    const formatted = claims.map((c) => ({
      claimId: c._id.toString(),
      worker: c.workerId
        ? {
            id: c.workerId._id.toString(),
            name: c.workerId.name,
            phone: c.workerId.phone,
            platform: c.workerId.platform,
            pincode: c.workerId.pincode,
          }
        : null,
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
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      claims: formatted,
    });
  } catch (err) {
    console.error('[admin/claims]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch claims.' });
  }
});

module.exports = router;
