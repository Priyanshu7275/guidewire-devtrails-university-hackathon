/*
 * routes/eligibilityMap.js
 * -----------------------------------------------------------------------
 * Admin eligibility map endpoints.
 *
 * GET  /api/admin/eligibility-map
 *   Returns all covered zones classified as ACTIVE / ELEVATED / NORMAL.
 *   ACTIVE   = has a fired TriggerLog in the last 60 minutes.
 *   ELEVATED = has a fired TriggerLog in the last 6 hours (but not < 1hr).
 *   NORMAL   = no recent triggers.
 *
 * GET  /api/admin/eligibility-map/zone/:pincode
 *   Returns worker-level details for a single zone (for side panel).
 *
 * POST /api/admin/eligibility-map/zone/:pincode/batch-approve
 *   Approves all pending / under-review claims in the zone with
 *   fraudScore < 0.7.
 * -----------------------------------------------------------------------
 */

const express  = require('express');
const router   = express.Router();
const Worker   = require('../models/Worker');
const Policy   = require('../models/Policy');
const Claim    = require('../models/Claim');
const Payment  = require('../models/Payment');
const TriggerLog = require('../models/TriggerLog');
const centroids  = require('../data/pincodeCentroids');

const centroidMap = Object.fromEntries(centroids.map(c => [c.pincode, c]));

// ── helper ───────────────────────────────────────────────────────────────
function calcPayout(dailyIncome, sessionMinutes, coverageCap) {
  const hourlyRate = (dailyIncome || 600) / 8;
  const hours      = (sessionMinutes || 60) / 60;
  return Math.min(Math.round(hourlyRate * hours), coverageCap || 500);
}

