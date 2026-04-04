
# GigInsure - Dynamic Premium Calculator
# Written by: Team GigInsure (DEVTrails 2026)
#
# WHAT THIS FILE DOES:
#   Calculates how much a worker pays per week for insurance
#   Uses the risk score from zone_risk_scorer.py as input
#   This is a formula-based model (not ML) but uses ML output
#
# FORMULA:
#   Premium = BASE x (1 + 1.2 x zone_score/100) x season x plan - discount
#
# HOW TO RUN:
#   python premium_calculator.py
# 


# We only need datetime here - no ML libraries needed
# The ML part already happened in zone_risk_scorer.py
from datetime import date



# PART 1 - FIXED VALUES (business decisions)
# These numbers were decided by our team based on
# what makes the platform financially viable


BASE_PREMIUM    = 35.0   # every worker starts at Rs 35/week
RISK_MULTIPLIER = 1.2    # how strongly zone risk affects price
MIN_PREMIUM     = 25.0   # cheapest possible premium
MAX_PREMIUM     = 79.0   # most expensive possible premium
MAX_DISCOUNT    = 10.0   # max loyalty discount is Rs 10



# PART 2 - THE 3 INSURANCE PLANS
# Each plan has a cost multiplier and different coverage


plans = {
    'basic': {
        'multiplier':  1.00,
        'max_payout':  500,    # max Rs 500 payout per claim
        'max_hours':   10,     # covers upto 10 hours of disruption
    },
    'standard': {
        'multiplier':  1.20,   # 20% more expensive than basic
        'max_payout':  900,
        'max_hours':   18,
    },
    'premium': {
        'multiplier':  1.50,   # 50% more expensive than basic
        'max_payout':  1400,
        'max_hours':   28,
    }
}


 
# PART 3 - SEASON FACTOR FUNCTION
# More risk during monsoon = higher price
# Less disruptions in winter = lower price


def get_season_factor(month=None):
    """
    Returns a multiplier based on current month.
    If you don't pass a month, it uses today's month.

    Monsoon (Jun-Sep) -> 1.3  (30% more expensive)
    Winter  (Dec-Feb) -> 0.9  (10% cheaper)
    Other months      -> 1.0  (normal price)
    """
    if month is None:
        month = date.today().month

    monsoon = [6, 7, 8, 9]    # June to September
    winter  = [12, 1, 2]      # December to February

    if month in monsoon:
        return 1.3
    elif month in winter:
        return 0.9
    else:
        return 1.0



# PART 4 - TENURE DISCOUNT FUNCTION
# Workers who stay longer get a small reward
# Rs 2 discount per month, maximum Rs 10


def get_tenure_discount(tenure_days):
    """
    tenure_days = how many days the worker has been registered

    Example:
      30 days  = 1 month  = Rs 2 discount
      90 days  = 3 months = Rs 6 discount
      150 days = 5 months = Rs 10 discount (maximum)
      200 days = 6 months = Rs 10 discount (still max, capped)
    """
    months_completed = tenure_days // 30    # integer division
    discount = months_completed * 2.0       # Rs 2 per month

    # Cap at maximum allowed discount
    discount = min(discount, MAX_DISCOUNT)
    return discount



# PART 5 - MAIN PREMIUM FORMULA
# This is the core function your backend will call
# It uses zone_risk_score from zone_risk_scorer.py


def calculate_premium(zone_risk_score, plan_name, tenure_days=0, month=None):
    """
    USE THIS in your FastAPI backend like:
        result = calculate_premium(72.0, 'standard', tenure_days=90)
        print(result['final_premium'])  # Rs 52.0

    zone_risk_score : score from zone_risk_scorer.py (0 to 100)
    plan_name       : 'basic', 'standard', or 'premium'
    tenure_days     : how many days worker has been registered
    month           : month number (1-12), defaults to current month

    Returns a dict with full breakdown so frontend can show it
    """

    # Get all the adjustment factors
    season_factor   = get_season_factor(month)
    tenure_discount = get_tenure_discount(tenure_days)
    plan_multiplier = plans[plan_name]['multiplier']

    # Step by step so it's easy to understand and debug
    # Step 1: Start with base
    after_base = BASE_PREMIUM

    # Step 2: Add zone risk adjustment
    # zone_score of 0   -> multiply by 1.0  (no change)
    # zone_score of 50  -> multiply by 1.6
    # zone_score of 100 -> multiply by 2.2
    after_risk = after_base * (1 + RISK_MULTIPLIER * zone_risk_score / 100)

    # Step 3: Apply seasonal multiplier
    after_season = after_risk * season_factor

    # Step 4: Apply plan multiplier
    after_plan = after_season * plan_multiplier

    # Step 5: Subtract loyalty discount
    after_discount = after_plan - tenure_discount

    # Step 6: Clamp between min and max allowed
    final = max(MIN_PREMIUM, min(MAX_PREMIUM, after_discount))
    final = round(final, 2)

    return {
        'plan':              plan_name,
        'zone_risk_score':   zone_risk_score,
        'base_premium':      after_base,
        'after_risk':        round(after_risk, 2),
        'season_factor':     season_factor,
        'after_season':      round(after_season, 2),
        'plan_multiplier':   plan_multiplier,
        'after_plan':        round(after_plan, 2),
        'tenure_discount':   tenure_discount,
        'final_premium':     final,
        'coverage_cap':      plans[plan_name]['max_payout'],
        'max_hours':         plans[plan_name]['max_hours'],
    }


