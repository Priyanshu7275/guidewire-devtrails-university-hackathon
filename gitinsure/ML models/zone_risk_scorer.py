
# GigInsure - Zone Risk Scorer
# Written by: Team GigInsure (DEVTrails 2026)
#
# WHAT THIS FILE DOES:
#   Takes 6 features about a delivery zone (pincode)
#   and predicts how risky that zone is on a scale of 0-100
#   Higher score = more risky = worker pays higher premium
#
# MODEL USED: XGBoost Regressor
#   XGBoost builds many decision trees one after another
#   Each tree tries to fix the mistakes of the previous tree
#   This is called "Gradient Boosting"
#
# NOTE: model is already pretrained and saved in models/
#       you can directly use predict functions without retraining
#       but if you want to retrain, just run this file
#
# HOW TO RUN:
#   python zone_risk_scorer.py
# 


# --- Import Libraries ---
# numpy  -> for working with numbers and arrays
# pandas -> for working with tables (like Excel in Python)
# pickle -> for saving/loading our trained model
# XGBRegressor -> the actual ML model we are using
# train_test_split -> splits data into training and testing sets
# mean_absolute_error, r2_score -> to check how good our model is

import numpy as np
import pandas as pd
import pickle
import os
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score



# PART 1 - OUR DATASET
# We made synthetic (fake but realistic) data for 15 pincodes
# in Delhi NCR based on public weather and AQI reports
# In production this would come from IMD and CPCB APIs


pincodes = [
    201301, 201302, 201303, 201304, 201305,   # Ghaziabad
    110001, 110002, 110003, 110004, 110005,   # Delhi
    122001, 122002, 122018, 201010, 201012    # Gurugram / other
]

# Feature 1: How many days it rains per year in that zone
rain_days = [
    85, 78, 90, 65, 70,
    72, 68, 75, 60, 80,
    55, 50, 58, 88, 82
]

# Feature 2: How many flood events happened in last 3 years
flood_count = [
    4, 3, 6, 1, 2,
    3, 2, 4, 1, 5,
    1, 0, 1, 5, 4
]

# Feature 3: Average AQI during monsoon (higher = worse air)
avg_aqi = [
    220, 200, 240, 160, 180,
    210, 190, 230, 150, 250,
    170, 140, 160, 230, 210
]

# Feature 4: Days where temperature crossed 43 degrees Celsius
heat_days = [
    12, 10, 15,  6,  8,
    11,  9, 13,  5, 14,
     7,  4,  6, 14, 12
]

# Feature 5: Curfew or strike events per year
curfew_count = [
    3, 2, 4, 1, 2,
    5, 4, 6, 1, 3,
    2, 1, 2, 4, 3
]

# Feature 6: Platform outage events per year
outage_count = [
     8,  7, 10,  4,  5,
     9,  6, 11,  3, 10,
     5,  3,  4,  9,  8
]

# TARGET: What we want to predict (manually assigned based on zone knowledge)
# 0 = very safe, 100 = extremely risky
risk_scores = [
    72, 62, 85, 38, 48,
    68, 55, 78, 32, 80,
    42, 28, 38, 80, 70
]

feature_cols = [
    'rain_days', 'flood_count', 'avg_aqi',
    'heat_days', 'curfew_count', 'outage_count'
]



# PART 2 - PREDICTION FUNCTIONS (USE PRETRAINED MODEL)
# These functions are what your backend will call
# The model is already trained and saved in models/ folder


def predict_risk_score(rain_days, flood_count, avg_aqi,
                        heat_days, curfew_count, outage_count):
    """
    USE THIS in your FastAPI backend like:
        score = predict_risk_score(85, 4, 220, 12, 3, 8)

    Input  : 6 feature values for a pincode
    Output : risk score between 0 and 100
    """
    with open("models/zone_risk_model.pkl", "rb") as f:
        loaded_model = pickle.load(f)

    # Model needs shape (1, 6) -- one sample, 6 features
    input_data = np.array([[rain_days, flood_count, avg_aqi,
                             heat_days, curfew_count, outage_count]])

    score = loaded_model.predict(input_data)[0]

    # Make sure result stays in range 0-100
    score = float(np.clip(score, 0, 100))
    return round(score, 2)


