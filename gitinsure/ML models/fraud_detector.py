
# GigInsure - Fraud Detector



import numpy as np
import pandas as pd
import pickle
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime


# ============================================================
# PART 1 - FRAUD SCORE THRESHOLDS
# These decide what action to take on each claim
# ============================================================

THRESHOLD_AUTO_APPROVE  = 0.35
THRESHOLD_SOFT_HOLD     = 0.65
THRESHOLD_MANUAL_REVIEW = 0.85
# above 0.85 -> auto reject



# PART 2 - FEATURES WE USE FOR FRAUD DETECTION
# These 7 signals help us identify suspicious claims
# We don't use GPS (web platform) so we use session behavior


# claim_hour             : what hour of day did they claim? (0-23)
#                          fraud rings often claim at odd hours (1am, 2am)
#
# claims_last_7_days     : how many claims in past 7 days?
#                          genuine workers rarely claim more than 2-3 times
#
# zone_claims_last_10min : how many claims from same zone in last 10 min?
#                          a real rain event has maybe 5-8 workers claiming
#                          a fraud ring has 30-50 workers claiming together
#
# session_active_minutes : how long was their web session before claiming?
#                          genuine workers have longer sessions (logged in, working)
#                          fraudsters open app quickly just to claim (1-2 min session)
#
# pincode_match          : 1 if worker's registered pincode = trigger zone pincode
#                          0 if they registered in Delhi but claiming for Ghaziabad event
#
# claim_interval_hours   : how many hours since their last claim?
#                          genuine: 48-200 hours (not too frequent)
#                          fraud: 1-5 hours (claiming again and again)
#
# device_flag            : 1 if browser fingerprint looks suspicious
#                          (unusual headers, automated browser, VPN detected)

FEATURE_COLS = [
    'claim_hour',
    'claims_last_7_days',
    'zone_claims_last_10min',
    'session_active_minutes',
    'pincode_match',
    'claim_interval_hours',
    'device_flag',
]



# PART 3 - GENERATE TRAINING DATA
# We create synthetic genuine and fraud claim records
# Isolation Forest only trains on genuine data
# It learns what "normal" looks like
# Then anything that doesn't look normal = fraud


def generate_training_data(n_genuine=500, n_fraud=50):
    """
    Creates fake claim records for training.
    genuine = normal patterns (what real workers do)
    fraud   = abnormal patterns (what fraudsters do)
    """
    np.random.seed(42)

    # Genuine claim patterns
    genuine = pd.DataFrame({
        'claim_hour':             np.random.randint(7, 22, n_genuine),    # daytime hours
        'claims_last_7_days':     np.random.randint(0, 3, n_genuine),     # 0-2 claims
        'zone_claims_last_10min': np.random.randint(0, 8, n_genuine),     # few claims
        'session_active_minutes': np.random.uniform(10, 120, n_genuine),  # logged in a while
        'pincode_match':          np.ones(n_genuine),                     # always matches
        'claim_interval_hours':   np.random.uniform(24, 200, n_genuine),  # not too frequent
        'device_flag':            np.random.choice([0,1], n_genuine, p=[0.95, 0.05]),
        'label': np.zeros(n_genuine),   # 0 = genuine
    })

    # Fraud claim patterns (Telegram syndicate behavior)
    fraud = pd.DataFrame({
        'claim_hour':             np.random.randint(0, 6, n_fraud),       # late night
        'claims_last_7_days':     np.random.randint(5, 15, n_fraud),      # many claims
        'zone_claims_last_10min': np.random.randint(20, 50, n_fraud),     # mass claims
        'session_active_minutes': np.random.uniform(0.5, 3.0, n_fraud),   # very short session
        'pincode_match':          np.random.choice([0,1], n_fraud, p=[0.6, 0.4]),
        'claim_interval_hours':   np.random.uniform(0.1, 5.0, n_fraud),   # claiming too fast
        'device_flag':            np.random.choice([0,1], n_fraud, p=[0.3, 0.7]),
        'label': np.ones(n_fraud),   # 1 = fraud
    })

    # Mix genuine and fraud, shuffle randomly
    combined = pd.concat([genuine, fraud], ignore_index=True)
    combined = combined.sample(frac=1, random_state=42).reset_index(drop=True)
    return combined



