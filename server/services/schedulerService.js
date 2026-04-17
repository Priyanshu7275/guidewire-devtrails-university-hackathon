/*
 * services/schedulerService.js
 * -----------------------------------------------------------------------
 * Automated trigger monitoring using node-cron.
 *
 * node-cron is a task scheduler for Node.js that uses standard cron
 * expression syntax. A cron expression has 5 or 6 fields:
 *   second(opt) minute hour day month day-of-week
 *
 * Our expression "*\/5 * * * *" means: run at every 5th minute.
 *
 * WHAT HAPPENS EVERY 5 MINUTES:
 *   1. Query the Policy collection for all documents with status:'active'.
 *   2. Collect the unique set of pincodes from those policies.
 *   3. For each pincode, call getWeatherAndAQI() from weatherService.
 *   4. Evaluate which trigger thresholds are exceeded.
 *   5. For each fired trigger, check if the same trigger was already
 *      logged for that pincode within the last 30 minutes (deduplication).
 *   6. If it is a new event, write a TriggerLog document.
 *   7. Log a summary to the console.
 *
 * DEDUPLICATION RATIONALE:
 *   Without deduplication the scheduler would write a new TriggerLog
 *   every 5 minutes for as long as rain continues, flooding the database
 *   and making the fraud check noisy. The 30-minute window means we log
 *   at most twice per hour per trigger type per zone.
 *
 * TRIGGER THRESHOLDS:
 *   heavy_rain    : rain_mm > 15
 *   extreme_heat  : temp_c > 43
 *   dangerous_aqi : aqi > 200
 * -----------------------------------------------------------------------
 */

const cron = require('node-cron');
const Policy = require('../models/Policy');
const TriggerLog = require('../models/TriggerLog');
const { getWeatherAndAQI } = require('./weatherService');

// -----------------------------------------------------------------------
// Trigger definitions: each object describes one trigger type.
// -----------------------------------------------------------------------
const TRIGGER_DEFINITIONS = [
  {
    type: 'heavy_rain',
    getValue: (weather) => weather.rain_mm,
    threshold: 15,
    source: 'openweathermap',
  },
  {
    type: 'extreme_heat',
    getValue: (weather) => weather.temp_c,
    threshold: 43,
    source: 'openweathermap',
  },
  {
    type: 'dangerous_aqi',
    getValue: (_, aqi) => aqi.aqi,
    threshold: 200,
    source: 'openweathermap',
  },
];

/**
 * checkPincodeForTriggers
 * Fetches weather + AQI for one pincode and logs any new trigger events.
 *
 * @param {string} pincode - 6-digit Indian postal code to check.
 * @returns {Promise<void>}
 */
async function checkPincodeForTriggers(pincode) {
  let weatherData;
  let aqiData;

  try {
    const result = await getWeatherAndAQI(pincode);
    weatherData = result.weather;
    aqiData = result.aqi;
  } catch (err) {
    console.warn(`[scheduler] Failed to fetch data for pincode ${pincode}: ${err.message}`);
    return;
  }

  // Evaluate each trigger definition against the current readings.
  for (const trigger of TRIGGER_DEFINITIONS) {
    const value = trigger.getValue(weatherData, aqiData);
    const fired = value > trigger.threshold;

    if (!fired) {
      // Trigger did not fire -- no log needed.
      continue;
    }

    // Deduplication check: skip if the same trigger was logged in the
    // last 30 minutes for this pincode.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const existingLog = await TriggerLog.findOne({
      pincode: String(pincode),
      triggerType: trigger.type,
      fired: true,
      detectedAt: { $gte: thirtyMinAgo },
    });

    if (existingLog) {
      // Already logged recently, skip to avoid duplicates.
      continue;
    }

    // Write the new trigger log.
    await TriggerLog.create({
      pincode: String(pincode),
      triggerType: trigger.type,
      value,
      threshold: trigger.threshold,
      fired: true,
      source: trigger.source,
      detectedAt: new Date(),
    });

    console.log(
      `[scheduler] Trigger FIRED: ${trigger.type} at ${pincode} (value=${value}, threshold=${trigger.threshold})`
    );
  }
}

/**
 * runTriggerCheck
 * The main function executed by the cron job.
 * Finds all active policy pincodes and checks each one.
 *
 * @returns {Promise<void>}
 */
async function runTriggerCheck() {
  console.log('[scheduler] Running trigger check...');

  let activePolicies;
  try {
    // We only need the workerId to get the pincode, but since pincode is
    // stored on the Worker model we need to populate. For efficiency we
    // store pincode redundantly on TriggerLog (it's already there), so
    // we look it up via the Policy -> Worker join.
    //
    // Actually the simpler approach: get the distinct pincodes from
    // TriggerLog already stored, OR look up via Worker collection.
    // Since Policy doesn't store pincode directly, we use aggregation.
    activePolicies = await Policy.find({ status: 'active' })
      .populate('workerId', 'pincode')
      .lean();
  } catch (err) {
    console.error(`[scheduler] DB query failed: ${err.message}`);
    return;
  }

  // Extract unique pincodes from the active policies.
  // Using a Set automatically removes duplicates.
  const pincodeSet = new Set();
  for (const policy of activePolicies) {
    // policy.workerId is the populated Worker document (or null if worker
    // was deleted). Guard against that.
    if (policy.workerId && policy.workerId.pincode) {
      pincodeSet.add(policy.workerId.pincode);
    }
  }

  if (pincodeSet.size === 0) {
    console.log('[scheduler] No active policy zones to check.');
    return;
  }

  console.log(`[scheduler] Checking ${pincodeSet.size} unique pincode(s): ${[...pincodeSet].join(', ')}`);

  // Check each unique pincode. We process them sequentially to avoid
  // hammering the OWM API with concurrent requests.
  for (const pincode of pincodeSet) {
    await checkPincodeForTriggers(pincode);
  }

  console.log('[scheduler] Trigger check complete.');
}

/**
 * startScheduler
 * Creates and starts the node-cron job that runs every 5 minutes.
 * Call this once from server.js after the database is connected.
 *
 * @returns {void}
 */
function startScheduler() {
  // Cron expression: run at every 5th minute (e.g. :00, :05, :10, ...).
  const expression = '*/5 * * * *';

  cron.schedule(expression, async () => {
    try {
      await runTriggerCheck();
    } catch (err) {
      // Catch at the top level so an unexpected error never crashes the
      // entire cron job process.
      console.error(`[scheduler] Uncaught error in trigger check: ${err.message}`);
    }
  });

  console.log('[scheduler] Trigger monitor started -- running every 5 minutes.');
}

module.exports = { startScheduler, runTriggerCheck, checkPincodeForTriggers };
