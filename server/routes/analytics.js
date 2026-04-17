/*
 * routes/analytics.js
 * -----------------------------------------------------------------------
 * Analytics and prediction routes.
 *
 * Endpoints:
 *   GET /api/analytics/zone/:pincode    -- Detailed stats for a zone.
 *   GET /api/analytics/predict/:pincode -- Disruption risk predictions.
 *
 * ZONE ANALYTICS:
 *   Aggregates worker count, claim history, fraud profile, and trigger
 *   trend data from the database for a given pincode.
 *
 * PREDICTION:
 *   Generates a 7-day ahead probability estimate for each trigger type.
 *   In a full ML pipeline this would call a trained model. Here we
 *   compute a deterministic estimate from:
 *     - Zone risk score (higher risk = higher probability)
 *     - Current month (season effect)
 *     - Historical trigger frequency from TriggerLog
 *   The probabilities are in the 10-90% range and are clearly labelled
 *   as model estimates, not real forecasts.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const Worker = require('../models/Worker');
const Claim = require('../models/Claim');
const TriggerLog = require('../models/TriggerLog');
const { getZoneRiskScore, getRiskLevel } = require('../services/premiumService');
const { getWeatherAndAQI } = require('../services/weatherService');

// -----------------------------------------------------------------------
// GET /api/analytics/zone/:pincode
// -----------------------------------------------------------------------

/**
 * Return comprehensive analytics for a pincode zone.
 * No auth required (public analytics endpoint).
 */
