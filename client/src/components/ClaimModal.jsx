import React, { useState, useEffect } from 'react'
import { X, MapPin, Shield, Zap, AlertTriangle } from 'lucide-react'
import { useGPS } from '../hooks/useGPS.js'
import { initiateClaim, checkTriggers } from '../services/api.js'
import PayoutProgressModal from './PayoutProgressModal.jsx'

const TRIGGER_LABELS = {
  heavy_rain:      'Heavy Rain (>15 mm/hr)',
  extreme_heat:    'Extreme Heat (>43°C)',
  dangerous_aqi:   'Dangerous AQI (>200)',
  curfew:          'Curfew / Strike',
  platform_outage: 'Platform Outage (>45 min)',
}

export default function ClaimModal({ worker, policy, activeTriggers = [], onClose }) {
  const { lat, lng, accuracy, error: gpsError, loading: gpsLoading, request: requestGPS } = useGPS()

  const [triggerType,    setTriggerType]    = useState('')
  const [sessionMins,    setSessionMins]    = useState(45)
  const [submitting,     setSubmitting]     = useState(false)
  const [result,         setResult]         = useState(null)
  const [submitError,    setSubmitError]    = useState(null)
  const [liveTriggers,   setLiveTriggers]   = useState(null)   // null = loading, [] = none found
  const [triggerLoading, setTriggerLoading] = useState(true)

  // Fetch live triggers for the worker's pincode on open
  useEffect(() => {
    requestGPS()
    async function fetchTriggers() {
      setTriggerLoading(true)
      try {
        const pincode = worker?.pincode
        if (!pincode) { setLiveTriggers([]); return }
        const res  = await checkTriggers(pincode)
        // triggers endpoint returns { triggers: [...], ... }
        // each trigger has { type, triggered, value, ... }
        const fired = (res.data.triggers || []).filter(t => t.triggered)
        setLiveTriggers(fired)
        if (fired.length > 0) setTriggerType(fired[0].type)
      } catch {
        // fall back to activeTriggers prop
        setLiveTriggers(activeTriggers)
        if (activeTriggers.length > 0) setTriggerType(activeTriggers[0].type)
      } finally {
        setTriggerLoading(false)
      }
    }
    fetchTriggers()
  }, [])

  // triggerOptions: use live triggers if fetched, else prop fallback
  const triggerOptions = liveTriggers !== null
    ? liveTriggers
    : activeTriggers.length > 0
      ? activeTriggers
      : Object.entries(TRIGGER_LABELS).map(([type, label]) => ({ type, label }))

  const noActiveTriggers = !triggerLoading && triggerOptions.length === 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!triggerType) { setSubmitError('Please select a disruption type.'); return }
    if (!policy)      { setSubmitError('No active policy found.'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = {
        worker_id:       worker.workerId || worker.id,
        policy_id:       policy.policyId,
        trigger_type:    triggerType,
        trigger_value:   (liveTriggers ?? activeTriggers).find(t => t.type === triggerType)?.value || 0,
        session_minutes: sessionMins,
        device_flag:     0,
        gps: lat && lng ? { lat, lng } : null,
      }
      const res = await initiateClaim(payload)
      setResult(res.data)
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Claim submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // When result arrives, hand off to the animated progress modal
  if (result) {
    return <PayoutProgressModal result={result} onClose={onClose} />
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-navy/10 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-navy" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900">File Claim</h2>
              <p className="text-xs text-gray-400 capitalize">{policy?.plan} Shield · Rs.{policy?.coverageCap} cap</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Form view ── */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* GPS status */}
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
              lat ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <MapPin size={15} className="flex-shrink-0" />
              {gpsLoading && 'Acquiring GPS…'}
              {!gpsLoading && lat  && 'GPS Acquired'}
              {!gpsLoading && !lat && (gpsError || 'GPS unavailable — claim may be flagged')}
            </div>

            {/* Trigger type */}
            <div>
              <label className="label">Disruption Type</label>
              {triggerLoading ? (
                <div className="input flex items-center gap-2 text-slate-400 text-sm">
                  <span className="w-3.5 h-3.5 border border-slate-300 border-t-navy rounded-full animate-spin" />
                  Checking your zone…
                </div>
              ) : noActiveTriggers ? (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle size={15} className="flex-shrink-0" />
                  No active disruptions detected in your zone right now
                </div>
              ) : (
                <select className="select" value={triggerType} onChange={e => setTriggerType(e.target.value)} required>
                  <option value="">Select disruption…</option>
                  {triggerOptions.map(t => (
                    <option key={t.type} value={t.type}>{TRIGGER_LABELS[t.type] || t.type}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Session duration */}
            <div>
              <label className="label">
                How long were you on the app?
                <span className="text-xs text-gray-400 font-normal ml-1">(minutes)</span>
              </label>
              <input type="number" className="input" min={1} max={600} value={sessionMins}
                onChange={e => setSessionMins(Number(e.target.value))} />
            </div>

            {/* Policy summary */}
            <div className="flex items-center gap-3 bg-navy/5 rounded-xl p-3.5 border border-navy/10">
              <Shield size={15} className="text-navy flex-shrink-0" />
              <p className="text-xs text-gray-600">
                <span className="font-bold capitalize">{policy?.plan}</span> Shield ·
                Rs.{policy?.coverageCap} cap · Policy #{policy?.policyId}
              </p>
            </div>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
                {submitError}
              </p>
            )}

            <button type="submit" disabled={submitting || noActiveTriggers || triggerLoading}
              className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-light text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-navy/20 disabled:opacity-50 text-sm">
              {submitting ? <><span className="spinner" /> Processing Claim…</> : <><Zap size={15} /> Submit Claim</>}
            </button>
        </form>
      </div>
    </div>
  )
}
