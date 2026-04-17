import React from 'react'
import { ShieldCheck, ShieldOff, Clock, IndianRupee, AlertCircle, Zap, CalendarDays } from 'lucide-react'

const planGradient = {
  basic:    'from-slate-600 to-slate-800',
  standard: 'from-[#082B6B] to-[#0B3B8C]',
  premium:  'from-violet-700 to-purple-800',
}

const planAccent = {
  basic:    'bg-slate-100 text-slate-700',
  standard: 'bg-blue-100 text-navy',
  premium:  'bg-violet-100 text-violet-700',
}

export default function PolicyCard({ policy, onFileClaim, onBuyPolicy, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <div className="skeleton h-24 rounded-none" />
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-14 rounded-lg" />
            <div className="skeleton h-14 rounded-lg" />
          </div>
          <div className="skeleton h-10 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center py-10 px-5 gap-3">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
          <ShieldOff size={22} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">No Active Policy</p>
          <p className="text-xs text-slate-400 mt-0.5">You are not covered right now</p>
        </div>
        <button onClick={onBuyPolicy}
          className="btn-primary mt-1 text-xs px-4 py-2 h-auto">
          <Zap size={13} /> Get Covered — from Rs.35
        </button>
      </div>
    )
  }

  const gradient = planGradient[policy.plan] || 'from-[#082B6B] to-[#0B3B8C]'
  const accent   = planAccent[policy.plan]   || 'bg-blue-100 text-navy'
  const isUrgent = policy.daysLeft <= 2

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${gradient} px-5 py-4 relative overflow-hidden`}>
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-white/80" />
            <span className="text-white font-semibold text-sm capitalize">{policy.plan} Shield</span>
          </div>
          <span className="text-2xs font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">ACTIVE</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-white/60 text-sm">Rs.</span>
          <span className="text-2xl font-bold text-white num">{policy.coverageCap}</span>
          <span className="text-white/50 text-xs ml-1">coverage cap</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className={isUrgent ? 'text-rose-400' : 'text-slate-400'} />
              <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold">Days Left</p>
            </div>
            <p className={`text-xl font-bold num leading-none ${isUrgent ? 'text-rose-500' : 'text-slate-900'}`}>
              {policy.daysLeft}
              {isUrgent && <span className="text-xs font-semibold ml-1 text-rose-400">Renew!</span>}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Max Hours</p>
            <p className="text-xl font-bold text-slate-900 num leading-none">
              {policy.maxHours}<span className="text-sm font-normal text-slate-400"> hrs</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          <span className="flex items-center gap-1"><IndianRupee size={11} /> {policy.premiumPaid}/week</span>
          <span className="flex items-center gap-1"><CalendarDays size={11} /> Expires {new Date(policy.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</span>
        </div>

        <button onClick={onFileClaim}
          className="btn-primary w-full text-xs py-2.5 h-auto">
          <AlertCircle size={13} /> File a Claim
        </button>
      </div>
    </div>
  )
}
