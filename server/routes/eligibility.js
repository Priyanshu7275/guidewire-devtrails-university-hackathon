/*
 * routes/eligibility.js
 * -----------------------------------------------------------------------
 * Eligibility map endpoint for the Admin Dashboard.
 *
 * GET /api/eligibility/zones
 *
 * Returns all covered pincodes with:
 *   - Geographic centroid (lat/lon)
 *   - Worker count, active policy count, recent claim count
 *   - Any active triggers in the zone
 *   - Zone risk score (avg across workers in zone)
 *
 * This powers the India SVG eligibility map in the admin dashboard.
 * -----------------------------------------------------------------------
 */

const express    = require('express');
const router     = express.Router();
const Worker     = require('../models/Worker');
const Policy     = require('../models/Policy');
const Claim      = require('../models/Claim');
const TriggerLog = require('../models/TriggerLog');
const centroids  = require('../data/pincodeCentroids');

/**
 * GET /api/eligibility/zones
 * Returns enriched zone data for every covered pincode.
 */
router.get('/zones', async (_req, res) => {
  try {
    const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Aggregate from MongoDB in parallel ───────────────────────────
    const [workersByPincode, activePolicies, recentClaims, activeTriggers] =
      await Promise.all([
        // Workers grouped by pincode
        Worker.aggregate([
          { $group: {
            _id: { $toString: '$pincode' },
            count:        { $sum: 1 },
            avgRiskScore: { $avg: '$zoneRiskScore' },
            avgIncome:    { $avg: '$dailyIncome' },
          }},
        ]),

        // Active policy counts per pincode (via worker join)
        Policy.aggregate([
          { $match: { status: 'active' } },
          { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'worker' } },
          { $unwind: '$worker' },
          { $group: {
            _id:   { $toString: '$worker.pincode' },
            count: { $sum: 1 },
          }},
        ]),

        // Claims in last 30 days per pincode
        Claim.aggregate([
          { $match: { initiatedAt: { $gte: thirtyDaysAgo } } },
          { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'worker' } },
          { $unwind: '$worker' },
          { $group: {
            _id:          { $toString: '$worker.pincode' },
            count:        { $sum: 1 },
            totalPayout:  { $sum: '$payoutAmount' },
            autoApproved: { $sum: { $cond: [{ $eq: ['$decision', 'AUTO_APPROVE'] }, 1, 0] } },
          }},
        ]),

        // Active triggers (fired in last hour)
        TriggerLog.find({ fired: true, detectedAt: { $gte: oneHourAgo } })
          .select('pincode triggerType value threshold detectedAt')
          .lean(),
      ]);

    // ── Build lookup maps ─────────────────────────────────────────────
    const workerMap  = Object.fromEntries(workersByPincode.map(w => [w._id, w]));
    const policyMap  = Object.fromEntries(activePolicies.map(p => [p._id, p.count]));
    const claimMap   = Object.fromEntries(recentClaims.map(c => [c._id, c]));

    // Group active triggers by pincode
    const triggerMap = {};
    for (const t of activeTriggers) {
      if (!triggerMap[t.pincode]) triggerMap[t.pincode] = [];
      triggerMap[t.pincode].push({
        type:       t.triggerType,
        value:      t.value,
        threshold:  t.threshold,
        detectedAt: t.detectedAt,
      });
    }

    // ── Build response ────────────────────────────────────────────────
    const zones = centroids
      .filter(c => c.covered)
      .map(c => {
        const wData   = workerMap[c.pincode]  || {};
        const cData   = claimMap[c.pincode]   || {};
        const trgrs   = triggerMap[c.pincode] || [];
        const riskAvg = Math.round(wData.avgRiskScore ?? 50);

        return {
          pincode:         c.pincode,
          city:            c.city,
          state:           c.state,
          tier:            c.tier,
          lat:             c.lat,
          lon:             c.lon,
          workerCount:     wData.count      ?? 0,
          activePolicies:  policyMap[c.pincode] ?? 0,
          claimsLast30d:   cData.count      ?? 0,
          totalPayoutLast30d: cData.totalPayout ?? 0,
          autoApproved:    cData.autoApproved ?? 0,
          avgRiskScore:    riskAvg,
          avgDailyIncome:  Math.round(wData.avgIncome ?? 0),
          activeTriggers:  trgrs,
          anyTriggerActive: trgrs.length > 0,
          riskLabel: riskAvg > 70 ? 'High' : riskAvg > 40 ? 'Moderate' : 'Low',
        };
      });

    return res.json({
      success: true,
      zones,
      totalCovered: zones.length,
      zonesWithTriggers: zones.filter(z => z.anyTriggerActive).length,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[eligibility/zones]', err);
    return res.status(500).json({ success: false, error: 'Failed to load eligibility zones.' });
  }
});

module.exports = router;