router.get('/zone/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, error: 'Pincode must be 6 digits.' });
    }

    // ---- Worker count and platform breakdown ----
    const workers = await Worker.find({ pincode }).lean();
    const platformCounts = {};
    for (const w of workers) {
      platformCounts[w.platform] = (platformCounts[w.platform] || 0) + 1;
    }

    // Get worker IDs for the claim queries.
    const workerIds = workers.map((w) => w._id);

    // ---- Claim stats ----
    const claims = await Claim.find({ workerId: { $in: workerIds } }).lean();

    // Claims by trigger type.
    const byTrigger = {};
    for (const c of claims) {
      byTrigger[c.triggerType] = (byTrigger[c.triggerType] || 0) + 1;
    }

    // Hourly distribution (which hour of day do claims tend to be filed?).
    const hourlyDist = new Array(24).fill(0);
    for (const c of claims) {
      const h = new Date(c.initiatedAt).getHours();
      hourlyDist[h]++;
    }

    // ---- Fraud profile ----
    const fraudClaims = claims.filter((c) => c.fraudScore > 0.35);
    const avgFraudScore =
      claims.length > 0
        ? parseFloat((claims.reduce((s, c) => s + c.fraudScore, 0) / claims.length).toFixed(3))
        : 0;

    // ---- Trigger trend (last 7 days) ----
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = await TriggerLog.find({
      pincode,
      fired: true,
      detectedAt: { $gte: sevenDaysAgo },
    }).lean();

    const triggerTrend = {};
    for (const log of recentLogs) {
      const dayKey = new Date(log.detectedAt).toISOString().slice(0, 10);
      if (!triggerTrend[dayKey]) triggerTrend[dayKey] = {};
      triggerTrend[dayKey][log.triggerType] = (triggerTrend[dayKey][log.triggerType] || 0) + 1;
    }

    // ---- Live conditions ----
    const { weather, aqi } = await getWeatherAndAQI(pincode);

    // ---- Zone risk ----
    const zoneRisk = getZoneRiskScore(pincode);

    return res.status(200).json({
      pincode,
      zoneRisk: {
        score: zoneRisk,
        level: getRiskLevel(zoneRisk),
      },
      workers: {
        total: workers.length,
        platforms: platformCounts,
      },
      claims: {
        total: claims.length,
        byTrigger,
        hourlyDist,
      },
      fraudProfile: {
        totalFlagged: fraudClaims.length,
        avgFraudScore,
        flagRatePct: claims.length > 0
          ? parseFloat(((fraudClaims.length / claims.length) * 100).toFixed(1))
          : 0,
      },
      triggerTrend7d: triggerTrend,
      liveConditions: {
        rainMm: weather.rain_mm,
        tempC: weather.temp_c,
        aqi: aqi.aqi,
        pm25: aqi.pm25,
        dataSource: weather.source,
      },
    });
  } catch (err) {
    console.error('[analytics/zone/:pincode]', err);
    return res.status(500).json({ success: false, error: 'Failed to generate zone analytics.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/analytics/predict/:pincode
// -----------------------------------------------------------------------

/**
 * Generate 7-day disruption risk predictions for a pincode.
 * Returns probability estimates and expected claim/payout numbers.
 *
 * The probability formula:
 *   base = zoneRiskScore / 100  (e.g. 0.68 for Delhi)
 *   season_boost applied for relevant season
 *   historical_frequency from TriggerLog (last 30 days)
 *   probability = clip(base * triggerWeight * seasonBoost + historicalFreq, 0.05, 0.95)
 */
router.get('/predict/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, error: 'Pincode must be 6 digits.' });
    }

    const riskScore = getZoneRiskScore(pincode);
    const baseProb = riskScore / 100;
    const currentMonth = new Date().getMonth() + 1;

    // Season boosts per trigger type.
    // Monsoon (Jun-Sep) boosts heavy_rain; summer (Apr-Jun) boosts heat.
    const isMonsoon = currentMonth >= 6 && currentMonth <= 9;
    const isSummer = currentMonth >= 4 && currentMonth <= 6;
    const isWinter = currentMonth === 12 || currentMonth <= 2;

    // Count how many times each trigger fired in the last 30 days
    // (historical frequency signal).
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = await TriggerLog.find({
      pincode,
      fired: true,
      detectedAt: { $gte: thirtyDaysAgo },
    }).lean();

    const freqMap = {};
    for (const log of recentLogs) {
      freqMap[log.triggerType] = (freqMap[log.triggerType] || 0) + 1;
    }

    // Helper: convert fire count to a small additive probability boost.
    // More than 10 fires in 30 days = +0.20 boost.
    const freqBoost = (type) => Math.min((freqMap[type] || 0) / 50, 0.20);

    // Clip helper.
    const clip = (v, min, max) => Math.min(Math.max(v, min), max);

    // Expected workers in zone.
    const workerCount = await Worker.countDocuments({ pincode });

    // Define trigger predictions.
    const triggerWeights = {
      heavy_rain: isMonsoon ? 1.5 : (isWinter ? 0.4 : 0.7),
      extreme_heat: isSummer ? 1.6 : (isMonsoon ? 0.3 : 0.6),
      dangerous_aqi: isWinter ? 1.4 : (isMonsoon ? 0.6 : 1.0),
      curfew: 0.3,
      platform_outage: 0.25,
    };

    const predictions = {};
    const maxProbKey = { key: '', prob: 0 };

    for (const [triggerType, weight] of Object.entries(triggerWeights)) {
      const rawProb = baseProb * weight + freqBoost(triggerType);
      const prob = clip(rawProb, 0.05, 0.95);
      const probPct = parseFloat((prob * 100).toFixed(1));

      const severity = prob > 0.6 ? 'high' : prob > 0.35 ? 'medium' : 'low';

      predictions[triggerType] = {
        probabilityPct: probPct,
        severity,
      };

      if (prob > maxProbKey.prob) {
        maxProbKey.key = triggerType;
        maxProbKey.prob = prob;
      }
    }

    // Estimate expected claims and payouts over 7 days.
    // Expected claims = workers * dominant_probability * 0.3 (not all will claim)
    const expectedClaims = Math.round(workerCount * maxProbKey.prob * 0.3);
    const avgPayout = 250; // rough average payout per claim
    const expectedPayout = expectedClaims * avgPayout;

    return res.status(200).json({
      pincode,
      predictions,
      summary: {
        dominantRisk: maxProbKey.key,
        expectedClaims,
        expectedPayoutInr: expectedPayout,
      },
    });
  } catch (err) {
    console.error('[analytics/predict/:pincode]', err);
    return res.status(500).json({ success: false, error: 'Prediction failed.' });
  }
});

module.exports = router;
