/**
 * UpgradeModal.jsx
 * Shows the upgrade options (Standard / Premium) with the price difference
 * the worker needs to pay on top of their current plan.
 */
import React, { useState, useEffect } from 'react'
import { X, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { calculatePremium, createPolicy } from '../services/api'

const PLAN_INFO = {
  standard: {
    label:    'Standard Shield',
    color:    'border-blue-500 bg-blue-50',
    badge:    'bg-blue-100 text-blue-700',
    btn:      'bg-blue-600 hover:bg-blue-700',
    perks:    ['Rs.900 coverage cap', '18 hrs/week covered', 'AQI + Rain + Heat triggers'],
  },
  premium: {
    label:    'Premium Guard',
    color:    'border-violet-500 bg-violet-50',
    badge:    'bg-violet-100 text-violet-700',
    btn:      'bg-violet-600 hover:bg-violet-700',
    perks:    ['Rs.1400 coverage cap', '28 hrs/week covered', 'All triggers + Curfew + Outage'],
  },
}

export default function UpgradeModal({ worker, currentPolicy, onClose, onUpgraded }) {
  const [plans,    setPlans]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [buying,   setBuying]   = useState(null)   // 'standard' | 'premium'

  const currentPremium = currentPolicy?.premiumPaid ?? 0
  const currentPlan    = currentPolicy?.plan ?? 'basic'

  useEffect(() => {
    async function load() {
      try {
        const res = await calculatePremium(worker.pincode, worker.tenureDays ?? 0)
        setPlans(res.data.plans)
      } catch {
        toast.error('Could not load plan prices')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [worker.pincode, worker.tenureDays])

  async function handleUpgrade(planName) {
    const newPremium   = plans[planName]?.finalPremium ?? 0
    const topUp        = Math.max(0, newPremium - currentPremium)
    setBuying(planName)
    try {
      await createPolicy({
        worker_id:     worker.workerId || worker.id,
        plan:          planName,
        premium_paid:  newPremium,
      })
      toast.success(`Upgraded to ${PLAN_INFO[planName].label}! Rs.${topUp} charged.`)
      onUpgraded()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upgrade failed. Please try again.')
    } finally {
      setBuying(null)
    }
  }

  const upgradeable = ['standard', 'premium'].filter(p => p !== currentPlan)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-navy" />
            <span className="font-bold text-slate-900">Upgrade Your Plan</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Current plan note */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs text-slate-500">
            You're on <span className="font-semibold capitalize text-slate-700">{currentPlan}</span>.
            You only pay the <span className="font-semibold text-navy">difference</span> to upgrade.
          </p>
        </div>

        {/* Plan cards */}
        <div className="px-6 pb-6 space-y-3">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
              Loading prices…
            </div>
          ) : upgradeable.map(planName => {
            const info       = PLAN_INFO[planName]
            const newPremium = plans?.[planName]?.finalPremium ?? 0
            const topUp      = Math.max(0, newPremium - currentPremium)
            const isBuying   = buying === planName

            return (
              <div key={planName} className={`border-2 rounded-xl p-4 ${info.color}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${info.badge}`}>
                      {info.label}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Full premium: <span className="font-semibold text-slate-700">Rs.{newPremium}/week</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">Rs.{topUp}</p>
                    <p className="text-xs text-slate-500">you pay now</p>
                  </div>
                </div>

                <ul className="space-y-1 mb-3">
                  {info.perks.map(p => (
                    <li key={p} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(planName)}
                  disabled={!!buying}
                  className={`w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 ${info.btn}`}
                >
                  {isBuying ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Zap size={13} /> Upgrade — Pay Rs.{topUp}</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
