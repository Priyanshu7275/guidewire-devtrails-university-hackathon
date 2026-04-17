import React, { useState, useEffect } from 'react'
import {
  CheckCircle2, Clock, Shield, Zap, AlertCircle,
  XCircle, Loader2, X, IndianRupee
} from 'lucide-react'
import FraudSignalBadge from './FraudSignalBadge.jsx'

/**
 * PayoutProgressModal
 *
 * A 4-step animated walkthrough shown after a claim is submitted.
 * Steps advance automatically (simulating backend processing time):
 *   1. Claim Received   — instant
 *   2. Trigger Verified — 1.2 s
 *   3. Fraud Analysis   — 1.8 s
 *   4. Payout Decision  — 1.4 s → final state
 *
 * Props:
 *   result   — the claim result object from /claims/initiate
 *   onClose  — callback to dismiss the modal
 */

const STEPS = [
  {
    id:      'received',
    label:   'Claim Received',
    detail:  'Logging your claim to the ledger',
    delayMs: 0,
  },
  {
    id:      'trigger',
    label:   'Trigger Verified',
    detail:  'Cross-checking live weather, AQI & platform data',
    delayMs: 1200,
  },
  {
    id:      'fraud',
    label:   'Fraud Analysis',
    detail:  'Scanning 7 behavioural signals with ML model',
    delayMs: 3000,
  },
  {
    id:      'decision',
    label:   'Payout Decision',
    detail:  'Finalising disbursement amount',
    delayMs: 4400,
  },
]

const DECISION_CONFIG = {
  AUTO_APPROVE: {
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    text:   'text-emerald-800',
    icon:   <CheckCircle2 size={22} className="text-emerald-500" />,
    label:  'Approved',
  },
  SOFT_HOLD: {
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    text:   'text-amber-800',
    icon:   <Clock size={22} className="text-amber-500" />,
    label:  'Under Review',
  },
  MANUAL_REVIEW: {
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    text:   'text-navy',
    icon:   <AlertCircle size={22} className="text-navy" />,
    label:  'Manual Review',
  },
  AUTO_REJECT: {
    bg:     'bg-rose-50',
    border: 'border-rose-200',
    text:   'text-rose-800',
    icon:   <XCircle size={22} className="text-rose-500" />,
    label:  'Rejected',
  },
}

export default function PayoutProgressModal({ result, onClose }) {
  const [activeStep,   setActiveStep]   = useState(-1)   // index of completed steps (0-indexed)
  const [showOutcome,  setShowOutcome]  = useState(false)
  const [progressPct,  setProgressPct]  = useState(0)

  const totalDuration = STEPS[STEPS.length - 1].delayMs + 600  // 5 000 ms total

  useEffect(() => {
    // Advance each step at its delay
    STEPS.forEach((step, i) => {
      setTimeout(() => setActiveStep(i), step.delayMs + 300)
    })
    // Show final outcome after all steps
    setTimeout(() => setShowOutcome(true), totalDuration)
  }, [])

  // Animate progress bar
  useEffect(() => {
    let raf
    const start = performance.now()
    function tick(now) {
      const elapsed = now - start
      const pct = Math.min((elapsed / totalDuration) * 100, 100)
      setProgressPct(pct)
      if (pct < 100) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const decisionCfg = DECISION_CONFIG[result?.decision] || DECISION_CONFIG.MANUAL_REVIEW

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
              <h2 className="text-base font-extrabold text-gray-900">Processing Claim</h2>
              <p className="text-xs text-gray-400">Automated parametric review</p>
            </div>
          </div>
          {showOutcome && (
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-navy transition-none"
              style={{ width: `${progressPct}%`, transition: 'width 0.1s linear' }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const done    = activeStep >= i
              const current = activeStep === i - 1 && !showOutcome

              return (
                <div key={step.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 ${
                    done
                      ? 'bg-emerald-50 border-emerald-100'
                      : current
                        ? 'bg-blue-50 border-blue-100'
                        : 'bg-slate-50 border-slate-100'
                  }`}>

                  {/* Step icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    done    ? 'bg-emerald-100' :
                    current ? 'bg-blue-100'    : 'bg-slate-200'
                  }`}>
                    {done
                      ? <CheckCircle2 size={15} className="text-emerald-600" />
                      : current
                        ? <Loader2 size={15} className="text-navy animate-spin" />
                        : <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                    }
                  </div>

                  {/* Step text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                      done    ? 'text-emerald-800' :
                      current ? 'text-navy'        : 'text-slate-400'
                    }`}>
                      {step.label}
                    </p>
                    <p className={`text-2xs ${
                      done    ? 'text-emerald-600' :
                      current ? 'text-slate-500'   : 'text-slate-300'
                    }`}>
                      {step.detail}
                    </p>
                  </div>

                  {/* Done time tag */}
                  {done && (
                    <span className="text-2xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      Done
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Outcome panel (revealed after all steps) ── */}
          {showOutcome && (
            <div className="space-y-4 animate-fade-in">

              {/* Decision banner */}
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${decisionCfg.bg} ${decisionCfg.border}`}>
                <div className="flex-shrink-0 mt-0.5">{decisionCfg.icon}</div>
                <div>
                  <p className={`font-extrabold text-base ${decisionCfg.text}`}>
                    {decisionCfg.label}
                  </p>
                  <p className={`text-sm mt-0.5 ${decisionCfg.text} opacity-80`}>
                    {result.message}
                  </p>
                </div>
              </div>

              {/* Payout amount */}
              {(result.payout ?? 0) > 0 && (
                <div className="text-center py-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Payout Amount</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <IndianRupee size={22} className="text-emerald-700" />
                    <p className="text-4xl font-extrabold text-emerald-700">{result.payout}</p>
                  </div>
                  <p className="text-xs text-emerald-500 mt-2 flex items-center justify-center gap-1">
                    <Zap size={11} /> Sent to your UPI within 90 seconds
                  </p>
                </div>
              )}

              {/* Stats row */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Fraud Score</span>
                  <span className={`font-extrabold ${
                    (result.fraudScore ?? 0) > 0.65 ? 'text-rose-600' :
                    (result.fraudScore ?? 0) > 0.35 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {((result.fraudScore ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">GPS Verification</span>
                  <span className={`font-bold text-xs px-2.5 py-1 rounded-full ${
                    result.gpsVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {result.gpsVerified ? 'Zone Match' : 'Zone Mismatch'}
                  </span>
                </div>
              </div>

              {/* Fraud signals */}
              {result.fraudSignals?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fraud Signals</p>
                  <div className="space-y-1.5">
                    {result.fraudSignals.map((s, i) => <FraudSignalBadge key={i} signal={s} />)}
                  </div>
                </div>
              )}

              <button onClick={onClose}
                className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-dark text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-navy/20 text-sm">
                Done
              </button>
            </div>
          )}

          {/* Waiting message while processing */}
          {!showOutcome && (
            <p className="text-center text-xs text-slate-400 animate-pulse">
              Automated review in progress — typically under 5 seconds
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
