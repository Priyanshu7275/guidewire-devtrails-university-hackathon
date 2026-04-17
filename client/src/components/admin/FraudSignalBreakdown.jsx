import React, { useState, useEffect, useMemo } from 'react'
import { ShieldAlert, RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { getAdminClaims } from '../../services/api.js'

/**
 * FraudSignalBreakdown
 * Admin card that tallies all fraud signals across claims and shows
 * a ranked breakdown of signal frequency and severity.
 */

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', bar: 'bg-rose-500',   text: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200',   icon: <AlertTriangle size={11} /> },
  high:     { label: 'High',     bar: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <AlertCircle size={11} /> },
  medium:   { label: 'Medium',   bar: 'bg-navy',        text: 'text-navy',       bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Info size={11} /> },
  low:      { label: 'Low',      bar: 'bg-slate-400',  text: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  icon: <Info size={11} /> },
}

const SIGNAL_LABELS = {
  HIGH_CLAIM_FREQUENCY:      'High Claim Frequency',
  OFF_HOURS_CLAIM:           'Off-Hours Claim',
  BOT_SPEED_SESSION:         'Bot-Speed Session',
  TRIGGER_NOT_VERIFIED:      'Trigger Not Verified',
  GPS_ZONE_MISMATCH:         'GPS Zone Mismatch',
  ZONE_CLAIM_SPIKE:          'Zone Claim Spike',
  SHORT_CLAIM_INTERVAL:      'Short Claim Interval',
  DEVICE_FLAG:               'Device Flag',
  WEATHER_HISTORY_MISMATCH:  'Weather History Mismatch',
  DEVICE_MISMATCH:           'Device Mismatch',
  COORDINATED_CLAIM:         'Coordinated Claim',
  IP_GPS_MISMATCH:           'IP / GPS Mismatch',
}

const SIGNAL_SEVERITY = {
  HIGH_CLAIM_FREQUENCY:      'medium',
  OFF_HOURS_CLAIM:           'low',
  BOT_SPEED_SESSION:         'high',
  TRIGGER_NOT_VERIFIED:      'critical',
  GPS_ZONE_MISMATCH:         'high',
  ZONE_CLAIM_SPIKE:          'medium',
  SHORT_CLAIM_INTERVAL:      'low',
  DEVICE_FLAG:               'low',
  WEATHER_HISTORY_MISMATCH:  'medium',
  DEVICE_MISMATCH:           'high',
  COORDINATED_CLAIM:         'high',
  IP_GPS_MISMATCH:           'medium',
}

export default function FraudSignalBreakdown() {
  const [claims,   setClaims]   = useState([])
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await getAdminClaims()
      setClaims(res.data.claims || [])
    } catch {
      // silently fail — component is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Tally signal counts from all claims that have fraudSignals
  const signalStats = useMemo(() => {
    const counts = {}
    claims.forEach(c => {
      (c.fraudSignals || []).forEach(s => {
        const key = s.type || 'UNKNOWN'
        counts[key] = (counts[key] || 0) + 1
      })
    })
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        label:    SIGNAL_LABELS[type] || type.replace(/_/g, ' '),
        severity: SIGNAL_SEVERITY[type] || 'low',
        count,
      }))
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        const sev = (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
        return sev !== 0 ? sev : b.count - a.count
      })
  }, [claims])

  const totalSignals = signalStats.reduce((s, r) => s + r.count, 0)
  const maxCount     = Math.max(...signalStats.map(s => s.count), 1)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={14} className="text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Fraud Signal Breakdown</p>
            <p className="text-2xs text-slate-400 mt-0.5">
              {totalSignals} signals across {claims.filter(c => (c.fraudSignals || []).length > 0).length} flagged claims
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:text-navy hover:bg-blue-50 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Signal list */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        ) : signalStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <ShieldAlert size={28} className="mb-2" />
            <p className="text-xs text-slate-400">No fraud signals recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {signalStats.map(({ type, label, severity, count }) => {
              const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low
              const pct = Math.round((count / maxCount) * 100)
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border} flex-shrink-0`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-600 truncate">{label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 num ml-2 flex-shrink-0">{count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
