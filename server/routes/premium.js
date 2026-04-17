/*
 * routes/premium.js
 * -----------------------------------------------------------------------
 * Premium calculation route.
 *
 * Endpoint:
 *   GET /api/premium/calculate?pincode=201301&tenure_days=90
 *
 * No authentication required -- workers should be able to see pricing
 * before they register. This is the "browse before buying" flow.
 *
 * The route delegates all math to premiumService.js and simply wraps
 * the result in the standard response shape.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();

const { calculateAllPlans } = require('../services/premiumService');

// -----------------------------------------------------------------------
// GET /api/premium/calculate
// -----------------------------------------------------------------------

/**
 * Calculate insurance premiums for all three plan tiers.
 * Query params:
 *   pincode     (required) -- 6-digit Indian postal code
 *   tenure_days (optional) -- number of days registered (default: 0)
 */
router.get('/calculate', async (req, res) => {
  try {
    const { pincode, tenure_days } = req.query;

    // Validate pincode format.
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        error: 'Query param "pincode" must be a 6-digit number.',
      });
    }

    // tenure_days is optional. Parse it as an integer, default to 0.
    const tenureDays = tenure_days ? parseInt(tenure_days, 10) : 0;
    if (isNaN(tenureDays) || tenureDays < 0) {
      return res.status(400).json({
        success: false,
        error: 'Query param "tenure_days" must be a non-negative integer.',
      });
    }

    // Delegate to the premium service (calls Python ML model, async).
    const result = await calculateAllPlans(pincode, tenureDays);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('[premium/calculate]', err);
    return res.status(500).json({ success: false, error: 'Premium calculation failed.' });
  }
});

module.exports = router;