def get_risk_for_pincode(pincode):
    """
    USE THIS when you just have a pincode and no feature values.
    It checks a lookup table first.
    For unknown pincodes returns default score of 55.

    Input  : pincode (int)
    Output : risk score (float)
    """
    with open("models/pincode_lookup.pkl", "rb") as f:
        lookup = pickle.load(f)

    if pincode in lookup:
        return float(lookup[pincode])
    else:
        print(f"  Pincode {pincode} not in database, returning default 55")
        return 55.0



# PART 3 - TRAINING FUNCTION (ONLY RUN IF YOU WANT TO RETRAIN)
# The model is already pretrained so you don't need to run this
# But if you add new pincode data, retrain using this function


def train_and_save_model():
    """
    Trains the XGBoost model from scratch and saves it.
    Only call this if you want to retrain with new data.
    """

    print("Building dataframe...")
    df = pd.DataFrame({
        'rain_days':    rain_days,
        'flood_count':  flood_count,
        'avg_aqi':      avg_aqi,
        'heat_days':    heat_days,
        'curfew_count': curfew_count,
        'outage_count': outage_count,
        'risk_score':   risk_scores
    })

    X = df[feature_cols].values
    y = df['risk_score'].values

    # --- Data Augmentation ---
    # 15 rows is too less for ML, so we multiply data by adding noise
    # Think of it like creating slightly different versions of same data
    print("Augmenting data (15 rows -> 300 rows)...")
    aug_X, aug_y = [], []
    for _ in range(20):
        aug_X.append(X + np.random.normal(0, 2, X.shape))
        aug_y.append(y + np.random.normal(0, 1, y.shape))

    X_aug = np.vstack(aug_X)
    y_aug = np.clip(np.hstack(aug_y), 0, 100)

    # --- Train / Test Split ---
    # 80% for training, 20% for testing
    X_train, X_test, y_train, y_test = train_test_split(
        X_aug, y_aug, test_size=0.2, random_state=42
    )

    print(f"Training on {len(X_train)} samples...")

    # --- Train XGBoost ---
    # Each tree learns from the mistakes of the previous tree
    model = XGBRegressor(
        n_estimators=200,      # build 200 trees
        max_depth=4,           # each tree can go 4 levels deep
        learning_rate=0.05,    # learn slowly = more accurate
        subsample=0.8,         # use 80% data per tree (avoids overfitting)
        colsample_bytree=0.8,  # use 80% features per tree (avoids overfitting)
        random_state=42
    )
    model.fit(X_train, y_train, verbose=False)

    # --- Evaluate ---
    preds = model.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)
    r2    = r2_score(y_test, preds)
    print(f"MAE (lower is better) : {mae:.2f}")
    print(f"R2  (1.0 = perfect)   : {r2:.4f}")

    # --- Save ---
    os.makedirs("models", exist_ok=True)
    with open("models/zone_risk_model.pkl", "wb") as f:
        pickle.dump(model, f)

    pincode_lookup = dict(zip(pincodes, risk_scores))
    with open("models/pincode_lookup.pkl", "wb") as f:
        pickle.dump(pincode_lookup, f)

    print("Saved: models/zone_risk_model.pkl")
    print("Saved: models/pincode_lookup.pkl")
    return model



# PART 4 - RUN AND TEST


if __name__ == "__main__":

    print("=" * 55)
    print("Zone Risk Scorer - GigInsure")
    print("=" * 55)

    # Check if pretrained model exists
    if not os.path.exists("models/zone_risk_model.pkl"):
        print("No pretrained model found. Training now...")
        train_and_save_model()
    else:
        print("Pretrained model found in models/ folder")

    # Test prediction using 6 features
    print("\n--- Test 1: predict_risk_score() ---")
    score = predict_risk_score(
        rain_days=85,
        flood_count=4,
        avg_aqi=220,
        heat_days=12,
        curfew_count=3,
        outage_count=8
    )
    print(f"Ghaziabad 201301 risk score : {score} / 100")

    # Test pincode lookup
    print("\n--- Test 2: get_risk_for_pincode() ---")
    for pc in [201301, 110001, 122001, 999999]:
        s = get_risk_for_pincode(pc)
        print(f"  Pincode {pc} : {s} / 100")

    # Show feature importance
    print("\n--- Feature Importance (which feature matters most) ---")
    with open("models/zone_risk_model.pkl", "rb") as f:
        m = pickle.load(f)
    for feat, imp in zip(feature_cols, m.feature_importances_):
        bar = "█" * int(imp * 60)
        print(f"  {feat:20} {bar} ({imp:.3f})")
