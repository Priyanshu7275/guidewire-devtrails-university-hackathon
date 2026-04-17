/*
 * services/fraudService.js
 * -----------------------------------------------------------------------
 * Fraud detection engine for GigInsure.
 *
 * Your trained Isolation Forest model (fraud_model.pkl + fraud_scaler.pkl)
 * is served by the Python ML microservice (gitinsure/ml_api.py).
 *
 * Flow for every claim:
 *   1. Gather the 7 behavioural features the model was trained on
 *      (from MongoDB + request data).
 *   2. Compute GPS spoofing check (Haversine distance) in Node.js —
 *      this feeds into `pincode_match` sent to the ML model.
 *   3. POST the 7 features to http://localhost:5001/fraud — the Python
 *      service runs Isolation Forest and returns a 0–1 fraud score.
 *   4. Add a hard penalty if no matching TriggerLog exists in MongoDB
 *      (the ML model can't know about DB state, so we layer this on top).
 *   5. Clip final score to [0, 1] and map to decision.
 *
 * Combined formula:
 *   final_score = clip(ml_score + (trigger_not_verified ? 0.35 : 0), 0, 1)
 *
 * If the ML service is unreachable we fall back to the original
 * rule-based heuristic so claims keep processing.
 *
 * GPS SPOOFING:
 *   Haversine distance between claim GPS and the centre of the worker's
 *   registered pincode. >50 km → pincode_match = 0 (sent to ML model).
 * -----------------------------------------------------------------------
 */

const mlClient   = require('./mlClient');
const Claim      = require('../models/Claim');
const TriggerLog = require('../models/TriggerLog');
const Worker     = require('../models/Worker');

// -----------------------------------------------------------------------
// Static pincode-to-centre lookup for Haversine GPS check
// -----------------------------------------------------------------------
const PINCODE_COORDS = {
  '201301': { lat: 28.5706, lon: 77.3219 },
  '201302': { lat: 28.5459, lon: 77.3393 },
  '201303': { lat: 28.5706, lon: 77.3219 },
  '201304': { lat: 28.5500, lon: 77.3100 },
  '201305': { lat: 28.5300, lon: 77.3000 },
  '110001': { lat: 28.6329, lon: 77.2195 },
  '110002': { lat: 28.6449, lon: 77.2310 },
  '110003': { lat: 28.5672, lon: 77.2412 },
  '122001': { lat: 28.4595, lon: 77.0266 },
  '400001': { lat: 18.9388, lon: 72.8354 },
  '400050': { lat: 19.0596, lon: 72.8295 },
  '560001': { lat: 12.9716, lon: 77.5946 },
  '560034': { lat: 12.9352, lon: 77.6244 },
  '600001': { lat: 13.0827, lon: 80.2707 },
  '600040': { lat: 13.0418, lon: 80.2341 },
  '700001': { lat: 22.5726, lon: 88.3639 },
  '700091': { lat: 22.5800, lon: 88.4800 },
  '411001': { lat: 18.5204, lon: 73.8567 },
  '500001': { lat: 17.3850, lon: 78.4867 },
  '380001': { lat: 23.0225, lon: 72.5714 },
  '302001': { lat: 26.9124, lon: 75.7873 },
  '226001': { lat: 26.8467, lon: 80.9462 },
};
const DEFAULT_CENTRE = { lat: 22.9734, lon: 78.6569 };

// -----------------------------------------------------------------------
// Haversine formula
// -----------------------------------------------------------------------

/**
 * haversineKm
 * Great-circle distance between two (lat, lon) points in kilometres.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R     = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * checkGPSSpoofing
 * Returns { gpsZoneMatch, distanceKm }.
 * gpsZoneMatch = false  →  claim GPS is >50 km from registered pincode.
 */
function checkGPSSpoofing(claimLat, claimLon, pincode) {
  if (claimLat == null || claimLon == null) {
    return { gpsZoneMatch: true, distanceKm: null };
  }
  const centre  = PINCODE_COORDS[String(pincode)] || DEFAULT_CENTRE;
  const distKm  = haversineKm(claimLat, claimLon, centre.lat, centre.lon);
  return {
    gpsZoneMatch: distKm <= 50,
    distanceKm:   parseFloat(distKm.toFixed(2)),
  };
}

// -----------------------------------------------------------------------
// MongoDB query helpers
// -----------------------------------------------------------------------

/** Count how many claims this worker filed in the last 7 days. */
async function countRecentClaims(workerId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return Claim.countDocuments({ workerId, initiatedAt: { $gte: since } });
}

/** How many claims were filed in the same pincode in the last 10 minutes. */
async function countZoneClaimsLast10Min(pincode) {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const workers = await require('../models/Worker').find(
    { pincode: String(pincode) }, '_id'
  ).lean();
  const workerIds = workers.map((w) => w._id);
  return Claim.countDocuments({
    workerId:    { $in: workerIds },
    initiatedAt: { $gte: since },
  });
}

