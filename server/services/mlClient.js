/**
 * services/mlClient.js
 * ─────────────────────────────────────────────────────────────────────────
 * Centralised Axios instance that talks to the Python FastAPI ML service.
 *
 * Interceptors
 * ────────────
 *  Request  → convert camelCase body keys → snake_case (FastAPI expects it)
 *  Response → convert snake_case response keys → camelCase (Node/React expect it)
 *
 * Error handling
 * ──────────────
 *  ECONNREFUSED / ETIMEDOUT → throws an error with status 503 attached so
 *  callers can surface "ML service unavailable" to the client.
 *
 * All requests time-out after 5 s.
 */

const axios          = require('axios')
const { ML_SERVICE_URL } = require('../config/keys')
const { toCamel, toSnake } = require('../utils/transform')

const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: camelCase → snake_case ──────────────────────────
mlClient.interceptors.request.use(
  (config) => {
    if (config.data && typeof config.data === 'object') {
      config.data = toSnake(config.data)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: snake_case → camelCase ─────────────────────────
mlClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object') {
      response.data = toCamel(response.data)
    }
    return response
  },
  (error) => {
    const code = error.code || ''
    if (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET'   ||
      code === 'ETIMEDOUT'    ||
      error.message?.includes('timeout')
    ) {
      console.error(`[mlClient] ML service unreachable (${code || 'timeout'}): ${ML_SERVICE_URL}`)
      const serviceError   = new Error('ML service unavailable')
      serviceError.status  = 503
      serviceError.mlDown  = true
      return Promise.reject(serviceError)
    }
    return Promise.reject(error)
  }
)

module.exports = mlClient
