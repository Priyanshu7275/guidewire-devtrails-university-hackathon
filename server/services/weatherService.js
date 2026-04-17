/*
 * services/weatherService.js
 * -----------------------------------------------------------------------
 * Fetches real-time weather and AQI data from OpenWeatherMap (OWM).
 *
 * Two OWM endpoints are used:
 *   1. Current Weather   -- GET /data/2.5/weather?zip={pincode},IN
 *      Returns rain accumulation (last hour), temperature, humidity.
 *
 *   2. Air Pollution     -- GET /data/2.5/air_pollution?lat=&lon=
 *      Returns AQI index (1-5 OWM scale) and PM2.5 concentration.
 *
 * Because each free OWM account has a rate limit and the tests / demo
 * route need to work even without a real API key, we provide FALLBACK
 * MOCK DATA that is returned whenever:
 *   - The OWM_KEY environment variable is empty, OR
 *   - The OWM API call fails for any reason (network error, quota, etc.)
 *
 * Trigger thresholds used by the trigger-check route:
 *   - heavy_rain    : rain > 15 mm/hr
 *   - extreme_heat  : temp > 43 C
 *   - dangerous_aqi : AQI index > 200 (converting OWM 1-5 to 0-500 scale)
 * -----------------------------------------------------------------------
 */

const axios = require('axios');
const { OWM_KEY } = require('../config/keys');

// Base URL for all OpenWeatherMap API v2.5 requests.
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

// -----------------------------------------------------------------------
// Mock data used when the OWM key is absent or the API call fails.
// The values are chosen to be "normal" (no triggers firing) so that
// demos do not accidentally generate real claim payouts.
// -----------------------------------------------------------------------

/**
 * buildMockWeather
 * Returns a realistic-looking but static weather object for a pincode.
 * Used as fallback when OpenWeatherMap is unavailable.
 *
 * @param {string} pincode - The Indian postal code being queried.
 * @returns {{ rain_mm, temp_c, humidity, lat, lon, city, source }}
 */
function buildMockWeather(pincode) {
  // Light variation per pincode so different zones look slightly different
  // in the demo without triggering the 15 mm/hr or 43 C thresholds.
  const seed = parseInt(pincode.slice(-2), 10) || 10;
  return {
    rain_mm: parseFloat((seed * 0.3).toFixed(1)),   // 0-9 mm/hr
    temp_c: parseFloat((28 + seed * 0.15).toFixed(1)), // 28-31 C
    humidity: 60 + (seed % 20),
    lat: 28.6,
    lon: 77.2,
    city: 'Unknown (mock)',
    source: 'mock',
  };
}

/**
 * buildMockAQI
 * Returns a static AQI object used as fallback.
 *
 * @returns {{ aqi, pm25, source }}
 */
function buildMockAQI() {
  return {
    aqi: 95,       // OWM returns 1-5, we convert to 0-500 scale below.
    pm25: 42.0,
    source: 'mock',
  };
}

// -----------------------------------------------------------------------
// OWM scale to CPCB (Indian) AQI scale conversion.
// OWM Air Pollution API returns an integer 1-5:
//   1 = Good, 2 = Fair, 3 = Moderate, 4 = Poor, 5 = Very Poor
// We map these to approximate AQI values on the 0-500 scale.
// -----------------------------------------------------------------------
const OWM_AQI_MAP = {
  1: 50,
  2: 100,
  3: 150,
  4: 250,
  5: 350,
};

/**
 * fetchWeather
 * Calls OpenWeatherMap Current Weather API for the given Indian pincode.
 * Falls back to mock data if the API key is absent or the call fails.
 *
 * @param {string} pincode - 6-digit Indian postal code (e.g. "201301").
 * @returns {Promise<{ rain_mm, temp_c, humidity, lat, lon, city, source }>}
 */
async function fetchWeather(pincode) {
  // If no API key is configured, skip the network call immediately.
  if (!OWM_KEY) {
    console.warn('[weatherService] OWM_KEY not set, using mock weather data.');
    return buildMockWeather(pincode);
  }

  try {
    const url = `${OWM_BASE}/weather`;
    const response = await axios.get(url, {
      params: {
        zip: `${pincode},IN`,  // OWM zip parameter accepts "pincode,CountryCode"
        appid: OWM_KEY,
        units: 'metric',       // Return temperatures in Celsius
      },
      timeout: 7000,           // Fail fast if OWM takes more than 7 seconds
    });

    const data = response.data;

    // OWM returns rain data under the "rain" key only if it is actually
    // raining. The "1h" sub-key is rainfall in mm over the past hour.
    // We default to 0 if the key is absent.
    const rain_mm = (data.rain && data.rain['1h']) ? data.rain['1h'] : 0;

    return {
      rain_mm: parseFloat(rain_mm.toFixed(2)),
      temp_c: parseFloat(data.main.temp.toFixed(1)),
      humidity: data.main.humidity,
      lat: data.coord.lat,
      lon: data.coord.lon,
      city: data.name,
      source: 'openweathermap',
    };
  } catch (err) {
    console.warn(`[weatherService] OWM weather fetch failed for pincode ${pincode}: ${err.message}`);
    return buildMockWeather(pincode);
  }
}

/**
 * fetchAQI
 * Calls OpenWeatherMap Air Pollution API using coordinates (lat/lon).
 * Falls back to mock data on failure.
 *
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<{ aqi, pm25, source }>}
 */
async function fetchAQI(lat, lon) {
  if (!OWM_KEY) {
    return buildMockAQI();
  }

  try {
    const url = `${OWM_BASE}/air_pollution`;
    const response = await axios.get(url, {
      params: { lat, lon, appid: OWM_KEY },
      timeout: 7000,
    });

    const components = response.data.list[0].components;
    const owmAqiIndex = response.data.list[0].main.aqi; // 1-5

    // Convert OWM 1-5 scale to approximate 0-500 AQI for threshold checks.
    const aqiConverted = OWM_AQI_MAP[owmAqiIndex] || owmAqiIndex * 60;

    return {
      aqi: aqiConverted,
      pm25: parseFloat((components.pm2_5 || 0).toFixed(1)),
      source: 'openweathermap',
    };
  } catch (err) {
    console.warn(`[weatherService] OWM AQI fetch failed: ${err.message}`);
    return buildMockAQI();
  }
}

/**
 * getWeatherAndAQI
 * Convenience function that fetches both weather and AQI for a pincode
 * and returns them as a combined object.
 *
 * This is the main function called by the triggers route and scheduler.
 *
 * @param {string} pincode - 6-digit Indian postal code.
 * @returns {Promise<{ weather: {...}, aqi: {...} }>}
 */
async function getWeatherAndAQI(pincode) {
  // Step 1: Get weather (which also gives us lat/lon for the AQI call).
  const weather = await fetchWeather(pincode);

  // Step 2: Use the coordinates returned by the weather call for AQI.
  const aqi = await fetchAQI(weather.lat, weather.lon);

  return { weather, aqi };
}

module.exports = { getWeatherAndAQI, fetchWeather, fetchAQI };