# PART 4 - SCORE NORMALIZATION
# Isolation Forest gives raw scores (negative numbers)
# More negative = more anomalous = more likely fraud
# We convert these to a 0-1 scale using sigmoid function


def normalize_to_fraud_probability(raw_scores):
    """
    Converts Isolation Forest raw scores to 0-1 fraud probability.

    sigmoid formula: 1 / (1 + e^(5 * raw_score))
    - raw_score very negative -> output close to 1.0 (high fraud)
    - raw_score close to 0    -> output close to 0.5 (uncertain)
    - raw_score positive      -> output close to 0.0 (genuine)
    """
    return 1 / (1 + np.exp(5 * raw_scores))



# PART 5 - DECISION FUNCTION
# Maps fraud score to an action


def get_decision(fraud_score):
    """
    Input  : fraud score between 0 and 1
    Output : decision string and reason message
    """
    if fraud_score <= THRESHOLD_AUTO_APPROVE:
        decision = "AUTO_APPROVE"
        reason   = "All signals look normal. Payout initiated automatically."

    elif fraud_score <= THRESHOLD_SOFT_HOLD:
        decision = "SOFT_HOLD"
        reason   = "Some unusual signals. Could be network drop in bad weather. Re-checking in 10 min."

    elif fraud_score <= THRESHOLD_MANUAL_REVIEW:
        decision = "MANUAL_REVIEW"
        reason   = "Multiple anomalous signals. Flagged for admin review within 2 hours."

    else:
        decision = "AUTO_REJECT"
        reason   = "Very high fraud probability. Claim rejected. Account flagged."

    return decision, reason



# PART 6 - TRAINING FUNCTION (ONLY RUN IF YOU WANT TO RETRAIN)
# Model is already pretrained and saved in models/


