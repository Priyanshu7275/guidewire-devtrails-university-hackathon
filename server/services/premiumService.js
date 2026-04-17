/*
 * services/premiumService.js
 * -----------------------------------------------------------------------
 * Premium calculation engine.
 *
 * Zone risk scores now come from your trained XGBoost model (.pkl) served
 * by the Python ML microservice (gitinsure/ml_api.py, port 5001).
 *
 * Flow:
 *   1. Call POST http://localhost:5001/premium with { pincode, tenure_days }
 *   2. Python loads zone_model.pkl / pincode_lookup.pkl and returns the
 *      risk score + full premium breakdown for all 3 plans.
 *   3. If the ML service is unreachable, we fall back to the hardcoded
 *      JS lookup table so the app keeps working during development.
 *
 * PREMIUM FORMULA (same in Python and JS):
 *   base = 35
 *   risk_adj = base × 1.2 × zone_risk_score / 100
 *   season   = 1.3 (Jun-Sep) | 0.9 (Dec-Feb) | 1.0 (rest)
 *   discount = min(floor(tenure_days / 30) × 2, 10)   [Rs.]
 *   raw      = base × (1 + 1.2 × risk/100) × season × plan_multiplier
 *   final    = clip(round(raw) − discount, 25, 79)    [Rs.]
 * -----------------------------------------------------------------------
 */

const mlClient = require('./mlClient');

// -----------------------------------------------------------------------
// JS fallback: used when the Python ML service is not running.
// Scores match the training data in zone_risk_scorer.py.
// -----------------------------------------------------------------------
const ZONE_RISK_FALLBACK = {
  '201301': 72, '201302': 62, '201303': 85, '201304': 38, '201305': 48,
  '110001': 68, '110002': 55, '110003': 78, '110004': 32, '110005': 80,
  '122001': 42, '122002': 28, '122018': 38, '201010': 80, '201012': 70,
  '400001': 38, '400050': 62, '560001': 28, '560034': 35,
  '600001': 35, '600040': 55, '700001': 52, '700091': 60,
  '411001': 40, '500001': 38, '380001': 30, '302001': 32, '226001': 44,
};
const DEFAULT_RISK_SCORE = 55;

const PLANS = {
  basic:    { mult: 1.0, cap: 500,  hours: 10 },
  standard: { mult: 1.2, cap: 900,  hours: 18 },
  premium:  { mult: 1.5, cap: 1400, hours: 28 },
};

// -----------------------------------------------------------------------
// Internal JS helpers (fallback path only)
// -----------------------------------------------------------------------

function _getSeasonFactor() {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 9) return 1.3;
  if (month === 12 || month <= 2) return 0.9;
  return 1.0;
}

function _getTenureDiscount(tenureDays) {
  return Math.min(Math.floor(tenureDays / 30) * 2, 10);
}

function _calcPlanFallback(riskScore, tenureDays, planName) {
  const plan     = PLANS[planName];
  const season   = _getSeasonFactor();
  const discount = _getTenureDiscount(tenureDays);
  const riskAdj  = 35 * 1.2 * riskScore / 100;
  const raw      = 35 * (1 + 1.2 * riskScore / 100) * season * plan.mult;
  const final    = Math.min(Math.max(Math.round(raw) - discount, 25), 79);
  return {
    plan,
    finalPremium:    final,
    coverageCap:     plan.cap,
    maxHours:        plan.hours,
    riskAdj:         parseFloat(riskAdj.toFixed(2)),
    seasonFactor:    season,
    tenureDiscount:  discount,
  };
}

function _fallbackAllPlans(pincode, tenureDays) {
  const riskScore = ZONE_RISK_FALLBACK[String(pincode)] || DEFAULT_RISK_SCORE;
  const plans = {};
  for (const name of ['basic', 'standard', 'premium']) {
    plans[name] = _calcPlanFallback(riskScore, tenureDays, name);
  }
  return {
    pincode:       String(pincode),
    zoneRiskScore: riskScore,
    riskLevel:     getRiskLevel(riskScore),
    plans,
    source:        'js_fallback',
  };
}

// -----------------------------------------------------------------------
// Public helpers
// -----------------------------------------------------------------------

/**
 * getRiskLevel
 * Converts a numeric risk score (0-100) to a human-readable label.
 */
function getRiskLevel(score) {
  if (score < 40) return 'low';
  if (score < 60) return 'medium';
  if (score < 80) return 'high';
  return 'extreme';
}

/**
 * getZoneRiskScore
 * Returns the ML-powered zone risk score for a pincode by calling the
 * Python ML microservice. Falls back to the JS lookup table if the
 * service is unreachable.
 *
 * @param {string|number} pincode
 * @returns {Promise<number>} Risk score 0–100
 */
async function getZoneRiskScore(pincode) {
  try {
    const { data } = await mlClient.post('/zone-risk', { pincode: String(pincode) });
    return data.riskScore;  // camelCase after mlClient response interceptor
  } catch {
    // ML service is down — use JS fallback silently
    return ZONE_RISK_FALLBACK[String(pincode)] || DEFAULT_RISK_SCORE;
  }
}

/**
 * calculateAllPlans
 * Calls the Python ML service's /premium endpoint which uses the XGBoost
 * model for zone risk and applies the premium formula for all 3 plans.
 *
 * Falls back to the JS calculation if the service is unreachable.
 *
 * @param {string|number} pincode
 * @param {number}        tenureDays
 * @returns {Promise<{ pincode, zone_risk_score, risk_level, plans }>}
 */
async function calculateAllPlans(pincode, tenureDays = 0) {
  try {
    // Send snake_case body directly so mlClient's toSnake interceptor is a no-op.
    // Response is auto-converted to camelCase by the response interceptor.
    const { data } = await mlClient.post('/premium', {
      pincode:     String(pincode),
      tenure_days: tenureDays,
    });
    return {
      pincode:       String(pincode),
      zoneRiskScore: data.zoneRiskScore,  // camelCase after interceptor
      riskLevel:     getRiskLevel(data.zoneRiskScore),
      plans:         data.plans,          // plan keys are already camelCase
      source:        data.riskSource || 'ml',
    };
  } catch {
    // ML service is down — fall back to JS formula
    console.warn('[premiumService] ML service unreachable, using JS fallback');
    return _fallbackAllPlans(pincode, tenureDays);
  }
}

module.exports = {
  getZoneRiskScore,
  getRiskLevel,
  calculateAllPlans,
  PLANS,
};
