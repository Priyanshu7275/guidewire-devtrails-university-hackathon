/*
 * services/api.js — Centralised API Layer
 *
 * Every network request the frontend makes goes through this file.
 * Why centralise?
 *   1. One place to change the base URL (dev vs production).
 *   2. One place to attach the JWT token to every request.
 *   3. One place to handle 401 Unauthorized (auto-logout).
 *
 * We use axios instead of the native fetch() API because axios:
 *   - Automatically parses JSON responses.
 *   - Has request/response interceptors (used below for auth).
 *   - Gives cleaner error objects.
 *
 * Because vite.config.js proxies /api → localhost:5000, we just use
 * baseURL = '/api' and it works in both dev and production.
 */

import axios from 'axios'

// In production (Vercel), VITE_API_URL is set to the Render backend URL.
// In development, Vite proxies /api → localhost:5000, so we just use '/api'.
const BASE = import.meta.env.VITE_API_URL || '/api'

// ── Create a reusable axios instance ─────────────────────────────────────────
const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000  // give up after 15 seconds
})

// ── Request interceptor — attach JWT token ────────────────────────────────────
// Every outgoing request passes through this function before it is sent.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('giginsure_token')
    if (token) {
      // The server's auth middleware reads this header to verify the user.
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor — handle global errors ───────────────────────────────
// Every response passes through this before reaching the calling component.
api.interceptors.response.use(
  (response) => response,  // pass successful responses straight through
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear storage and reload to /login
      localStorage.removeItem('giginsure_token')
      localStorage.removeItem('giginsure_worker')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/** Register a new worker. Returns { worker_id, name, token, plans } */
export const registerWorker = (data) => api.post('/auth/register', data)

/** Login with phone + password. Returns { worker_id, token, has_policy, ... } */
export const loginWorker = (data) => api.post('/auth/login', data)

/** Get full worker profile by ID. */
export const getWorker = (id) => api.get(`/auth/worker/${id}`)

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM
// ─────────────────────────────────────────────────────────────────────────────

/** Calculate premium for all 3 plans for a given pincode and tenure. */
export const calculatePremium = (pincode, tenureDays = 0) =>
  api.get(`/premium/calculate?pincode=${pincode}&tenure_days=${tenureDays}`)

// ─────────────────────────────────────────────────────────────────────────────
// POLICY
// ─────────────────────────────────────────────────────────────────────────────

/** Create (buy) a new policy. Body: { worker_id, plan, premium_paid } */
export const createPolicy = (data) => api.post('/policy/create', data)

/** Get the currently active policy for a worker. */
export const getActivePolicy = (workerId) => api.get(`/policy/active/${workerId}`)

/** Get full policy history for a worker. */
export const getPolicyHistory = (workerId) => api.get(`/policy/history/${workerId}`)

/** Cancel an active policy (used before upgrading). */
export const cancelPolicy = (policyId) => api.patch(`/policy/${policyId}/cancel`)

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGERS (Weather / AQI / News)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check all 5 disruption triggers for a pincode.
 * Returns live weather, AQI, news, and trigger status.
 */
export const checkTriggers = (pincode, platform = 'blinkit') =>
  api.get(`/triggers/check/${pincode}?platform=${platform}`)

/** Get trigger summary for all known zones (admin use). */
export const getZoneSummary = () => api.get('/triggers/zone-summary')

// ─────────────────────────────────────────────────────────────────────────────
// CLAIMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiate a new claim.
 * Body: { worker_id, policy_id, trigger_type, trigger_value,
 *         session_minutes, device_flag, gps: { lat, lng } }
 * Returns: { decision, fraud_score, fraud_signals, payout, ... }
 */
export const initiateClaim = (data) => api.post('/claims/initiate', data)

/** Get all claims filed by a worker. */
export const getClaimsHistory = (workerId) => api.get(`/claims/history/${workerId}`)

/** Get the current status of a single claim. */
export const getClaimStatus = (claimId) => api.get(`/claims/status/${claimId}`)

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Create a Razorpay order for premium payment. */
export const createPaymentOrder = (data) => api.post('/payments/create-order', data)

/** Verify payment after worker completes UPI transaction. */
export const verifyPayment = (data) => api.post('/payments/verify', data)

/** Get payment history (premiums + payouts) for a worker. */
export const getPaymentHistory = (workerId) => api.get(`/payments/history/${workerId}`)

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

/** Deep behavioural analysis for a zone (pincode). */
export const getZoneAnalytics = (pincode) => api.get(`/analytics/zone/${pincode}`)

/** Predict next-week disruption probability for a pincode. */
export const predictZone = (pincode) => api.get(`/analytics/predict/${pincode}`)

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/** Admin KPI dashboard. */
export const getAdminDashboard = () => api.get('/admin/dashboard')

/** All workers list. */
export const getAdminWorkers = () => api.get('/admin/workers')

/** Last 50 claims. */
export const getAdminClaims = () => api.get('/admin/claims')

/** Admin review: approve or decline a SOFT_HOLD / MANUAL_REVIEW claim. */
export const reviewClaim = (claimId, action) => api.patch(`/claims/${claimId}/review`, { action })

// ─────────────────────────────────────────────────────────────────────────────
// ELIGIBILITY MAP
// ─────────────────────────────────────────────────────────────────────────────

/** All covered zones with worker/policy/claim/trigger stats. */
export const getEligibilityZones = () => api.get('/eligibility/zones')

/** Eligibility map — zones classified ACTIVE/ELEVATED/NORMAL with live trigger data. */
export const getEligibilityMapData   = ()        => api.get('/admin/eligibility-map')
/** Worker-level detail for a single pincode zone. */
export const getEligibilityZoneDetail = (pincode) => api.get(`/admin/eligibility-map/zone/${pincode}`)
/** Batch-approve all pending claims (fraudScore < 0.7) in a zone. */
export const batchApproveZone        = (pincode) => api.post(`/admin/eligibility-map/zone/${pincode}/batch-approve`)

// ─────────────────────────────────────────────────────────────────────────────
// DEMO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate a disruption event for a pincode.
 * Body: { pincode, trigger_type, trigger_value }
 * Returns full story of affected workers, claims, and payouts.
 */
export const simulateDisruption = (data) => api.post('/demo/simulate-disruption', data)

export default api