def train_and_save_model():
    """
    Trains Isolation Forest on genuine claims only.
    Saves model and scaler to models/ folder.
    Only call this if you want to retrain with new data.
    """
    print("Generating training data...")
    df = generate_training_data(n_genuine=500, n_fraud=50)

    # Train ONLY on genuine claims (that's how Isolation Forest works)
    # It learns what normal looks like, then flags anything abnormal
    genuine_only = df[df['label'] == 0][FEATURE_COLS].values

    # StandardScaler makes all features have mean=0, std=1
    # This is important so no single feature dominates
    scaler = StandardScaler()
    genuine_scaled = scaler.fit_transform(genuine_only)

    print("Training Isolation Forest...")
    # contamination=0.05 means we expect about 5% of production claims to be fraud
    model = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42
    )
    model.fit(genuine_scaled)

    # Quick check on full dataset
    X_all    = scaler.transform(df[FEATURE_COLS].values)
    raw      = model.decision_function(X_all)
    scores   = normalize_to_fraud_probability(raw)
    preds    = (scores > THRESHOLD_AUTO_APPROVE).astype(int)
    labels   = df['label'].values

    tp = ((preds==1) & (labels==1)).sum()
    fp = ((preds==1) & (labels==0)).sum()
    fn = ((preds==0) & (labels==1)).sum()

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0

    print(f"Precision : {precision:.2%}")
    print(f"Recall    : {recall:.2%}")

    os.makedirs("models", exist_ok=True)
    with open("models/fraud_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("models/fraud_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    print("Saved: models/fraud_model.pkl")
    print("Saved: models/fraud_scaler.pkl")



# PART 7 - MAIN SCORING FUNCTION
# This is what your backend will call for every claim

def score_claim(claim_id, claim_hour, claims_last_7_days,
                zone_claims_last_10min, session_active_minutes,
                pincode_match, claim_interval_hours, device_flag):
    """
    USE THIS in your FastAPI backend like:
        result = score_claim(
            claim_id='CLM_001',
            claim_hour=14,
            claims_last_7_days=1,
            zone_claims_last_10min=4,
            session_active_minutes=45.0,
            pincode_match=1,
            claim_interval_hours=96.0,
            device_flag=0
        )
        print(result['decision'])      # AUTO_APPROVE
        print(result['fraud_score'])   # 0.18

    Returns a dict with fraud_score, decision, and reason
    """
    # Load pretrained model and scaler
    with open("models/fraud_model.pkl", "rb") as f:
        model = pickle.load(f)
    with open("models/fraud_scaler.pkl", "rb") as f:
        scaler = pickle.load(f)

    # Put all 7 features into a 2D array (model needs this shape)
    features = np.array([[
        claim_hour,
        claims_last_7_days,
        zone_claims_last_10min,
        session_active_minutes,
        pincode_match,
        claim_interval_hours,
        device_flag,
    ]])

    # Scale features using the same scaler used during training
    features_scaled = scaler.transform(features)

    # Get raw anomaly score from model
    raw_score = model.decision_function(features_scaled)[0]

    # Convert to 0-1 fraud probability
    fraud_score = float(normalize_to_fraud_probability(np.array([raw_score]))[0])
    fraud_score = round(fraud_score, 4)

    # Get decision based on score
    decision, reason = get_decision(fraud_score)

    return {
        'claim_id':    claim_id,
        'fraud_score': fraud_score,
        'decision':    decision,
        'reason':      reason,
        'checked_at':  datetime.utcnow().isoformat(),
    }



# PART 8 - COMBINED FRAUD FORMULA (weighted score)
# This combines 4 different fraud signals
# Based on our formula: F = 0.35*isolation + 0.25*mobility + 0.20*device + 0.20*ring

def combined_fraud_score(s_isolation, s_mobility, s_device, s_ring):
    """
    Combines 4 sub-scores into one final fraud score.

    s_isolation : score from Isolation Forest (this file)
    s_mobility  : score from login/session behavior (0-1)
    s_device    : score from browser fingerprint check (0-1)
    s_ring      : score from zone-level claim spike (0-1)
    """
    score = (0.35 * s_isolation +
             0.25 * s_mobility  +
             0.20 * s_device    +
             0.20 * s_ring)

    score = round(float(np.clip(score, 0, 1)), 4)
    return score



# PART 9 - TEST IT


if __name__ == "__main__":

    print("=" * 55)
    print("Fraud Detector - GigInsure")
    print("=" * 55)

    # Check if pretrained model exists
    if not os.path.exists("models/fraud_model.pkl"):
        print("No pretrained model found. Training now...")
        train_and_save_model()
    else:
        print("Pretrained model found in models/ folder")

    print("\n--- Scoring 3 Test Claims ---\n")

    test_cases = [
        {
            'label':                   'GENUINE WORKER (normal pattern)',
            'claim_id':                'CLM_001',
            'claim_hour':              14,       # 2pm, normal working hour
            'claims_last_7_days':      1,        # only 1 claim this week
            'zone_claims_last_10min':  4,        # few others also claiming
            'session_active_minutes':  45.0,     # was logged in for 45 min
            'pincode_match':           1,        # pincode matches trigger zone
            'claim_interval_hours':    96.0,     # last claim was 4 days ago
            'device_flag':             0,        # normal browser
        },
        {
            'label':                   'FRAUD (syndicate pattern)',
            'claim_id':                'CLM_002',
            'claim_hour':              3,        # 3am - suspicious!
            'claims_last_7_days':      8,        # claimed 8 times this week!
            'zone_claims_last_10min':  35,       # 35 people claiming at once!
            'session_active_minutes':  1.2,      # only 1 min session
            'pincode_match':           0,        # pincode doesn't match
            'claim_interval_hours':    2.0,      # claiming again after 2 hours!
            'device_flag':             1,        # flagged browser
        },
        {
            'label':                   'BORDERLINE (genuine but bad weather signal loss)',
            'claim_id':                'CLM_003',
            'claim_hour':              20,       # 8pm, a bit late
            'claims_last_7_days':      3,        # 3 claims this week (on higher side)
            'zone_claims_last_10min':  12,       # 12 people claiming
            'session_active_minutes':  8.0,      # short session (bad weather = less active)
            'pincode_match':           1,
            'claim_interval_hours':    18.0,     # 18 hrs since last claim
            'device_flag':             0,
        },
    ]

    for tc in test_cases:
        label = tc.pop('label')
        result = score_claim(**tc)
        print(f"  [{label}]")
        print(f"    Fraud Score : {result['fraud_score']}")
        print(f"    Decision    : {result['decision']}")
        print(f"    Reason      : {result['reason']}")
        print()

    print("--- Combined Score Formula Test ---")
    final = combined_fraud_score(
        s_isolation=0.72,
        s_mobility=0.80,
        s_device=0.90,
        s_ring=0.95,
    )
    decision, reason = get_decision(final)
    print(f"  Combined F_score : {final}")
    print(f"  Decision         : {decision}")
    print(f"  Reason           : {reason}")
