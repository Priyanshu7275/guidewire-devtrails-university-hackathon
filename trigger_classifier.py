# ============================================================
# GigInsure - Trigger Classifier
# Written by: Team GigInsure (DEVTrails 2026)
#
# WHAT THIS FILE DOES:
#   Checks 5 types of disruptions every 15 minutes
#   If any disruption crosses a threshold -> trigger fires
#   -> claim pipeline automatically starts for affected workers
#
# TRIGGERS WE CHECK:
#   1. Heavy Rain     -> OpenWeatherMap API (real)
#   2. Extreme Heat   -> OpenWeatherMap API (real)
#   3. Dangerous AQI  -> Mock JSON (CPCB in production)
#   4. Curfew/Strike  -> Mock JSON (Govt API in production)
#   5. Platform Outage-> Mock JSON (Platform API in production)
#
# HOW TO RUN:
#   python trigger_classifier.py
#
# NOTE: Set your OpenWeatherMap API key as environment variable
#   export OPENWEATHERMAP_API_KEY=your_key_here
#   Get free key at: https://openweathermap.org/api
# ============================================================


# requests -> for making HTTP API calls
# os       -> to read environment variables (API keys)
# datetime -> to timestamp when trigger was detected
import requests
import os
from datetime import datetime


# ============================================================
# PART 1 - THRESHOLDS
# These are the values that must be crossed for a trigger to fire
# Based on real parametric insurance industry standards
# ============================================================

RAIN_THRESHOLD    = 15.0   # mm per hour  -> heavy rain
HEAT_THRESHOLD    = 43.0   # degrees C    -> extreme heat
AQI_THRESHOLD     = 300    # AQI index    -> dangerous pollution
OUTAGE_THRESHOLD  = 45     # minutes      -> platform outage
# for curfew: any active curfew = trigger fires (boolean)


# ============================================================
# PART 2 - MOCK DATA
# We use fake data for AQI, curfew, and outage triggers
# because free APIs for these don't exist easily
# In production you would replace these with real API calls
# ============================================================

# Fake AQI data for our 15 pincodes
# In real world: fetch from CPCB API (https://api.data.gov.in)
MOCK_AQI_DATA = {
    201301: 320,   # above 300 -> trigger fires!
    201302: 180,
    201303: 350,   # above 300 -> trigger fires!
    110001: 290,
    110002: 210,
    122001: 160,
}

# Fake curfew status per pincode
# In real world: scrape government alert pages or news APIs
MOCK_CURFEW_DATA = {
    201301: False,
    201303: True,   # curfew active in this zone -> trigger fires!
    110003: True,   # curfew active here too
    110001: False,
    122001: False,
}

# Fake platform outage data
# In real world: check platform status pages (like status.swiggy.com)
MOCK_OUTAGE_DATA = {
    'zepto':   {'active': False, 'minutes': 0},
    'blinkit': {'active': True,  'minutes': 52},  # outage! 52 > 45 threshold
    'swiggy':  {'active': False, 'minutes': 0},
    'zomato':  {'active': False, 'minutes': 0},
    'amazon':  {'active': False, 'minutes': 0},
}

# Mock weather fallback (used when API key not set)
MOCK_WEATHER_DATA = {
    201301: {'rain_mm': 18.5, 'temp_c': 38.0},   # rain trigger fires!
    201302: {'rain_mm': 5.0,  'temp_c': 36.0},
    201303: {'rain_mm': 22.0, 'temp_c': 37.5},   # rain trigger fires!
    110001: {'rain_mm': 0.0,  'temp_c': 44.5},   # heat trigger fires!
    110002: {'rain_mm': 0.0,  'temp_c': 42.0},
    122001: {'rain_mm': 3.0,  'temp_c': 35.0},
}


# ============================================================
# PART 3 - API FETCH FUNCTIONS
# These functions fetch real or mock data
# ============================================================

def fetch_weather(pincode):
    """
    Fetches rain and temperature for a pincode.
    Uses OpenWeatherMap free API if key is set.
    Falls back to mock data otherwise.
    """
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")

    if api_key:
        # Real API call
        url = (f"https://api.openweathermap.org/data/2.5/weather"
               f"?zip={pincode},IN&appid={api_key}&units=metric")
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()

            # Rain data is inside 'rain' key, '1h' = last 1 hour in mm
            rain_mm = 0.0
            if 'rain' in data:
                rain_mm = data['rain'].get('1h', 0.0)

            temp_c = data['main']['temp']
            return {'rain_mm': rain_mm, 'temp_c': temp_c, 'source': 'live'}

        except Exception as e:
            print(f"  API error for {pincode}: {e} — using mock data")

    # Fallback to mock data
    weather = MOCK_WEATHER_DATA.get(pincode, {'rain_mm': 3.0, 'temp_c': 38.0})
    weather['source'] = 'mock'
    return weather


def fetch_aqi(pincode):
    """Returns AQI for a pincode. Uses mock data."""
    aqi = MOCK_AQI_DATA.get(pincode, 150)   # default 150 for unknown zones
    return {'aqi': aqi, 'source': 'mock'}


