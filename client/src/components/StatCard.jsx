import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({ title, value, icon, color = 'bg-blue-100 text-navy', sub, delta, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
        <div className="flex items-start gap-3">
          <div className="skeleton w-10 h-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-7 w-16 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
          <p className="text-3xl font-bold text-slate-900 num leading-none truncate">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
          {delta !== undefined && (
            <div className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold ${
              delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-slate-400'
            }`}>
              {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {delta > 0 ? '+' : ''}{delta}% this week
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