def calculate_all_plans(zone_risk_score, tenure_days=0, month=None):
    """
    USE THIS to get premium for all 3 plans at once.
    Your insurance selection screen needs this to show all 3 cards.
    """
    return {
        plan: calculate_premium(zone_risk_score, plan, tenure_days, month)
        for plan in ['basic', 'standard', 'premium']
    }



# PART 6 - PAYOUT CALCULATOR
# Once a claim is approved, how much do we pay the worker?
#
# FORMULA:
#   Payout = min(daily_income x disruption_hours / 8, coverage_cap)
#
# Why divide by 8? Because a work day = 8 hours
# So if disruption was 2 hours, worker loses 2/8 = 25% of daily income


def calculate_payout(daily_income, disruption_hours, plan_name):
    """
    USE THIS in your claims pipeline after fraud check passes.

    daily_income      : worker's declared average daily earnings in Rs
    disruption_hours  : how long the disruption lasted (verified)
    plan_name         : worker's active plan

    Returns payout amount in Rs
    """
    coverage_cap = plans[plan_name]['max_payout']

    # How much income did they lose?
    income_lost = daily_income * (disruption_hours / 8)

    # Can't pay more than their plan allows
    final_payout = min(income_lost, coverage_cap)
    final_payout = round(final_payout, 2)

    return {
        'daily_income':     daily_income,
        'disruption_hours': disruption_hours,
        'income_lost':      round(income_lost, 2),
        'coverage_cap':     coverage_cap,
        'final_payout':     final_payout,
        'was_capped':       income_lost > coverage_cap,
    }



# PART 7 - TEST IT


if __name__ == "__main__":

    print("=" * 55)
    print("Premium Calculator - GigInsure")
    print("=" * 55)

    # Test: Ravi Kumar in Ghaziabad 201301
    # Zone risk score comes from zone_risk_scorer.py
    zone_score  = 72.0
    tenure_days = 90      # 3 months registered

    print(f"\nWorker : Ravi Kumar, Ghaziabad 201301")
    print(f"Zone Risk Score : {zone_score}")
    print(f"Tenure          : {tenure_days} days = {tenure_days//30} months")
    print(f"Season Factor   : {get_season_factor()}")
    print(f"Tenure Discount : Rs {get_tenure_discount(tenure_days)}")

    print("\n--- Premiums for all 3 plans ---")
    all_plans = calculate_all_plans(zone_score, tenure_days)
    for plan_name, details in all_plans.items():
        print(f"\n  {plan_name.upper()} SHIELD")
        print(f"    Base          : Rs {details['base_premium']}")
        print(f"    After risk    : Rs {details['after_risk']}")
        print(f"    After season  : Rs {details['after_season']}")
        print(f"    After plan    : Rs {details['after_plan']}")
        print(f"    After discount: Rs {details['final_premium']}  <- FINAL")
        print(f"    Coverage cap  : Rs {details['coverage_cap']}")

    print("\n--- Payout Example ---")
    payout = calculate_payout(
        daily_income=600,
        disruption_hours=3.5,
        plan_name='standard'
    )
    print(f"  Daily income     : Rs {payout['daily_income']}")
    print(f"  Disruption hours : {payout['disruption_hours']} hrs")
    print(f"  Income lost      : Rs {payout['income_lost']}")
    print(f"  Coverage cap     : Rs {payout['coverage_cap']}")
    print(f"  Final payout     : Rs {payout['final_payout']}")
    print(f"  Was capped       : {payout['was_capped']}")
