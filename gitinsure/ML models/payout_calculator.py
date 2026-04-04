
# GigInsure - Payout Calculator
# Written by: Team GigInsure (DEVTrails 2026)
#
# WHAT THIS FILE DOES:
#   After a trigger fires and fraud check passes,
#   this calculates exactly how much money to pay the worker
#
# FORMULA:
#   Payout = min(daily_income x disruption_hours / 8, coverage_cap)
#
# WHY DIVIDE BY 8?
#   A full work day = 8 hours
#   If disruption was 4 hours = worker lost 4/8 = 50% of daily income
#   If disruption was 2 hours = worker lost 2/8 = 25% of daily income
#
# HOW TO RUN:
#   python payout_calculator.py
# 


# No ML libraries needed here
# Just basic Python math
from datetime import datetime



# PART 1 - PLAN COVERAGE LIMITS
# Each plan has a maximum payout and maximum hours covered


PLAN_DETAILS = {
    'basic': {
        'max_payout': 500,     # maximum Rs 500 per claim
        'max_hours':  10,      # covers up to 10 hours of disruption
    },
    'standard': {
        'max_payout': 900,
        'max_hours':  18,
    },
    'premium': {
        'max_payout': 1400,
        'max_hours':  28,
    }
}

# Minimum payout - not worth processing very tiny amounts
MIN_PAYOUT = 50.0   # Rs



# PART 2 - DEFAULT DISRUPTION DURATIONS
# If we don't know exactly how long a disruption lasted,
# we use these default estimates per trigger type


DEFAULT_HOURS = {
    'heavy_rain':      2.5,   # heavy rain events typically last 2-3 hours
    'extreme_heat':    4.0,   # heat advisories last half day
    'dangerous_aqi':   6.0,   # AQI events persist for hours
    'curfew':          8.0,   # curfew = full work day lost
    'platform_outage': 1.5,   # outages are usually shorter
}



# PART 3 - MAIN PAYOUT FUNCTION
# This is what your backend will call after fraud check passes


def calculate_payout(claim_id, worker_id, daily_income,
                     plan_name, trigger_type, actual_hours=None):
    """
    USE THIS in your FastAPI backend after fraud_detector approves a claim.

    claim_id      : unique ID for this claim (e.g. 'CLM_001')
    worker_id     : unique ID of the worker (e.g. 'WRK_101')
    daily_income  : worker's declared average daily earnings in Rs
    plan_name     : 'basic', 'standard', or 'premium'
    trigger_type  : which disruption fired (e.g. 'heavy_rain')
    actual_hours  : how long disruption lasted (if known from API)
                    if None, we use the default for that trigger type

    Returns a dict with payout details
    """

    # Validate plan name
    if plan_name not in PLAN_DETAILS:
        return {
            'claim_id':    claim_id,
            'worker_id':   worker_id,
            'eligible':    False,
            'final_payout': 0,
            'reason':      f"Invalid plan '{plan_name}'"
        }

    # Step 1: Determine how long the disruption lasted
    if actual_hours is not None and actual_hours > 0:
        disruption_hours = actual_hours
    else:
        # Use default estimate for this trigger type
        disruption_hours = DEFAULT_HOURS.get(trigger_type, 2.0)

    # Step 2: Get this plan's limits
    max_payout = PLAN_DETAILS[plan_name]['max_payout']
    max_hours  = PLAN_DETAILS[plan_name]['max_hours']

    # Step 3: Cap disruption hours to what this plan covers
    # e.g. basic plan only covers 10 hours
    # if disruption was 15 hours, we only pay for 10
    effective_hours = min(disruption_hours, max_hours)

    # Step 4: Calculate how much income the worker lost
    # daily_income / 8 = income per hour
    # income per hour x disruption hours = total income lost
    income_lost = daily_income * (effective_hours / 8)

    # Step 5: Final payout cannot exceed plan's coverage cap
    final_payout = min(income_lost, max_payout)
    final_payout = round(final_payout, 2)

    # Step 6: Check minimum payout threshold
    if final_payout < MIN_PAYOUT:
        return {
            'claim_id':         claim_id,
            'worker_id':        worker_id,
            'plan':             plan_name,
            'trigger_type':     trigger_type,
            'daily_income':     daily_income,
            'disruption_hours': disruption_hours,
            'income_lost':      round(income_lost, 2),
            'max_payout':       max_payout,
            'final_payout':     0,
            'eligible':         False,
            'was_capped':       income_lost > max_payout,
            'reason':           f"Payout Rs {final_payout} below minimum Rs {MIN_PAYOUT}",
            'calculated_at':    datetime.utcnow().isoformat(),
        }

    return {
        'claim_id':         claim_id,
        'worker_id':        worker_id,
        'plan':             plan_name,
        'trigger_type':     trigger_type,
        'daily_income':     daily_income,
        'disruption_hours': disruption_hours,
        'effective_hours':  effective_hours,
        'income_lost':      round(income_lost, 2),
        'max_payout':       max_payout,
        'final_payout':     final_payout,
        'eligible':         True,
        'was_capped':       income_lost > max_payout,
        'reason':           "Approved",
        'calculated_at':    datetime.utcnow().isoformat(),
    }



