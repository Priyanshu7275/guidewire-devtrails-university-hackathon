/*
 * routes/auth.js
 * -----------------------------------------------------------------------
 * Authentication routes for GigInsure workers.
 *
 * Endpoints:
 *   POST /api/auth/register  -- Create a new worker account.
 *   POST /api/auth/login     -- Authenticate and return a JWT.
 *   GET  /api/auth/worker/:id -- Fetch a worker's profile (auth required).
 *
 * Libraries used:
 *   bcryptjs        -- hashes passwords before storing them in MongoDB.
 *   jsonwebtoken    -- generates and verifies JWT tokens.
 *   express-validator -- validates and sanitises request body fields.
 *
 * Security notes:
 *   - Passwords are hashed with bcrypt (salt rounds: 10) before storage.
 *   - Plain-text passwords never appear in logs or responses.
 *   - JWT expires after 7 days.
 *   - The passwordHash field is excluded from all GET /worker/:id responses.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const Worker = require('../models/Worker');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const { JWT_SECRET } = require('../config/keys');
const { getZoneRiskScore, calculateAllPlans } = require('../services/premiumService');
const authMiddleware = require('../middleware/auth');

// -----------------------------------------------------------------------
// Validation rule sets (used by express-validator)
// -----------------------------------------------------------------------

// Rules for POST /register
const registerValidationRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),

  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number'),

  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  body('platform')
    .notEmpty().withMessage('Platform is required'),

  body('pincode')
    .trim()
    .matches(/^\d{6}$/).withMessage('Pincode must be a 6-digit number'),

  body('city')
    .trim()
    .notEmpty().withMessage('City is required'),

  body('daily_income')
    .isFloat({ min: 100, max: 5000 }).withMessage('Daily income must be between 100 and 5000'),
];

// Rules for POST /login
const loginValidationRules = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Valid phone number required'),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

// -----------------------------------------------------------------------
// Helper: generate JWT token for a worker
// -----------------------------------------------------------------------

/**
 * generateToken
 * Creates a signed JWT payload containing the worker's MongoDB ID and phone.
 *
 * @param {Object} worker - Mongoose Worker document.
 * @returns {string} Signed JWT string.
 */
function generateToken(worker) {
  return jwt.sign(
    { id: worker._id.toString(), phone: worker.phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// -----------------------------------------------------------------------
// POST /api/auth/register
// -----------------------------------------------------------------------

/**
 * Register a new gig worker.
 * Body: { name, phone, password, platform, pincode, city, daily_income, vehicle? }
 * Returns the worker profile + calculated insurance plans.
 */
router.post('/register', registerValidationRules, async (req, res) => {
  // Check for validation errors collected by express-validator.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, phone, password, platform, pincode, city, daily_income, vehicle } = req.body;

    // Check whether a worker with this phone number already exists.
    const existing = await Worker.findOne({ phone });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A worker with this phone number is already registered.',
      });
    }

    // Hash the password. Salt rounds = 10 means bcrypt will run 2^10 = 1024
    // iterations of the hashing algorithm. Higher = more secure but slower.
    const passwordHash = await bcrypt.hash(password, 10);

    // Calculate the zone risk score via the Python ML model (XGBoost).
    const zoneRiskScore = await getZoneRiskScore(pincode);

    // Create and save the new worker document.
    const worker = await Worker.create({
      name,
      phone,
      passwordHash,
      platform: platform.toLowerCase(),
      pincode,
      city,
      vehicle: vehicle || 'motorcycle',
      dailyIncome: parseFloat(daily_income),
      zoneRiskScore,
      tenureDays: 0,
    });

    // Pre-calculate insurance plans using Python ML model (async).
    const planData = await calculateAllPlans(pincode, 0);

    return res.status(201).json({
      success: true,
      workerId:      worker._id.toString(),
      name:          worker.name,
      phone:         worker.phone,
      platform:      worker.platform,
      pincode:       worker.pincode,
      city:          worker.city,
      dailyIncome:   worker.dailyIncome,
      zoneRiskScore: worker.zoneRiskScore,
      token:         generateToken(worker),
      plans:         planData.plans,
    });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// -----------------------------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------------------------

/**
 * Authenticate a worker and return a JWT.
 * Body: { phone, password }
 */
router.post('/login', loginValidationRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  try {
    const { phone, password } = req.body;

    // Look up the worker by phone.
    const worker = await Worker.findOne({ phone });
    if (!worker) {
      // Return 401, not 404, to avoid leaking whether the phone exists.
      return res.status(401).json({ success: false, error: 'Invalid phone or password.' });
    }

    // Compare the submitted password with the stored hash.
    const passwordMatch = await bcrypt.compare(password, worker.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid phone or password.' });
    }

    // Generate the JWT.
    const token = generateToken(worker);

    // Check for an active policy.
    const activePolicy = await Policy.findOne({ workerId: worker._id, status: 'active' });

    // Calculate plans (tenure may have grown since last login).
    const planData = await calculateAllPlans(worker.pincode, worker.tenureDays);

    return res.status(200).json({
      success:       true,
      workerId:      worker._id.toString(),
      name:          worker.name,
      phone:         worker.phone,
      platform:      worker.platform,
      pincode:       worker.pincode,
      city:          worker.city,
      vehicle:       worker.vehicle,
      dailyIncome:   worker.dailyIncome,
      zoneRiskScore: worker.zoneRiskScore,
      token,
      hasPolicy:     !!activePolicy,
      activePolicy:  activePolicy
        ? {
            policyId:    activePolicy._id.toString(),
            plan:        activePolicy.plan,
            coverageCap: activePolicy.coverageCap,
            endDate:     activePolicy.endDate,
            status:      activePolicy.status,
          }
        : null,
      plans: planData.plans,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// -----------------------------------------------------------------------
// GET /api/auth/worker/:id
// -----------------------------------------------------------------------

/**
 * Fetch a worker's complete profile.
 * Requires: Authorization: Bearer <token>
 * Param: id -- MongoDB ObjectId of the worker.
 */
router.get('/worker/:id', authMiddleware, async (req, res) => {
  try {
    const workerId = req.params.id;

    // Exclude passwordHash from the projection (never send it to the client).
    const worker = await Worker.findById(workerId).select('-passwordHash');
    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found.' });
    }

    // Find the currently active policy.
    const activePolicy = await Policy.findOne({ workerId, status: 'active' });

    // Count total claims and sum up approved payouts for the earnings stat.
    const claimsAgg = await Claim.aggregate([
      { $match: { workerId: worker._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          total_earned: { $sum: '$payoutAmount' },
        },
      },
    ]);

    const totalClaims = claimsAgg.length ? claimsAgg[0].total : 0;
    const totalEarned = claimsAgg.length ? claimsAgg[0].total_earned : 0;

    return res.status(200).json({
      workerId:      worker._id.toString(),
      name:          worker.name,
      phone:         worker.phone,
      platform:      worker.platform,
      pincode:       worker.pincode,
      city:          worker.city,
      dailyIncome:   worker.dailyIncome,
      zoneRiskScore: worker.zoneRiskScore,
      tenureDays:    worker.tenureDays,
      activePolicy:  activePolicy
        ? {
            policyId:    activePolicy._id.toString(),
            plan:        activePolicy.plan,
            coverageCap: activePolicy.coverageCap,
            endDate:     activePolicy.endDate,
          }
        : null,
      totalClaims,
      totalEarned,
    });
  } catch (err) {
    console.error('[auth/worker/:id]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch worker profile.' });
  }
});

module.exports = router;
