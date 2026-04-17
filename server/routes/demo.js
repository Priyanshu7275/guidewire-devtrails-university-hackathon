/*
 * routes/demo.js
 * -----------------------------------------------------------------------
 * Demo simulation route for presentations and testing.
 *
 * Endpoint:
 *   POST /api/demo/simulate-disruption
 *
 * This route simulates a real disruption event for a pincode and
 * automatically processes claims for all workers in that zone who have
 * an active policy. It bypasses the real weather API and injects a
 * TriggerLog directly, then runs the claim pipeline for each affected
 * worker with a fabricated clean GPS and session data so the fraud check
 * passes and the demo shows auto-approved payouts.
 *
 * Use this in demos to show:
 *   1. Trigger fires for a zone.
 *   2. All active-policy workers in the zone get claims initiated.
 *   3. Payouts are computed and approved in one HTTP call.
 *
 * IMPORTANT: This route should be DISABLED (or protected with an admin key)
 * in production. It bypasses normal fraud checks for demo purposes.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Payment = require('../models/Payment');
const TriggerLog = require('../models/TriggerLog');
const { scoreFraud } = require('../services/fraudService');

// Map trigger type to a human-readable story line.
const TRIGGER_STORIES = {
  heavy_rain: 'A heavy monsoon storm hit the zone with rainfall exceeding 25 mm/hr. GigInsure auto-detected the event and initiated payouts for all active workers.',
  extreme_heat: 'Temperatures soared past 45 C. GigInsure detected the heatwave via OpenWeatherMap and triggered automatic income protection for workers.',
  dangerous_aqi: 'Air quality index crossed 310 (Severe) due to crop residue burning. GigInsure activated AQI protection for all eligible workers.',
  curfew: 'A Section 144 curfew was imposed in the zone. GigInsure detected the restriction via NewsAPI and processed emergency payouts.',
  platform_outage: 'The delivery platform suffered a 4-hour outage. GigInsure activated platform disruption coverage for affected workers.',
  flood: 'Flash floods blocked major roads in the zone. GigInsure auto-approved flood disruption claims for all active-policy workers.',
  cyclone: 'Cyclone Mocha intensified and hit coastal areas. GigInsure triggered cyclone emergency coverage for workers in the affected zone.',
};

/**
 * POST /api/demo/simulate-disruption
 * Body: { pincode, trigger_type, trigger_value }
 *
 * Simulates a disruption, auto-processes claims for all workers with
 * active policies in the zone, and returns a detailed story response.
 */
