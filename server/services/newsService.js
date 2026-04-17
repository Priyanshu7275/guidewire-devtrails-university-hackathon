/*
 * services/newsService.js
 * -----------------------------------------------------------------------
 * Fetches local disruption news from NewsAPI.
 *
 * The endpoint used is:
 *   GET https://newsapi.org/v2/everything
 *   ?q={city}+flood+OR+strike+OR+curfew+OR+cyclone+OR+aqi
 *   &language=en
 *   &sortBy=publishedAt
 *   &pageSize=5
 *   &apiKey={NEWS_KEY}
 *
 * NewsAPI requires a valid API key. If NEWS_KEY is not set, or if the
 * API call fails, we return an empty array. The triggers route handles
 * a missing news array gracefully (it just omits it from disruption
 * scoring). That way the platform still works in pure weather-only mode.
 *
 * We also provide a city-name lookup table keyed by pincode prefix
 * (first 3 digits), because pincode-to-city mapping is needed for the
 * search query and we want to avoid a separate reverse-geocoding call.
 * -----------------------------------------------------------------------
 */

const axios = require('axios');
const { NEWS_KEY } = require('../config/keys');

const NEWS_BASE = 'https://newsapi.org/v2/everything';

// -----------------------------------------------------------------------
// Pincode prefix -> city name lookup table.
// The first 3 digits of an Indian pincode identify a district / region.
// This table covers the most common delivery zones in India.
// -----------------------------------------------------------------------
const PINCODE_CITY_MAP = {
  '201': 'Noida',
  '110': 'Delhi',
  '122': 'Gurugram',
  '400': 'Mumbai',
  '560': 'Bangalore',
  '600': 'Chennai',
  '700': 'Kolkata',
  '411': 'Pune',
  '500': 'Hyderabad',
  '380': 'Ahmedabad',
  '302': 'Jaipur',
  '226': 'Lucknow',
  '440': 'Nagpur',
  '160': 'Chandigarh',
  '682': 'Kochi',
};

/**
 * getCityFromPincode
 * Maps a 6-digit pincode to a human-readable city name using the first
 * 3 digits as a region key.
 *
 * @param {string} pincode - 6-digit Indian postal code.
 * @returns {string} City name, or 'India' as a fallback.
 */
function getCityFromPincode(pincode) {
  const prefix = String(pincode).slice(0, 3);
  return PINCODE_CITY_MAP[prefix] || 'India';
}

/**
 * fetchDisruptionNews
 * Queries NewsAPI for recent disruption-related headlines in the city
 * corresponding to the given pincode.
 *
 * Returns at most 5 articles. Each article object contains:
 *   { title, description, publishedAt, url }
 *
 * Returns an empty array if the API key is missing or the call fails.
 *
 * @param {string} pincode - 6-digit Indian postal code.
 * @returns {Promise<Array<{ title, description, publishedAt, url }>>}
 */
async function fetchDisruptionNews(pincode) {
  // Skip the network call entirely if no key is configured.
  if (!NEWS_KEY) {
    console.warn('[newsService] NEWS_KEY not set, returning empty news array.');
    return [];
  }

  const city = getCityFromPincode(pincode);

  try {
    const response = await axios.get(NEWS_BASE, {
      params: {
        // Build a search query that targets the specific city and uses
        // OR to catch any of the major disruption keywords.
        q: `${city} flood OR curfew OR strike OR cyclone OR AQI`,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 5,
        apiKey: NEWS_KEY,
      },
      timeout: 8000,
    });

    const articles = response.data.articles || [];

    // Extract only the fields we expose in our API response.
    return articles.map((article) => ({
      title: article.title || '',
      description: article.description || '',
      publishedAt: article.publishedAt || '',
      url: article.url || '',
    }));
  } catch (err) {
    console.warn(`[newsService] NewsAPI call failed for pincode ${pincode}: ${err.message}`);
    return [];
  }
}

module.exports = { fetchDisruptionNews, getCityFromPincode };
