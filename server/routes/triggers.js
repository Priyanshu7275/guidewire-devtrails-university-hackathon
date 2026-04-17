/*
 * routes/triggers.js
 * -----------------------------------------------------------------------
 * Trigger checking and zone summary routes.
 *
 * Endpoints:
 *   GET /api/triggers/check/:pincode?platform=blinkit
 *     -- Checks current weather/AQI for the pincode, evaluates trigger
 *        thresholds, fetches news, and returns a complete disruption
 *        report. Also writes a TriggerLog if any trigger fires.
 *
 *   GET /api/triggers/zone-summary
 *     -- Returns the most recent trigger status for a set of known
 *        pincodes (derived from active policies). Good for a map view.
 *
 * TRIGGER THRESHOLDS:
 *   heavy_rain    : rain_mm > 15
 *   extreme_heat  : temp_c  > 43
 *   dangerous_aqi : aqi     > 350
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const TriggerLog = require('../models/TriggerLog');
const Policy = require('../models/Policy');
const { getWeatherAndAQI } = require('../services/weatherService');
const { fetchDisruptionNews } = require('../services/newsService');

// -----------------------------------------------------------------------
// Trigger definitions (same as schedulerService -- kept in sync)
// -----------------------------------------------------------------------
const TRIGGER_DEFS = [
  {
    type: 'heavy_rain',
    label: 'Heavy Rainfall',
    unit: 'mm/hr',
    threshold: 15,
    getValue: (w) => w.rain_mm,
    message: (val) => `Rainfall of ${val} mm/hr exceeds the 15 mm/hr safe threshold.`,
  },
  {
    type: 'extreme_heat',
    label: 'Extreme Heat',
    unit: 'C',
    threshold: 43,
    getValue: (w) => w.temp_c,
    message: (val) => `Temperature of ${val} C exceeds the 43 C danger threshold.`,
  },
  {
    type: 'dangerous_aqi',
    label: 'Dangerous AQI',
    unit: 'AQI',
    threshold: 350,
    getValue: (_, a) => a.aqi,
    message: (val) => `AQI of ${val} exceeds the 350 safe-air threshold.`,
  },
];

// -----------------------------------------------------------------------
// Helper: write a TriggerLog if it doesn't exist in the last 30 min
// -----------------------------------------------------------------------

/**
 * maybeLogTrigger
 * Writes a TriggerLog document for a fired trigger, deduplicating
 * against any existing log written in the last 30 minutes.
 *
 * @param {string} pincode      - Pincode where the trigger fired.
 * @param {string} triggerType  - E.g. 'heavy_rain'.
 * @param {number} value        - Actual measured value.
 * @param {number} threshold    - The threshold value.
 * @param {string} source       - Data source string.
 * @returns {Promise<void>}
 */
async function maybeLogTrigger(pincode, triggerType, value, threshold, source) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const existing = await TriggerLog.findOne({
    pincode: String(pincode),
    triggerType,
    fired: true,
    detectedAt: { $gte: thirtyMinAgo },
  });

  if (!existing) {
    await TriggerLog.create({
      pincode: String(pincode),
      triggerType,
      value,
      threshold,
      fired: true,
      source: source || 'openweathermap',
      detectedAt: new Date(),
    });
  }
}

// -----------------------------------------------------------------------
// GET /api/triggers/check/:pincode
// -----------------------------------------------------------------------

/**
 * Check current disruption triggers for a pincode.
 * Optionally filter news by delivery platform.
 * Query param: platform (optional) -- e.g. 'blinkit', 'zomato'
 */
router.get('/check/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, error: 'Pincode must be a 6-digit number.' });
    }

    // Fetch weather and AQI data (falls back to mock if OWM key absent).
    const { weather, aqi } = await getWeatherAndAQI(pincode);

    // Evaluate each trigger definition.
    const triggers = [];
    const fired = [];

    for (const def of TRIGGER_DEFS) {
      const value = def.getValue(weather, aqi);
      const triggered = value > def.threshold;

      const entry = {
        type: def.type,
        triggered,
        value: parseFloat(value.toFixed(2)),
        threshold: def.threshold,
        unit: def.unit,
        label: def.label,
        message: triggered ? def.message(value.toFixed(2)) : `${def.label} within safe limits.`,
      };

      triggers.push(entry);

      if (triggered) {
        fired.push(def.type);
        // Write a TriggerLog (will deduplicate internally).
        await maybeLogTrigger(pincode, def.type, value, def.threshold, weather.source);
      }
    }

    // Fetch recent disruption news for the zone.
    const news = await fetchDisruptionNews(pincode);

    return res.status(200).json({
      pincode,
      weather: {
        rainMm: weather.rain_mm,
        tempC: weather.temp_c,
        humidity: weather.humidity,
        city: weather.city,
      },
      aqi: {
        aqi: aqi.aqi,
        pm25: aqi.pm25,
      },
      triggers,
      fired,
      anyActive: fired.length > 0,
      dataSource: weather.source,
      news,
    });
  } catch (err) {
    console.error('[triggers/check/:pincode]', err);
    return res.status(500).json({ success: false, error: 'Failed to check triggers.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/triggers/zone-summary
// -----------------------------------------------------------------------

/**
 * Returns the most recent trigger status for all zones with active policies.
 * Useful for an admin map view showing which zones are currently disrupted.
 */
router.get('/zone-summary', async (req, res) => {
  try {
    // Get all pincodes from active policies (via populated Worker).
    const activePolicies = await Policy.find({ status: 'active' })
      .populate('workerId', 'pincode city')
      .lean();

    // Build unique pincode -> city mapping.
    const zoneMap = {};
    for (const pol of activePolicies) {
      if (pol.workerId && pol.workerId.pincode) {
        zoneMap[pol.workerId.pincode] = pol.workerId.city || 'Unknown';
      }
    }

    // If no active policies, fall back to a set of well-known pincodes.
    const defaultPincodes = ['201301', '110001', '122001', '400001', '560001', '600001', '700001'];
    if (Object.keys(zoneMap).length === 0) {
      defaultPincodes.forEach((pc) => { zoneMap[pc] = 'Demo Zone'; });
    }

    // For each zone, find the most recent fired TriggerLog in the last hour.
    const zones = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [pincode, city] of Object.entries(zoneMap)) {
      const recentLogs = await TriggerLog.find({
        pincode,
        fired: true,
        detectedAt: { $gte: oneHourAgo },
      })
        .sort({ detectedAt: -1 })
        .lean();

      const activeTriggers = recentLogs.map((log) => ({
        type: log.triggerType,
        value: log.value,
        threshold: log.threshold,
        detectedAt: log.detectedAt,
      }));

      zones.push({
        pincode,
        city,
        activeTriggers,
        anyActive: activeTriggers.length > 0,
        lastChecked: recentLogs.length > 0 ? recentLogs[0].detectedAt : null,
      });
    }

    return res.status(200).json({
      zones,
      checkedAt: new Date(),
    });
  } catch (err) {
    console.error('[triggers/zone-summary]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch zone summary.' });
  }
});

module.exports = router;
