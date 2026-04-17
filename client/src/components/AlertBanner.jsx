import React from 'react'
import { AlertTriangle, X, FileText, Zap, ArrowRight, ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'

const triggerLabels = {
  heavy_rain:      'Heavy Rain',
  extreme_heat:    'Extreme Heat',
  dangerous_aqi:   'Dangerous AQI',
  curfew:          'Curfew / Strike',
  platform_outage: 'Platform Outage',
}

export default function AlertBanner({ triggers = [], onFileClaim, onDismiss, hasPolicy = true }) {
  if (!triggers || triggers.length === 0) return null

  // ── No policy: show informational amber banner ──
  if (!hasPolicy) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 flex items-start gap-3 animate-fade-in">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <ShieldOff size={15} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Disruption detected in your zone</p>
          <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
            Workers with active policies in your area are receiving payouts right now.
          </p>
        </div>
        <Link to="/register"
          className="flex-shrink-0 inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          Get Covered <ArrowRight size={12} />
        </Link>
        {onDismiss && (
          <button onClick={onDismiss}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-amber-400 hover:text-amber-600 transition-colors rounded-md hover:bg-amber-100">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  // ── Has policy: actionable red banner ──
  const names   = triggers.map(t => triggerLabels[t.type] || t.type)
  const summary = names.length === 1 ? names[0] : names.slice(0,-1).join(', ') + ' & ' + names[names.length-1]

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-rose-600 to-rose-500 rounded-xl shadow-lg shadow-rose-500/20 animate-fade-in">
      <div className="absolute inset-0 noise pointer-events-none opacity-40" />
      <div className="relative px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Disruption Alert — You May Be Eligible</p>
          <p className="text-xs text-rose-100 mt-0.5">{summary} in your zone</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {triggers.map((t, i) => (
              <span key={i} className="text-2xs font-semibold bg-white/20 text-white border border-white/25 px-2 py-0.5 rounded-full">
                {triggerLabels[t.type] || t.type}{t.value ? ` · ${t.value}${t.unit || ''}` : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onFileClaim && (
            <button onClick={onFileClaim}
              className="flex items-center gap-1.5 bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">
              <FileText size={12} /> File Claim
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss}
              className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
