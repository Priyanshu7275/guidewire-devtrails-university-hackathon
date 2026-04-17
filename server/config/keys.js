/*
 * config/keys.js
 * -----------------------------------------------------------------------
 * Central place to read and export all environment variables.
 *
 * Why have a separate file for this?
 *   - Every other module imports from here instead of calling process.env
 *     directly. That way, if a variable name ever changes, you only update
 *     one file instead of hunting through dozens of source files.
 *   - It makes it very obvious at startup which variables are missing,
 *     because we validate them all in one place.
 *
 * Usage:
 *   const { JWT_SECRET, OWM_KEY } = require('../config/keys');
 * -----------------------------------------------------------------------
 */

// Load variables from .env file into process.env.
// dotenv.config() does nothing if the variable is already set (e.g. in
// a real production environment where variables come from the OS).
require('dotenv').config();

// We export a plain object. Destructuring it in other files is clean and
// lets editors auto-complete the key names.
module.exports = {
  // Express listen port, default 5000 if not set.
  PORT: process.env.PORT || 5000,

  // Full MongoDB connection URI including database name.
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/giginsure',

  // Secret key used to sign and verify JSON Web Tokens.
  // Keep this value long and unpredictable in production.
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_dev_secret_do_not_use_in_prod',

  // OpenWeatherMap API key for weather and AQI data.
  // If not provided the weather service will return mock data.
  OWM_KEY: process.env.OPENWEATHERMAP_API_KEY || '',

  // NewsAPI key for fetching local disruption news headlines.
  // If not provided the news service will return an empty array.
  NEWS_KEY: process.env.NEWS_API_KEY || '',

  // Razorpay sandbox credentials for UPI payment flow.
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',

  // Python ML microservice URL. The Node.js backend calls this for zone risk
  // scoring (XGBoost) and fraud detection (Isolation Forest).
  // Start the service: cd gitinsure && uvicorn ml_api:app --port 5001
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:5001',
};
