"""
ml_api.py  —  GigInsure ML Microservice
=========================================
A lightweight FastAPI server that exposes your trained .pkl models
over HTTP so the Node.js backend can call them.

Runs on port 5001 (separate from the main Express server on 5000).

Start it with:
    cd gitinsure
    uvicorn ml_api:app --port 5001 --reload

Endpoints:
    GET  /health          — check that models loaded correctly
    POST /zone-risk       — XGBoost zone risk score for a pincode
    POST /premium         — full premium breakdown (all 3 plans)
    POST /fraud           — Isolation Forest fraud score for a claim
"""

import os
import pickle
import numpy as np
from datetime import date
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="GigInsure ML API", version="1.0.0")

# Allow the Node.js backend (localhost:5000) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model loading ──────────────────────────────────────────────────────────────
# All .pkl files are in the same folder as this script (gitinsure/).
_HERE = os.path.dirname(os.path.abspath(__file__))

def _load_pkl(filename):
    """Loads a pickle file from the gitinsure/ folder. Returns None on failure."""
    path = os.path.join(_HERE, filename)
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        print(f"  [ML API] Could not load {filename}: {e}")
        return None

# Load all four models at startup.
# If a file is missing the endpoint will fall back to a sensible default.
print("[ML API] Loading models...")
ZONE_MODEL     = _load_pkl("zone_model.pkl")       # XGBoost regressor
PINCODE_LOOKUP = _load_pkl("pincode_lookup.pkl")   # {pincode_int: risk_score}
FRAUD_MODEL    = _load_pkl("fraud_model.pkl")      # Isolation Forest
FRAUD_SCALER   = _load_pkl("fraud_scaler.pkl")     # StandardScaler

loaded = sum(m is not None for m in [ZONE_MODEL, PINCODE_LOOKUP, FRAUD_MODEL, FRAUD_SCALER])
print(f"[ML API] {loaded}/4 models loaded successfully.")

# ── Plan configuration (mirrors premium_calculator.py) ────────────────────────
PLANS = {
    "basic":    {"multiplier": 1.00, "cap": 500,  "hours": 10},
    "standard": {"multiplier": 1.20, "cap": 900,  "hours": 18},
    "premium":  {"multiplier": 1.50, "cap": 1400, "hours": 28},
}
BASE_PREMIUM    = 35.0
RISK_MULTIPLIER = 1.2
MIN_PREMIUM     = 25.0
MAX_PREMIUM     = 79.0

# ── Request / Response schemas ─────────────────────────────────────────────────

class ZoneRiskRequest(BaseModel):
    pincode: str           # 6-digit Indian pincode (sent as string)

class PremiumRequest(BaseModel):
    pincode:     str
    tenure_days: int = 0   # days the worker has been registered

class FraudRequest(BaseModel):
    # The 7 features your Isolation Forest was trained on (see fraud_detector.py)
    claim_hour:              int    # 0-23
    claims_last_7_days:      int    # how many claims this worker filed in 7 days
    zone_claims_last_10min:  int    # how many claims in same pincode in last 10 min
    session_active_minutes:  float  # how long they were logged in before claiming
    pincode_match:           int    # 1 = GPS matches registered zone, 0 = mismatch
    claim_interval_hours:    float  # hours since their previous claim (999 if first)
    device_flag:             int    # 1 = suspicious browser fingerprint, 0 = normal

# ── Helper functions ───────────────────────────────────────────────────────────

def _get_zone_risk(pincode: str) -> tuple[float, str]:
    """
    Returns (risk_score, source) for a pincode.

    Priority:
      1. Pincode lookup table (fast, exact match)
      2. XGBoost model with default zone features
      3. Hardcoded fallback of 55.0
    """
    # Try exact lookup first
    if PINCODE_LOOKUP is not None:
        score = PINCODE_LOOKUP.get(int(pincode)) or PINCODE_LOOKUP.get(str(pincode))
        if score is not None:
            return float(score), "lookup"

    # Fall back to XGBoost model with default regional features
    if ZONE_MODEL is not None:
        # Default features representing a medium-risk urban zone.
        # In production these would come from real-time weather / CPCB APIs.
        default_features = np.array([[72, 3, 200, 10, 3, 7]])
        score = float(np.clip(ZONE_MODEL.predict(default_features)[0], 0, 100))
        return round(score, 2), "model_default"

    # Last resort
    return 55.0, "fallback"


def _get_season_factor(month: int = None) -> float:
    """Returns seasonal premium multiplier. Mirrors premium_calculator.py logic."""
    m = month or date.today().month
    if m in [6, 7, 8, 9]:   return 1.3   # monsoon
    if m in [12, 1, 2]:     return 0.9   # winter
    return 1.0


def _get_tenure_discount(tenure_days: int) -> float:
    """Rs.2 discount per completed month, capped at Rs.10."""
    months = tenure_days // 30
    return min(months * 2.0, 10.0)