/** Returns the timestamp of the worker's most recent previous claim, or null. */
async function getLastClaimTime(workerId) {
  const last = await Claim.findOne({ workerId })
    .sort({ initiatedAt: -1 })
    .select('initiatedAt')
    .lean();
  return last ? last.initiatedAt : null;
}

/** Verifies that a matching TriggerLog exists in the last 60 minutes. */
async function verifyTriggerExists(pincode, triggerType) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const log = await TriggerLog.findOne({
    pincode:     String(pincode),
    triggerType,
    fired:       true,
    detectedAt:  { $gte: since },
  });
  return log !== null;
}

// ── NEW Signal 1: WEATHER_HISTORY_MISMATCH ───────────────────────────────────
/**
 * Returns true if the claimed trigger type has NO firing history for this
 * pincode in the last 30 days. A zone that has never recorded heavy rain
 * claiming a heavy_rain payout is suspicious.
 */
async function checkWeatherHistoryMismatch(pincode, triggerType) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const count = await TriggerLog.countDocuments({
    pincode:     String(pincode),
    triggerType,
    fired:       true,
    detectedAt:  { $gte: since },
  });
  return count === 0;   // true = no historical precedent → mismatch
}

// ── NEW Signal 2: DEVICE_MISMATCH ────────────────────────────────────────────
/**
 * Returns true if the worker has a registered deviceId that differs from
 * the deviceId submitted with this claim.
 */
async function checkDeviceMismatch(workerId, claimDeviceId) {
  if (!claimDeviceId) return false;
  const worker = await Worker.findById(workerId).select('deviceInfo').lean();
  if (!worker?.deviceInfo?.deviceId) return false;   // no registered device → can't flag
  return worker.deviceInfo.deviceId !== claimDeviceId;
}

// ── NEW Signal 3: COORDINATED_CLAIM ─────────────────────────────────────────
/**
 * Returns the number of *other* workers in the same pincode who also filed
 * a claim in the last 5 minutes. ≥ 3 suggests a coordinated fraud ring.
 */
async function countCoordinatedClaims(pincode, excludeWorkerId) {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const workers = await Worker.find({ pincode: String(pincode) }, '_id').lean();
  const otherIds = workers.map(w => w._id).filter(id => id.toString() !== excludeWorkerId.toString());
  if (otherIds.length === 0) return 0;
  const recentWorkerIds = await Claim.distinct('workerId', {
    workerId:    { $in: otherIds },
    initiatedAt: { $gte: since },
  });
  return recentWorkerIds.length;
}

// ── NEW Signal 4: IP_GPS_MISMATCH ────────────────────────────────────────────
/**
 * Returns true when an IP address is provided (non-private range)
 * but GPS coordinates are absent. This pattern is consistent with
 * VPN / proxy usage to mask location while filing a claim.
 */
function checkIpGpsMismatch(ipAddress, claimLat, claimLon) {
  if (!ipAddress) return false;
  // Private ranges (no geolocation signal) → skip check
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1)/.test(ipAddress)) return false;
  // Non-private IP but no GPS → location masking flag
  return claimLat == null || claimLon == null;
}

// -----------------------------------------------------------------------
// JS rule-based fallback  (used when ML service is unreachable)
// -----------------------------------------------------------------------

function _ruleBased(params, claimsLast7Days, lastClaimTime, gpsZoneMatch, distanceKm, triggerVerified) {
  const { sessionMinutes, deviceFlag } = params;
  const BASE = 0.10;
  let adj = 0;
  const signals = [];

  if (claimsLast7Days >= 5) {
    adj += 0.15;
    signals.push({ type: 'HIGH_CLAIM_FREQUENCY', severity: 'medium',
      detail: `${claimsLast7Days} claims in the last 7 days` });
  }
  const hour = new Date().getHours();
  if (hour >= 1 && hour <= 3) {
    adj += 0.10;
    signals.push({ type: 'OFF_HOURS_CLAIM', severity: 'low',
      detail: `Claim filed at ${hour}:00` });
  }
  if (sessionMinutes != null && sessionMinutes < 2) {
    adj += 0.20;
    signals.push({ type: 'BOT_SPEED_SESSION', severity: 'high',
      detail: `Session ${sessionMinutes} min < 2 min threshold` });
  }
  if (!triggerVerified) {
    adj += 0.50;
    signals.push({ type: 'TRIGGER_NOT_VERIFIED', severity: 'critical',
      detail: 'No matching TriggerLog in the last 60 minutes' });
  }
  if (!gpsZoneMatch) {
    adj += 0.35;
    signals.push({ type: 'GPS_ZONE_MISMATCH', severity: 'high',
      detail: `GPS ${distanceKm} km from registered zone (limit 50 km)` });
  }
  if (lastClaimTime) {
    const hrs = (Date.now() - new Date(lastClaimTime).getTime()) / 3600000;
    if (hrs < 4) {
      adj += 0.10;
      signals.push({ type: 'SHORT_CLAIM_INTERVAL', severity: 'low',
        detail: `Only ${hrs.toFixed(1)} h since last claim` });
    }
  }
  if (deviceFlag) {
    adj += 0.05;
    signals.push({ type: 'DEVICE_FLAG', severity: 'low',
      detail: 'Device sent a risk flag' });
  }

  const finalScore = Math.min(parseFloat((BASE + adj).toFixed(2)), 1.0);
  return { finalScore, signals, source: 'js_fallback' };
}

