import os, pickle, numpy as np
from datetime import date

_here      = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(_here, "..", "ml", "models")
# Fallback: .pkl files in same folder as backend/
if not os.path.exists(os.path.join(MODELS_DIR, "zone_model.pkl")):
    MODELS_DIR = _here

def _load(f):
    with open(os.path.join(MODELS_DIR, f), "rb") as fh:
        return pickle.load(fh)

try:
    ZONE_MODEL    = _load("zone_model.pkl")
    PINCODE_TABLE = _load("pincode_lookup.pkl")
    FRAUD_MODEL   = _load("fraud_model.pkl")
    FRAUD_SCALER  = _load("fraud_scaler.pkl")
    print("✓ All ML models loaded")
except Exception as e:
    print(f"✗ ML model load error: {e}")
    ZONE_MODEL = PINCODE_TABLE = FRAUD_MODEL = FRAUD_SCALER = None

PLANS = {
    "basic":    {"mult": 1.00, "cap": 500,  "hours": 10},
    "standard": {"mult": 1.20, "cap": 900,  "hours": 18},
    "premium":  {"mult": 1.50, "cap": 1400, "hours": 28},
}
BASE_PREM, RISK_ALPHA, MIN_PREM, MAX_PREM = 35.0, 1.2, 25.0, 79.0
TRIGGER_HOURS = {"heavy_rain":2.5,"extreme_heat":4.0,"dangerous_aqi":6.0,"curfew":8.0,"platform_outage":1.5}

def get_zone_risk(pincode: int) -> float:
    if PINCODE_TABLE and pincode in PINCODE_TABLE:
        return float(PINCODE_TABLE[pincode])
    if ZONE_MODEL:
        feat = np.array([[72, 3, 200, 10, 3, 7]])
        return round(float(np.clip(ZONE_MODEL.predict(feat)[0], 0, 100)), 2)
    return 55.0

def calc_premium(pincode: int, plan: str, tenure_days: int = 0) -> dict:
    zone_risk = get_zone_risk(pincode)
    month = date.today().month
    season = 1.3 if month in [6,7,8,9] else 0.9 if month in [12,1,2] else 1.0
    discount = min((tenure_days // 30) * 2.0, 10.0)
    raw   = BASE_PREM * (1 + RISK_ALPHA * zone_risk / 100) * season * PLANS[plan]["mult"] - discount
    final = round(float(np.clip(raw, MIN_PREM, MAX_PREM)), 2)
    return {"plan":plan,"zone_risk_score":zone_risk,"base":BASE_PREM,
            "risk_adj":round(BASE_PREM*RISK_ALPHA*zone_risk/100,2),
            "season_factor":season,"tenure_discount":discount,
            "final_premium":final,"coverage_cap":PLANS[plan]["cap"],"max_hours":PLANS[plan]["hours"]}

def calc_all_plans(pincode: int, tenure_days: int = 0) -> dict:
    return {p: calc_premium(pincode, p, tenure_days) for p in ["basic","standard","premium"]}

def get_fraud_score(claim_hour, claims_7d, zone_10min, session_min, pincode_match, interval_hrs, device_flag) -> float:
    if FRAUD_MODEL is None or FRAUD_SCALER is None:
        return 0.15
    feat   = np.array([[claim_hour, claims_7d, zone_10min, session_min, pincode_match, interval_hrs, device_flag]])
    scaled = FRAUD_SCALER.transform(feat)
    raw    = FRAUD_MODEL.decision_function(scaled)[0]
    return round(float(1 / (1 + np.exp(5 * raw))), 4)

def fraud_decision(score: float) -> tuple:
    if score <= 0.35: return "AUTO_APPROVE", "All signals verified. Payout initiated."
    elif score <= 0.65: return "SOFT_HOLD", "Verifying your location. Payout in 10 minutes."
    elif score <= 0.85: return "MANUAL_REVIEW", "Flagged for review. Decision within 2 hours."
    else: return "AUTO_REJECT", "Claim rejected. Contact support if genuine."

def calc_payout(daily_income: float, trigger_type: str, plan: str, actual_hours: float = None) -> float:
    hours = actual_hours if actual_hours else TRIGGER_HOURS.get(trigger_type, 2.5)
    hours = min(hours, PLANS[plan]["hours"])
    return round(min(daily_income * (hours / 8), PLANS[plan]["cap"]), 2)