router.post('/simulate-disruption', async (req, res) => {
  try {
    const { pincode, trigger_type, trigger_value } = req.body;

    if (!pincode || !trigger_type || trigger_value == null) {
      return res.status(400).json({
        success: false,
        error: 'pincode, trigger_type, and trigger_value are required.',
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, error: 'Pincode must be 6 digits.' });
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

    // ---- Step 1: Inject a TriggerLog so fraud verification passes ----
    await TriggerLog.create({
      pincode: String(pincode),
      triggerType: trigger_type,
      value: parseFloat(trigger_value),
      threshold: getThreshold(trigger_type),
      fired: true,
      source: 'demo',
      detectedAt: new Date(),
    });

    // ---- Step 2: Find all workers in the zone with active policies ----
    const workersInZone = await Worker.find({ pincode }).lean();

    if (workersInZone.length === 0) {
      return res.status(200).json({
        simulation:      'completed',
        workersAffected: 0,
        autoApproved:    0,
        totalPayoutInr:  0,
        claims:          [],
        story: `No workers with registered pincodes found in zone ${pincode}. Register workers first to see the simulation.`,
      });
    }

    const workerIds = workersInZone.map((w) => w._id);

    // Find active policies for these workers.
    const activePolicies = await Policy.find({
      workerId: { $in: workerIds },
      status: 'active',
    }).lean();

    if (activePolicies.length === 0) {
      return res.status(200).json({
        simulation:      'completed',
        workersAffected: workersInZone.length,
        autoApproved:    0,
        totalPayoutInr:  0,
        claims:          [],
        story: `Found ${workersInZone.length} worker(s) in zone ${pincode} but none have active policies. Purchase a policy first.`,
      });
    }

    // Build a map from workerId -> worker for quick lookup.
    const workerMap = {};
    for (const w of workersInZone) {
      workerMap[w._id.toString()] = w;
    }

    // ---- Step 3: Process a claim for each active policy ----
    const claimResults = [];
    let totalPayout = 0;
    let autoApprovedCount = 0;

    for (const policy of activePolicies) {
      const worker = workerMap[policy.workerId.toString()];
      if (!worker) continue;

      // Use the worker's registered pincode centre as the GPS location
      // so the GPS check passes during demo mode.
      const demoGps = getDemoPincodeCoords(pincode);

      // Run fraud scoring with clean/demo parameters.
      const fraudResult = await scoreFraud({
        workerId: worker._id,
        pincode: worker.pincode,
        triggerType: trigger_type,
        claimLat: demoGps.lat,
        claimLon: demoGps.lon,
        sessionMinutes: 60, // 1-hour disruption session for demo
        deviceFlag: false,
      });

      // Calculate payout.
      const hourlyRate = worker.dailyIncome / 8;
      const sessionHours = 60 / 60; // 1 hour
      const rawPayout = hourlyRate * sessionHours;
      const payoutAmount =
        fraudResult.decision === 'AUTO_APPROVE'
          ? Math.min(Math.round(rawPayout), policy.coverageCap)
          : 0;

      const statusMap = {
        AUTO_APPROVE: 'approved',
        SOFT_HOLD: 'pending',
        MANUAL_REVIEW: 'under_review',
        AUTO_REJECT: 'rejected',
      };

      // Create the claim document.
      const claim = await Claim.create({
        policyId: policy._id,
        workerId: worker._id,
        triggerType: trigger_type,
        triggerValue: parseFloat(trigger_value),
        fraudScore: fraudResult.finalScore,
        decision: fraudResult.decision,
        payoutAmount,
        status: statusMap[fraudResult.decision],
        gpsLat: demoGps.lat,
        gpsLng: demoGps.lon,
        gpsVerified: fraudResult.gpsZoneMatch,
        sessionMinutes: 60,
        deviceFlag: false,
        initiatedAt: new Date(),
        resolvedAt: new Date(),
      });

      // Create payout payment record for approved claims.
      if (fraudResult.decision === 'AUTO_APPROVE' && payoutAmount > 0) {
        await Payment.create({
          workerId: worker._id,
          referenceId: claim._id,
          paymentType: 'payout',
          amount: payoutAmount,
          transactionId: `demo_payout_${claim._id}`,
          status: 'completed',
          gateway: 'mock',
          settledAt: new Date(),
        });
        autoApprovedCount++;
        totalPayout += payoutAmount;
      }

      claimResults.push({
        workerName:     worker.name,
        workerPlatform: worker.platform,
        claimId:        claim._id.toString(),
        decision:       fraudResult.decision,
        fraudScore:     fraudResult.finalScore,
        payoutInr:      payoutAmount,
        status:         statusMap[fraudResult.decision],
      });
    }

    const story = TRIGGER_STORIES[trigger_type] ||
      `Disruption event "${trigger_type}" detected in pincode ${pincode}. Claims processed for affected workers.`;

    return res.status(200).json({
      simulation:      'completed',
      workersAffected: activePolicies.length,
      autoApproved:    autoApprovedCount,
      totalPayoutInr:  totalPayout,
      claims:          claimResults,
      story,
    });
  } catch (err) {
    console.error('[demo/simulate-disruption]', err);
    return res.status(500).json({ success: false, error: 'Simulation failed.' });
  }
});

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * getThreshold
 * Returns the trigger threshold value for a given trigger type.
 * Used when creating the injected TriggerLog.
 *
 * @param {string} type - Trigger type string.
 * @returns {number} Threshold value.
 */
function getThreshold(type) {
  const thresholds = {
    heavy_rain: 15,
    extreme_heat: 43,
    dangerous_aqi: 200,
    curfew: 1,
    platform_outage: 1,
    flood: 1,
    cyclone: 1,
  };
  return thresholds[type] || 1;
}

/**
 * getDemoPincodeCoords
 * Returns approximate GPS coordinates for a pincode so the GPS
 * spoofing check passes during demo mode.
 *
 * @param {string} pincode - 6-digit Indian postal code.
 * @returns {{ lat: number, lon: number }}
 */
function getDemoPincodeCoords(pincode) {
  const coordMap = {
    '201301': { lat: 28.5706, lon: 77.3219 },
    '201302': { lat: 28.5459, lon: 77.3393 },
    '201303': { lat: 28.5706, lon: 77.3219 },
    '110001': { lat: 28.6329, lon: 77.2195 },
    '110002': { lat: 28.6449, lon: 77.2310 },
    '122001': { lat: 28.4595, lon: 77.0266 },
    '400001': { lat: 18.9388, lon: 72.8354 },
    '560001': { lat: 12.9716, lon: 77.5946 },
    '600001': { lat: 13.0827, lon: 80.2707 },
    '700001': { lat: 22.5726, lon: 88.3639 },
  };
  return coordMap[String(pincode)] || { lat: 28.6139, lon: 77.2090 }; // Delhi default
}

module.exports = router;