// -----------------------------------------------------------------------
// Decision mapper (mirrors fraud_detector.py thresholds)
// -----------------------------------------------------------------------
function _toDecision(score) {
  if (score <= 0.35) return { decision: 'AUTO_APPROVE', message: 'All signals verified. Payout initiated.' };
  if (score <= 0.65) return { decision: 'SOFT_HOLD',     message: 'Some unusual signals. Re-checking in 10 minutes.' };
  if (score <= 0.85) return { decision: 'MANUAL_REVIEW', message: 'Multiple anomalous signals. Flagged for review within 2 hours.' };
  return               { decision: 'AUTO_REJECT',   message: 'High fraud probability. Claim rejected. Contact support to appeal.' };
}

// -----------------------------------------------------------------------
// Main export
// -----------------------------------------------------------------------

/**
 * scoreFraud
 * Runs the full fraud detection pipeline for an incoming claim.
 *
 * Steps:
 *  1. GPS spoofing check (Haversine)
 *  2. Gather 7 behavioural features from MongoDB + request data
 *  3. Call Python Isolation Forest model → ml_score
 *  4. Layer trigger-verification penalty on top
 *  5. Return structured result with signals and decision
 *
 * @param {Object} params
 * @param {string}      params.workerId
 * @param {string}      params.pincode
 * @param {string}      params.triggerType
 * @param {number|null} params.claimLat
 * @param {number|null} params.claimLon
 * @param {number|null} params.sessionMinutes
 * @param {boolean}     params.deviceFlag
 * @param {string|null} params.deviceId     — device fingerprint from the claim request
 * @param {string|null} params.ipAddress    — IP address of the request
 */