// -----------------------------------------------------------------------
// GET /api/admin/eligibility-map
// -----------------------------------------------------------------------
router.get('/', async (_req, res) => {
  try {
    const now          = new Date();
    const oneHourAgo   = new Date(now - 60  * 60 * 1000);
    const sixHoursAgo  = new Date(now -  6  * 60 * 60 * 1000);

    const [
      workersByPincode,
      activePolicies,
      pendingClaims,
      paidClaims,
      allClaimStats,
      activeTrigs,
      elevatedTrigs,
    ] = await Promise.all([
      Worker.aggregate([
        { $group: { _id: { $toString: '$pincode' }, count: { $sum: 1 } } },
      ]),
      Policy.aggregate([
        { $match: { status: 'active', endDate: { $gt: now } } },
        { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'w' } },
        { $unwind: '$w' },
        { $group: { _id: { $toString: '$w.pincode' }, count: { $sum: 1 } } },
      ]),
      Claim.aggregate([
        { $match: { status: { $in: ['pending', 'under_review'] } } },
        { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'w' } },
        { $unwind: '$w' },
        { $group: {
          _id:         { $toString: '$w.pincode' },
          count:       { $sum: 1 },
          totalPayout: { $sum: '$payoutAmount' },
        }},
      ]),
      // Paid / approved claims — for "already paid" column
      Claim.aggregate([
        { $match: { status: { $in: ['paid', 'approved'] } } },
        { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'w' } },
        { $unwind: '$w' },
        { $group: {
          _id:       { $toString: '$w.pincode' },
          count:     { $sum: 1 },
          totalPaid: { $sum: '$payoutAmount' },
        }},
      ]),
      // All claims — avg fraud score + total count per zone
      Claim.aggregate([
        { $lookup: { from: 'workers', localField: 'workerId', foreignField: '_id', as: 'w' } },
        { $unwind: '$w' },
        { $group: {
          _id:          { $toString: '$w.pincode' },
          totalClaims:  { $sum: 1 },
          avgFraud:     { $avg: '$fraudScore' },
        }},
      ]),
      TriggerLog.find({ fired: true, detectedAt: { $gte: oneHourAgo } })
        .select('pincode triggerType value threshold detectedAt')
        .lean(),
      TriggerLog.find({ fired: true, detectedAt: { $gte: sixHoursAgo, $lt: oneHourAgo } })
        .select('pincode')
        .lean(),
    ]);

    const workerMap  = Object.fromEntries(workersByPincode.map(w => [w._id, w.count]));
    const policyMap  = Object.fromEntries(activePolicies.map(p => [p._id, p.count]));
    const claimMap   = Object.fromEntries(pendingClaims.map(c => [c._id, c]));
    const paidMap    = Object.fromEntries(paidClaims.map(c => [c._id, c]));
    const statsMap   = Object.fromEntries(allClaimStats.map(c => [c._id, c]));

    // Group active triggers by pincode
    const activeTrigMap = {};
    for (const t of activeTrigs) {
      if (!activeTrigMap[t.pincode]) activeTrigMap[t.pincode] = [];
      activeTrigMap[t.pincode].push({
        type:       t.triggerType,
        value:      t.value,
        threshold:  t.threshold,
        detectedAt: t.detectedAt,
      });
    }
    const elevatedSet = new Set(elevatedTrigs.map(t => t.pincode));

    const zones = centroids.filter(c => c.covered).map(c => {
      const isActive   = (activeTrigMap[c.pincode]?.length ?? 0) > 0;
      const isElevated = !isActive && elevatedSet.has(c.pincode);
      const status     = isActive ? 'ACTIVE' : isElevated ? 'ELEVATED' : 'NORMAL';
      const cData      = claimMap[c.pincode]  || {};
      const pData      = paidMap[c.pincode]   || {};
      const sData      = statsMap[c.pincode]  || {};

      return {
        pincode:           c.pincode,
        city:              c.city,
        state:             c.state,
        lat:               c.lat,
        lng:               c.lon,
        status,
        activeTriggers:    activeTrigMap[c.pincode] || [],
        workerCount:       workerMap[c.pincode]  ?? 0,
        activePolicyCount: policyMap[c.pincode]  ?? 0,
        pendingClaimCount: cData.count           ?? 0,
        pendingPayout:     cData.totalPayout      ?? 0,
        paidClaimCount:    pData.count           ?? 0,
        totalPaid:         pData.totalPaid        ?? 0,
        totalClaims:       sData.totalClaims      ?? 0,
        avgFraudScore:     sData.avgFraud != null ? parseFloat(sData.avgFraud.toFixed(2)) : null,
      };
    });

    const activeZonesList      = zones.filter(z => z.status === 'ACTIVE');
    const totalEligibleWorkers = zones.reduce((s, z) => s + z.activePolicyCount, 0);
    const totalPendingPayout   = zones.reduce((s, z) => s + z.pendingPayout, 0);
    const totalPaid            = zones.reduce((s, z) => s + z.totalPaid, 0);
    const totalPendingClaims   = zones.reduce((s, z) => s + z.pendingClaimCount, 0);

    return res.json({
      success: true,
      summary: {
        activeZones:          activeZonesList.length,
        totalEligibleWorkers,
        totalPendingPayout,
        totalPaid,
        totalPendingClaims,
      },
      zones,
      checkedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('[eligibilityMap/]', err);
    return res.status(500).json({ success: false, error: 'Failed to load eligibility map.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/admin/eligibility-map/zone/:pincode
// -----------------------------------------------------------------------
router.get('/zone/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    const centroid    = centroidMap[pincode];
    if (!centroid) return res.status(404).json({ success: false, error: 'Pincode not covered.' });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [workers, activeTrigs] = await Promise.all([
      Worker.find({ pincode: Number(pincode) })
        .select('name phone platform dailyIncome')
        .lean(),
      TriggerLog.find({ pincode, fired: true, detectedAt: { $gte: oneHourAgo } })
        .select('triggerType value threshold')
        .lean(),
    ]);

    const workerIds = workers.map(w => w._id);

    const [policies, recentClaims] = await Promise.all([
      Policy.find({ workerId: { $in: workerIds }, status: 'active' }).lean(),
      Claim.find({ workerId: { $in: workerIds } })
        .sort({ initiatedAt: -1 })
        .limit(workerIds.length * 3)
        .lean(),
    ]);

    const policyByWorker = Object.fromEntries(policies.map(p => [p.workerId.toString(), p]));

    // Most-recent claim per worker
    const claimByWorker = {};
    for (const c of recentClaims) {
      const wid = c.workerId.toString();
      if (!claimByWorker[wid]) claimByWorker[wid] = c;
    }

    const workerList = workers.map(w => {
      const wid    = w._id.toString();
      const policy = policyByWorker[wid];
      const claim  = claimByWorker[wid];
      return {
        workerId:     wid,
        name:         w.name,
        platform:     w.platform,
        plan:         policy?.plan      || null,
        hasPolicy:    !!policy,
        claimStatus:  claim?.status     || null,
        claimId:      claim?._id?.toString() || null,
        claimDecision: claim?.decision  || null,
        fraudScore:   claim?.fraudScore ?? null,
        payoutAmount: claim?.payoutAmount ?? 0,
      };
    });

    const eligible   = workerList.filter(w => w.hasPolicy).length;
    const claimsFiled = workerList.filter(w => w.claimStatus).length;
    const autoPaid   = workerList.filter(w => ['paid', 'approved'].includes(w.claimStatus)).length;
    const pending    = workerList.filter(w => ['pending', 'under_review'].includes(w.claimStatus)).length;

    return res.json({
      success:  true,
      pincode,
      city:     centroid.city,
      state:    centroid.state,
      activeTriggers: activeTrigs.map(t => ({
        type:      t.triggerType,
        value:     t.value,
        threshold: t.threshold,
      })),
      stats:   { eligible, claimsFiled, autoPaid, pending },
      workers: workerList,
    });
  } catch (err) {
    console.error('[eligibilityMap/zone]', err);
    return res.status(500).json({ success: false, error: 'Failed to load zone detail.' });
  }
});

// -----------------------------------------------------------------------
// POST /api/admin/eligibility-map/zone/:pincode/batch-approve
// -----------------------------------------------------------------------
router.post('/zone/:pincode/batch-approve', async (req, res) => {
  try {
    const { pincode } = req.params;

    const workers = await Worker.find({ pincode: Number(pincode) })
      .select('_id dailyIncome')
      .lean();
    if (!workers.length) {
      return res.json({ success: true, approved: 0, message: 'No workers in this zone.' });
    }

    const workerIds       = workers.map(w => w._id);
    const incomeMap       = Object.fromEntries(workers.map(w => [w._id.toString(), w.dailyIncome]));

    const pendingClaims = await Claim.find({
      workerId:   { $in: workerIds },
      status:     { $in: ['pending', 'under_review'] },
      fraudScore: { $lt: 0.7 },
    }).lean();

    if (!pendingClaims.length) {
      return res.json({ success: true, approved: 0, message: 'No eligible pending claims to approve.' });
    }

    let approved = 0;
    for (const claim of pendingClaims) {
      const policy = await Policy.findById(claim.policyId).lean();
      const payout = calcPayout(
        incomeMap[claim.workerId.toString()],
        claim.sessionMinutes,
        policy?.coverageCap,
      );

      await Claim.findByIdAndUpdate(claim._id, {
        decision:    'ADMIN_APPROVED',
        status:      'paid',
        payoutAmount: payout,
        resolvedAt:  new Date(),
      });

      if (payout > 0) {
        await Payment.create({
          workerId:      claim.workerId,
          referenceId:   claim._id,
          paymentType:   'payout',
          amount:        payout,
          transactionId: `batch_${claim._id}`,
          status:        'completed',
          gateway:       'mock',
          settledAt:     new Date(),
        });
      }
      approved++;
    }

    return res.json({
      success:  true,
      approved,
      message:  `${approved} claim${approved !== 1 ? 's' : ''} approved and paid out.`,
    });
  } catch (err) {
    console.error('[eligibilityMap/batch-approve]', err);
    return res.status(500).json({ success: false, error: 'Batch approve failed.' });
  }
});

module.exports = router;