# PART 4 - BATCH PAYOUT
# When one trigger fires, many workers are affected at once
# This function handles all of them together

def calculate_batch_payouts(workers_list, trigger_type, actual_hours=None):
    """
    USE THIS when a zone-level trigger fires and you need to
    process payouts for all active policies in that zone.

    workers_list : list of dicts, each must have:
                   claim_id, worker_id, daily_income, plan_name

    Returns list of payout results + a summary
    """
    results = []

    for worker in workers_list:
        result = calculate_payout(
            claim_id      = worker['claim_id'],
            worker_id     = worker['worker_id'],
            daily_income  = worker['daily_income'],
            plan_name     = worker['plan_name'],
            trigger_type  = trigger_type,
            actual_hours  = actual_hours,
        )
        results.append(result)

    # Calculate summary stats
    eligible   = [r for r in results if r['eligible']]
    ineligible = [r for r in results if not r['eligible']]
    total_paid = sum(r['final_payout'] for r in eligible)

    summary = {
        'total_claims':    len(results),
        'approved':        len(eligible),
        'rejected':        len(ineligible),
        'total_payout_rs': round(total_paid, 2),
        'avg_payout_rs':   round(total_paid / len(eligible), 2) if eligible else 0,
    }

    return results, summary



# PART 5 - TEST IT


if __name__ == "__main__":

    print("=" * 55)
    print("Payout Calculator - GigInsure")
    print("=" * 55)

    # Test 1: Single worker
    print("\n--- Test 1: Single Worker Payout ---")
    result = calculate_payout(
        claim_id     = 'CLM_001',
        worker_id    = 'WRK_101',
        daily_income = 600,        # earns Rs 600 per day
        plan_name    = 'standard',
        trigger_type = 'heavy_rain',
        actual_hours = 3.5,        # rain lasted 3.5 hours
    )
    print(f"  Worker          : {result['worker_id']}")
    print(f"  Plan            : {result['plan'].upper()}")
    print(f"  Daily income    : Rs {result['daily_income']}")
    print(f"  Disruption      : {result['disruption_hours']} hrs")
    print(f"  Income lost     : Rs {result['income_lost']}  (600 x 3.5/8)")
    print(f"  Coverage cap    : Rs {result['max_payout']}")
    print(f"  Final payout    : Rs {result['final_payout']}")
    print(f"  Was capped      : {result['was_capped']}")
    print(f"  Eligible        : {result['eligible']}")

    # Test 2: Batch payout when curfew fires
    print("\n--- Test 2: Batch Payout (Curfew in Zone 201301) ---")

    affected_workers = [
        {'claim_id': 'CLM_010', 'worker_id': 'WRK_201', 'daily_income': 500,  'plan_name': 'basic'},
        {'claim_id': 'CLM_011', 'worker_id': 'WRK_202', 'daily_income': 700,  'plan_name': 'standard'},
        {'claim_id': 'CLM_012', 'worker_id': 'WRK_203', 'daily_income': 800,  'plan_name': 'premium'},
        {'claim_id': 'CLM_013', 'worker_id': 'WRK_204', 'daily_income': 300,  'plan_name': 'basic'},
        {'claim_id': 'CLM_014', 'worker_id': 'WRK_205', 'daily_income': 1000, 'plan_name': 'premium'},
    ]

    batch_results, summary = calculate_batch_payouts(
        workers_list = affected_workers,
        trigger_type = 'curfew',
        actual_hours = 6.0,   # curfew lasted 6 hours
    )

    print(f"  {'Worker':<10} {'Plan':<10} {'Income/day':<12} {'Payout':<10} {'Status'}")
    print(f"  {'-'*55}")
    for r in batch_results:
        status = "Approved" if r['eligible'] else "Rejected"
        print(f"  {r['worker_id']:<10} {r['plan']:<10} Rs {r['daily_income']:<10} Rs {r['final_payout']:<8} {status}")

    print(f"\n  Summary:")
    print(f"    Total claims   : {summary['total_claims']}")
    print(f"    Approved       : {summary['approved']}")
    print(f"    Rejected       : {summary['rejected']}")
    print(f"    Total paid out : Rs {summary['total_payout_rs']}")
    print(f"    Average payout : Rs {summary['avg_payout_rs']}")