def fetch_curfew(pincode):
    """Returns whether a curfew is active in a pincode. Uses mock data."""
    active = MOCK_CURFEW_DATA.get(pincode, False)
    return {'curfew_active': active, 'source': 'mock'}


def fetch_outage(platform):
    """Returns platform outage status. Uses mock data."""
    data = MOCK_OUTAGE_DATA.get(platform.lower(), {'active': False, 'minutes': 0})
    return {
        'platform':  platform,
        'active':    data['active'],
        'minutes':   data['minutes'],
        'source':    'mock'
    }


# ============================================================
# PART 4 - TRIGGER CHECK FUNCTIONS
# One function per trigger type
# Each returns a result dict with triggered=True/False
# ============================================================

def check_rain(pincode):
    """Returns trigger result for heavy rain."""
    weather  = fetch_weather(pincode)
    rain     = weather['rain_mm']
    fired    = rain > RAIN_THRESHOLD

    return {
        'type':      'heavy_rain',
        'triggered': fired,
        'value':     rain,
        'threshold': RAIN_THRESHOLD,
        'unit':      'mm/hr',
        'pincode':   pincode,
        'message':   f"Rain {rain}mm/hr {'> threshold FIRED' if fired else '< threshold ok'}",
        'time':      datetime.utcnow().isoformat()
    }


def check_heat(pincode):
    """Returns trigger result for extreme heat."""
    weather = fetch_weather(pincode)
    temp    = weather['temp_c']
    fired   = temp > HEAT_THRESHOLD

    return {
        'type':      'extreme_heat',
        'triggered': fired,
        'value':     temp,
        'threshold': HEAT_THRESHOLD,
        'unit':      'degrees C',
        'pincode':   pincode,
        'message':   f"Temp {temp}C {'> threshold FIRED' if fired else '< threshold ok'}",
        'time':      datetime.utcnow().isoformat()
    }


def check_aqi(pincode):
    """Returns trigger result for dangerous AQI."""
    aqi_data = fetch_aqi(pincode)
    aqi      = aqi_data['aqi']
    fired    = aqi > AQI_THRESHOLD

    return {
        'type':      'dangerous_aqi',
        'triggered': fired,
        'value':     aqi,
        'threshold': AQI_THRESHOLD,
        'unit':      'AQI index',
        'pincode':   pincode,
        'message':   f"AQI {aqi} {'> threshold FIRED' if fired else '< threshold ok'}",
        'time':      datetime.utcnow().isoformat()
    }


def check_curfew(pincode):
    """Returns trigger result for active curfew."""
    curfew_data = fetch_curfew(pincode)
    active      = curfew_data['curfew_active']

    return {
        'type':      'curfew',
        'triggered': active,
        'value':     active,
        'threshold': True,
        'unit':      'boolean',
        'pincode':   pincode,
        'message':   f"Curfew {'ACTIVE - FIRED' if active else 'not active ok'}",
        'time':      datetime.utcnow().isoformat()
    }


def check_outage(pincode, platform='blinkit'):
    """Returns trigger result for platform outage."""
    outage_data = fetch_outage(platform)
    minutes     = outage_data['minutes']
    active      = outage_data['active']
    fired       = active and minutes > OUTAGE_THRESHOLD

    return {
        'type':      'platform_outage',
        'triggered': fired,
        'value':     minutes,
        'threshold': OUTAGE_THRESHOLD,
        'unit':      'minutes',
        'pincode':   pincode,
        'platform':  platform,
        'message':   f"{platform} outage {minutes}min {'> threshold FIRED' if fired else '< threshold ok'}",
        'time':      datetime.utcnow().isoformat()
    }


# ============================================================
# PART 5 - MAIN EVALUATION FUNCTION
# Checks all 5 triggers for a pincode
# Returns list of all results, and list of fired triggers
# ============================================================

def check_all_triggers(pincode, platform='blinkit'):
    """
    USE THIS in your Celery background task every 15 minutes.

    Returns:
        all_results   : list of all 5 trigger results
        fired_results : list of only the triggers that fired
    """
    all_results = [
        check_rain(pincode),
        check_heat(pincode),
        check_aqi(pincode),
        check_curfew(pincode),
        check_outage(pincode, platform),
    ]

    fired_results = [r for r in all_results if r['triggered']]

    return all_results, fired_results


# ============================================================
# PART 6 - TEST IT
# ============================================================

if __name__ == "__main__":

    test_pincodes = [201301, 201303, 110001, 110002, 122001]

    print("=" * 55)
    print("Trigger Classifier - GigInsure")
    print("=" * 55)

    for pincode in test_pincodes:
        print(f"\nChecking Zone: {pincode}")
        print("-" * 45)

        all_results, fired = check_all_triggers(pincode)

        for result in all_results:
            status = "FIRED ⚡" if result['triggered'] else "clear  "
            print(f"  [{status}] {result['message']}")

        if fired:
            print(f"\n  >>> {len(fired)} trigger(s) fired!")
            print(f"  >>> Claim pipeline should start for all active policies in {pincode}")
        else:
            print(f"\n  >>> No disruptions. Workers are safe.")