def _calc_premium_for_plan(risk_score: float, tenure_days: int, plan_name: str) -> dict:
    """Applies the premium formula for one plan tier."""
    plan          = PLANS[plan_name]
    season        = _get_season_factor()
    discount      = _get_tenure_discount(tenure_days)
    risk_adj      = BASE_PREMIUM * RISK_MULTIPLIER * risk_score / 100

    raw           = BASE_PREMIUM * (1 + RISK_MULTIPLIER * risk_score / 100) * season * plan["multiplier"]
    final         = round(float(np.clip(raw - discount, MIN_PREMIUM, MAX_PREMIUM)), 2)

    return {
        "plan":           plan_name,
        "final_premium":  final,
        "coverage_cap":   plan["cap"],
        "max_hours":      plan["hours"],
        "risk_adj":       round(risk_adj, 2),
        "season_factor":  season,
        "tenure_discount": discount,
    }


def _fraud_score_from_model(features: list) -> float:
    """
    Runs features through the Isolation Forest and returns a 0–1 fraud
    probability using the sigmoid normalisation from fraud_detector.py.
    """
    if FRAUD_MODEL is None or FRAUD_SCALER is None:
        return 0.15   # safe default when models are not loaded

    feat_array = np.array([features])
    scaled     = FRAUD_SCALER.transform(feat_array)
    raw        = FRAUD_MODEL.decision_function(scaled)[0]

    # Sigmoid: more negative raw → closer to 1.0 (more anomalous = more likely fraud)
    score = float(1 / (1 + np.exp(5 * raw)))
    return round(score, 4)


def _fraud_decision(score: float) -> tuple[str, str]:
    """Maps a fraud probability to a decision string (mirrors fraud_detector.py)."""
    if score <= 0.35:
        return "AUTO_APPROVE", "All signals look normal. Payout initiated automatically."
    elif score <= 0.65:
        return "SOFT_HOLD", "Some unusual signals. Re-checking in 10 minutes."
    elif score <= 0.85:
        return "MANUAL_REVIEW", "Multiple anomalous signals. Flagged for admin review within 2 hours."
    else:
        return "AUTO_REJECT", "Very high fraud probability. Claim rejected. Contact support."


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Quick status check so Node.js can confirm the ML service is alive."""
    return {
        "status": "ok",
        "models": {
            "zone_model":     ZONE_MODEL     is not None,
            "pincode_lookup": PINCODE_LOOKUP is not None,
            "fraud_model":    FRAUD_MODEL    is not None,
            "fraud_scaler":   FRAUD_SCALER   is not None,
        }
    }


@app.post("/zone-risk")
def zone_risk(req: ZoneRiskRequest):
    """
    Returns the XGBoost zone risk score for a pincode (0–100).
    Node.js calls this during worker registration and premium calculation.
    """
    score, source = _get_zone_risk(req.pincode)
    risk_level = (
        "low" if score < 40 else
        "medium" if score < 60 else
        "high" if score < 80 else
        "extreme"
    )
    return {
        "pincode":     req.pincode,
        "risk_score":  score,
        "risk_level":  risk_level,
        "source":      source,   # "lookup", "model_default", or "fallback"
    }


@app.post("/premium")
def premium(req: PremiumRequest):
    """
    Calculates weekly premiums for all 3 plans using the XGBoost risk score.
    Node.js calls this from the register flow and premium/calculate route.
    """
    risk_score, source = _get_zone_risk(req.pincode)

    plans = {
        plan: _calc_premium_for_plan(risk_score, req.tenure_days, plan)
        for plan in ["basic", "standard", "premium"]
    }

    return {
        "pincode":         req.pincode,
        "zone_risk_score": risk_score,
        "risk_source":     source,
        "tenure_days":     req.tenure_days,
        "plans":           plans,
    }


@app.post("/fraud")
def fraud(req: FraudRequest):
    """
    Runs the Isolation Forest fraud detector on 7 behavioral features.
    Node.js calls this from claims/initiate after collecting claim metadata.

    The 7 features must be in the same order the model was trained on
    (see fraud_detector.py FEATURE_COLS):
      claim_hour, claims_last_7_days, zone_claims_last_10min,
      session_active_minutes, pincode_match, claim_interval_hours, device_flag
    """
    features = [
        req.claim_hour,
        req.claims_last_7_days,
        req.zone_claims_last_10min,
        req.session_active_minutes,
        req.pincode_match,
        req.claim_interval_hours,
        req.device_flag,
    ]

    fraud_score          = _fraud_score_from_model(features)
    decision, reason     = _fraud_decision(fraud_score)

    return {
        "fraud_score": fraud_score,
        "decision":    decision,
        "reason":      reason,
        "features_used": {
            "claim_hour":             req.claim_hour,
            "claims_last_7_days":     req.claims_last_7_days,
            "zone_claims_last_10min": req.zone_claims_last_10min,
            "session_active_minutes": req.session_active_minutes,
            "pincode_match":          req.pincode_match,
            "claim_interval_hours":   req.claim_interval_hours,
            "device_flag":            req.device_flag,
        }
    }