async function scoreFraud(params) {
  const { workerId, pincode, triggerType, claimLat, claimLon, sessionMinutes, deviceFlag,
          deviceId = null, ipAddress = null } = params;

  // ── Step 1: GPS spoofing check ───────────────────────────────────────
  const { gpsZoneMatch, distanceKm } = checkGPSSpoofing(claimLat, claimLon, pincode);

  // ── Step 2: Gather all ML features + new fraud signal inputs ─────────
  const [
    claimsLast7Days, zoneClaims10Min, lastClaimTime, triggerVerified,
    weatherHistoryMismatch, deviceMismatch, coordinatedClaimCount,
  ] = await Promise.all([
    countRecentClaims(workerId),
    countZoneClaimsLast10Min(pincode),
    getLastClaimTime(workerId),
    verifyTriggerExists(pincode, triggerType),
    checkWeatherHistoryMismatch(pincode, triggerType),
    checkDeviceMismatch(workerId, deviceId),
    countCoordinatedClaims(pincode, workerId),
  ]);
  const ipGpsMismatch = checkIpGpsMismatch(ipAddress, claimLat, claimLon);

  const claimHour          = new Date().getHours();
  const claimIntervalHours = lastClaimTime
    ? parseFloat(((Date.now() - new Date(lastClaimTime).getTime()) / 3600000).toFixed(2))
    : 999;                   // 999 = first-ever claim (no interval)
  const sessionMin         = sessionMinutes != null ? parseFloat(sessionMinutes) : 30.0;

  // ── Step 3: Call Python ML model ─────────────────────────────────────
  let mlScore;
  let scoringSource;
  const signals = [];

  try {
    // Send body as snake_case directly — mlClient's toSnake interceptor
    // is a no-op on already-snake_case keys, and the response will be
    // auto-converted to camelCase by the response interceptor.
    const { data } = await mlClient.post('/fraud', {
      claim_hour:             claimHour,
      claims_last_7_days:     claimsLast7Days,
      zone_claims_last_10min: zoneClaims10Min,
      session_active_minutes: sessionMin,
      pincode_match:          gpsZoneMatch ? 1 : 0,
      claim_interval_hours:   claimIntervalHours,
      device_flag:            deviceFlag ? 1 : 0,
    });
    mlScore       = data.fraudScore;   // camelCase after mlClient response interceptor
    scoringSource = 'isolation_forest';

    // Build signals from the ML model's feature values
    if (claimsLast7Days >= 5)
      signals.push({ type: 'HIGH_CLAIM_FREQUENCY', severity: 'medium',
        detail: `${claimsLast7Days} claims in the last 7 days (model signal)` });
    if (claimHour >= 1 && claimHour <= 3)
      signals.push({ type: 'OFF_HOURS_CLAIM', severity: 'low',
        detail: `Claim filed at ${claimHour}:00 (model signal)` });
    if (sessionMin < 2)
      signals.push({ type: 'BOT_SPEED_SESSION', severity: 'high',
        detail: `Session ${sessionMin.toFixed(1)} min — below 2 min threshold (model signal)` });
    if (zoneClaims10Min >= 15)
      signals.push({ type: 'ZONE_CLAIM_SPIKE', severity: 'medium',
        detail: `${zoneClaims10Min} claims from pincode ${pincode} in last 10 min (model signal)` });
    if (claimIntervalHours < 4 && claimIntervalHours !== 999)
      signals.push({ type: 'SHORT_CLAIM_INTERVAL', severity: 'low',
        detail: `Only ${claimIntervalHours.toFixed(1)} h since last claim (model signal)` });
    if (!gpsZoneMatch)
      signals.push({ type: 'GPS_ZONE_MISMATCH', severity: 'high',
        detail: `GPS ${distanceKm} km from registered zone centre — limit 50 km` });

    // ── New signals (applied on top of ML path) ──────────────────────────
    if (weatherHistoryMismatch)
      signals.push({ type: 'WEATHER_HISTORY_MISMATCH', severity: 'medium',
        detail: `No ${triggerType.replace(/_/g, ' ')} events recorded in pincode ${pincode} in the last 30 days` });
    if (deviceMismatch)
      signals.push({ type: 'DEVICE_MISMATCH', severity: 'high',
        detail: 'Claim submitted from a device different to the registered device' });
    if (coordinatedClaimCount >= 3)
      signals.push({ type: 'COORDINATED_CLAIM', severity: 'high',
        detail: `${coordinatedClaimCount} other workers in pincode ${pincode} filed claims in the last 5 minutes` });
    if (ipGpsMismatch)
      signals.push({ type: 'IP_GPS_MISMATCH', severity: 'medium',
        detail: 'Non-private IP address detected but no GPS coordinates provided — possible location masking' });

  } catch {
    // ── Fallback: Python service unreachable ─────────────────────────
    console.warn('[fraudService] ML service unreachable, using rule-based fallback');
    const fb = _ruleBased(params, claimsLast7Days, lastClaimTime, gpsZoneMatch, distanceKm, triggerVerified);
    mlScore       = fb.finalScore;
    scoringSource = fb.source;
    signals.push(...fb.signals);

    // New signals applied in fallback path too
    if (weatherHistoryMismatch)
      signals.push({ type: 'WEATHER_HISTORY_MISMATCH', severity: 'medium',
        detail: `No ${triggerType.replace(/_/g, ' ')} events in pincode ${pincode} in last 30 days` });
    if (deviceMismatch)
      signals.push({ type: 'DEVICE_MISMATCH', severity: 'high',
        detail: 'Claim submitted from a device different to the registered device' });
    if (coordinatedClaimCount >= 3)
      signals.push({ type: 'COORDINATED_CLAIM', severity: 'high',
        detail: `${coordinatedClaimCount} other workers in pincode ${pincode} filed claims in the last 5 min` });
    if (ipGpsMismatch)
      signals.push({ type: 'IP_GPS_MISMATCH', severity: 'medium',
        detail: 'Non-private IP but no GPS coordinates — possible location masking' });
  }

  // ── Step 4: Layer trigger-verification penalty on top ────────────────
  // The ML model knows about behaviour — but only Node.js knows whether
  // a real TriggerLog exists in MongoDB. Add a hard +0.35 if missing.
  if (!triggerVerified) {
    signals.push({
      type:     'TRIGGER_NOT_VERIFIED',
      severity: 'critical',
      detail:   `No ${triggerType} TriggerLog found for pincode ${pincode} in the last 60 min`,
    });
  }

  const finalScore = parseFloat(
    Math.min(mlScore + (triggerVerified ? 0 : 0.35), 1.0).toFixed(2)
  );

  // ── Step 5: Decision ─────────────────────────────────────────────────
  const { decision, message } = _toDecision(finalScore);

  return {
    baseScore:       parseFloat(mlScore.toFixed(2)),
    finalScore,
    signals,
    decision,
    message,
    gpsZoneMatch,
    gpsDistanceKm:   distanceKm,
    triggerVerified,
    scoringSource,
  };
}

module.exports = { scoreFraud, haversineKm, checkGPSSpoofing };
