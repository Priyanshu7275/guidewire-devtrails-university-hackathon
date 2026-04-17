/**
 * ZoneCommandCenter
 * ─────────────────────────────────────────────────────────────────────────────
 * The admin dashboard's centerpiece. Replaces the India scatter-plot map with
 * a data-dense, Bloomberg-terminal-style operations panel that answers:
 *   1. Where is money at risk RIGHT NOW?
 *   2. Who is eligible for automatic payout?
 *   3. Should I approve, hold, or investigate?
 *
 * Layout
 *   ┌── Live Status Bar (dark ticker) ──────────────────────────────────┐
 *   ├── Filter bar + search ────────────────────────────────────────────┤
 *   ├── Zone table (sortable, expandable rows) ───────────────────────────┤
 *   │    └─ Expanded: worker cards with fraud scores + per-claim actions │
 *   └───────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle, Users, IndianRupee, Clock, RefreshCw,
  ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Eye, Search, Zap, Shield, TrendingUp, Activity,
} from 'lucide-react'
import {
  getEligibilityMapData, getEligibilityZoneDetail, batchApproveZone, reviewClaim,
} from '../../services/api.js'
import toast from 'react-hot-toast'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString('en-IN')

function fraudBg(score) {
  if (score == null) return ''
  if (score > 0.7) return 'text-red-600 bg-red-50'
  if (score > 0.3) return 'text-amber-600 bg-amber-50'
  return 'text-emerald-600 bg-emerald-50'
}

function claimStatusStyle(status) {
  switch (status) {
    case 'paid':         return 'text-emerald-700 bg-emerald-100'
    case 'approved':     return 'text-emerald-700 bg-emerald-100'
    case 'pending':      return 'text-amber-700 bg-amber-100'
    case 'under_review': return 'text-blue-700 bg-blue-100'
    case 'rejected':     return 'text-red-700 bg-red-100'
    default:             return 'text-slate-500 bg-slate-100'
  }
}

// ── Ticker metric card ────────────────────────────────────────────────────────
function TickerCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 border-r border-white/8 ${accent}`}>
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-white/80" />
      </div>
      <div>
        <p className="text-white font-bold text-lg leading-none num tracking-tight">{value}</p>
        <p className="text-white/50 text-2xs font-medium mt-0.5 uppercase tracking-widest">{label}</p>
        {sub && <p className="text-white/35 text-2xs">{sub}</p>}
      </div>
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = {
    ACTIVE:   { dot: 'bg-red-400 animate-pulse',  text: 'text-red-400',   ring: 'ring-red-500/30',   bg: 'bg-red-500/10'   },
    ELEVATED: { dot: 'bg-amber-400',              text: 'text-amber-400', ring: 'ring-amber-500/30', bg: 'bg-amber-500/10' },
    NORMAL:   { dot: 'bg-emerald-400',            text: 'text-emerald-400', ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10' },
  }
  const s = cfg[status] || cfg.NORMAL
  return (
    <span className={`inline-flex items-center gap-1.5 text-2xs font-bold px-2 py-0.5 rounded-full ring-1 ${s.bg} ${s.ring} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status}
    </span>
  )
}

// ── Trigger chips ─────────────────────────────────────────────────────────────
function TriggerChips({ triggers }) {
  if (!triggers?.length) return <span className="text-slate-300 text-2xs">—</span>
  const ABBR = {
    heavy_rain: 'RAIN', extreme_heat: 'HEAT', dangerous_aqi: 'AQI',
    curfew: 'CURFEW', platform_outage: 'OUTAGE',
  }
  return (
    <div className="flex flex-wrap gap-1">
      {triggers.map((t, i) => (
        <span key={i}
          className="text-2xs font-bold bg-red-100 text-red-700 ring-1 ring-red-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
          {ABBR[t.type] || t.type} {t.value != null ? `·${t.value}` : ''}
        </span>
      ))}
    </div>
  )
}

// ── Fraud bar ─────────────────────────────────────────────────────────────────
function FraudBar({ score }) {
  if (score == null) return <span className="text-slate-300 text-2xs">—</span>
  const pct   = Math.round(score * 100)
  const color = score > 0.7 ? 'bg-red-500' : score > 0.3 ? 'bg-amber-400' : 'bg-emerald-500'
  const text  = score > 0.7 ? 'text-red-600' : score > 0.3 ? 'text-amber-600' : 'text-emerald-600'
  return (
    <div className="flex items-center gap-2 min-w-[64px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-2xs font-bold num ${text} w-6 text-right`}>{pct}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ZoneCommandCenter() {
  const [zones,        setZones]        = useState([])
  const [summary,      setSummary]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [filter,       setFilter]       = useState('all')
  const [search,       setSearch]       = useState('')
  const [sortKey,      setSortKey]      = useState('status')
  const [expandedPin,  setExpandedPin]  = useState(null)
  const [details,      setDetails]      = useState({})      // { [pincode]: zoneDetail }
  const [detailLoad,   setDetailLoad]   = useState({})      // { [pincode]: bool }
  const [actionLoad,   setActionLoad]   = useState({})      // { [claimId]: action }
  const [batchLoad,    setBatchLoad]    = useState({})      // { [pincode]: bool }
  const [lastUpdated,  setLastUpdated]  = useState(null)

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else         setRefreshing(true)
    try {
      const res = await getEligibilityMapData()
      setZones(res.data.zones   || [])
      setSummary(res.data.summary || null)
      setLastUpdated(new Date())
    } catch {
      if (!silent) toast.error('Failed to load zone data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 30_000)
    return () => clearInterval(id)
  }, [load])

  // ── Expand / fetch zone detail ─────────────────────────────────────────
  async function toggleExpand(pincode) {
    if (expandedPin === pincode) { setExpandedPin(null); return }
    setExpandedPin(pincode)
    if (details[pincode]) return  // already cached
    setDetailLoad(p => ({ ...p, [pincode]: true }))
    try {
      const res = await getEligibilityZoneDetail(pincode)
      setDetails(p => ({ ...p, [pincode]: res.data }))
    } catch {
      toast.error('Failed to load zone detail')
    } finally {
      setDetailLoad(p => { const n = { ...p }; delete n[pincode]; return n })
    }
  }

  // ── Batch approve zone ────────────────────────────────────────────────
  async function handleBatchApprove(pincode, e) {
    e.stopPropagation()
    setBatchLoad(p => ({ ...p, [pincode]: true }))
    try {
      const res = await batchApproveZone(pincode)
      toast.success(res.data.message)
      // Refresh detail + zones
      const [detailRes] = await Promise.all([getEligibilityZoneDetail(pincode)])
      setDetails(p => ({ ...p, [pincode]: detailRes.data }))
      load(true)
    } catch {
      toast.error('Batch approve failed')
    } finally {
      setBatchLoad(p => { const n = { ...p }; delete n[pincode]; return n })
    }
  }

  // ── Per-claim approve / decline ───────────────────────────────────────
  async function handleClaimAction(pincode, claimId, action) {
    setActionLoad(p => ({ ...p, [claimId]: action }))
    try {
      await reviewClaim(claimId, action)
      toast.success(action === 'approve' ? 'Claim approved' : 'Claim declined')
      const res = await getEligibilityZoneDetail(pincode)
      setDetails(p => ({ ...p, [pincode]: res.data }))
      load(true)
    } catch {
      toast.error('Action failed')
    } finally {
      setActionLoad(p => { const n = { ...p }; delete n[claimId]; return n })
    }
  }

  // ── Filtering + sorting ───────────────────────────────────────────────
  const STATUS_ORDER = { ACTIVE: 0, ELEVATED: 1, NORMAL: 2 }

  const visible = zones
    .filter(z => {
      if (filter !== 'all' && z.status !== filter.toUpperCase()) return false
      if (search) {
        const q = search.toLowerCase()
        return z.city.toLowerCase().includes(q) || z.pincode.includes(q) || z.state.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'status')   return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      if (sortKey === 'payout')   return (b.pendingPayout || 0) - (a.pendingPayout || 0)
      if (sortKey === 'eligible') return (b.activePolicyCount || 0) - (a.activePolicyCount || 0)
      if (sortKey === 'fraud')    return (b.avgFraudScore || 0) - (a.avgFraudScore || 0)
      return 0
    })

  // ── Column header helper ──────────────────────────────────────────────
  function SortTh({ label, col, className = '' }) {
    const active = sortKey === col
    return (
      <th
        className={`px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-widest cursor-pointer select-none
          ${active ? 'text-navy' : 'text-slate-400'} hover:text-slate-700 transition-colors ${className}`}
        onClick={() => setSortKey(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          {active && <TrendingUp size={9} />}
        </span>
      </th>
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <div className="h-14 bg-[#0F172A] animate-pulse" />
        <div className="p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">

      {/* ── Live Status Ticker ─────────────────────────────────────────── */}
      <div className="bg-[#0F172A] flex items-stretch overflow-x-auto">

        {/* Title */}
        <div className="flex items-center gap-2.5 px-5 py-3 border-r border-white/10 flex-shrink-0">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
            <Activity size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white font-bold text-xs tracking-wide uppercase">Zone Command Center</p>
            <p className="text-white/35 text-2xs">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
            </p>
          </div>
        </div>

        <TickerCard
          icon={AlertCircle}
          label="Active Zones"
          value={summary?.activeZones ?? 0}
          accent="bg-red-500/10"
          sub={summary?.activeZones ? 'Triggers firing now' : 'All clear'}
        />
        <TickerCard
          icon={Users}
          label="Workers Eligible"
          value={summary?.totalEligibleWorkers ?? 0}
          accent=""
          sub="with active policy"
        />
        <TickerCard
          icon={IndianRupee}
          label="Pending Payout"
          value={`Rs.${fmt(summary?.totalPendingPayout)}`}
          accent="bg-amber-500/10"
          sub={`${summary?.totalPendingClaims ?? 0} claims pending`}
        />
        <TickerCard
          icon={Shield}
          label="Already Paid"
          value={`Rs.${fmt(summary?.totalPaid)}`}
          accent="bg-emerald-500/10"
          sub="auto-approved & settled"
        />
        <TickerCard
          icon={Clock}
          label="Settlement Speed"
          value="< 90s"
          accent=""
          sub="parametric auto-payout"
        />

        {/* Refresh */}
        <div className="ml-auto flex items-center px-4 border-l border-white/10 flex-shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        {/* Status tabs */}
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
          {[
            { key: 'all',      label: `All (${zones.length})` },
            { key: 'active',   label: `Active (${zones.filter(z => z.status === 'ACTIVE').length})` },
            { key: 'elevated', label: `Elevated (${zones.filter(z => z.status === 'ELEVATED').length})` },
            { key: 'normal',   label: `Normal (${zones.filter(z => z.status === 'NORMAL').length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-3 py-1 text-2xs font-semibold rounded-md transition-all ${
                filter === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search city, pincode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 h-8 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-navy w-44"
          />
        </div>

        <p className="text-2xs text-slate-400 flex-shrink-0">
          {visible.length} of {zones.length} zones · click row to expand
        </p>
      </div>

      {/* ── Zone Table ────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-left w-6" />
              <SortTh label="Zone"       col="status"   />
              <th className="px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-widest text-slate-400">Active Triggers</th>
              <SortTh label="Eligible"   col="eligible" />
              <th className="px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-widest text-slate-400">Claims</th>
              <SortTh label="Pending Rs" col="payout"   />
              <th className="px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-widest text-slate-400">Paid Rs</th>
              <SortTh label="Avg Fraud"  col="fraud"    />
              <th className="px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-widest text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                  No zones match your filter
                </td>
              </tr>
            )}

            {visible.map(zone => {
              const isExpanded = expandedPin === zone.pincode
              const detail     = details[zone.pincode]
              const isLoading  = detailLoad[zone.pincode]
              const isBatch    = batchLoad[zone.pincode]
              const rowBg      = zone.status === 'ACTIVE'
                ? 'bg-red-50/30 hover:bg-red-50/60'
                : zone.status === 'ELEVATED'
                  ? 'bg-amber-50/20 hover:bg-amber-50/40'
                  : 'hover:bg-slate-50/70'

              return (
                <React.Fragment key={zone.pincode}>
                  {/* ── Main Row ──────────────────────────────────────── */}
                  <tr
                    className={`border-b border-slate-100 cursor-pointer transition-colors ${rowBg}
                      ${isExpanded ? 'border-b-0' : ''}`}
                    onClick={() => toggleExpand(zone.pincode)}
                  >
                    {/* Expand chevron */}
                    <td className="pl-4 pr-2 py-3 text-slate-400">
                      {isExpanded
                        ? <ChevronDown size={13} className="text-navy" />
                        : <ChevronRight size={13} />}
                    </td>

                    {/* Zone name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StatusPill status={zone.status} />
                        <div>
                          <p className="font-semibold text-slate-800">{zone.city}</p>
                          <p className="text-2xs text-slate-400 font-mono">{zone.pincode} · {zone.state}</p>
                        </div>
                      </div>
                    </td>

                    {/* Active triggers */}
                    <td className="px-4 py-3">
                      <TriggerChips triggers={zone.activeTriggers} />
                    </td>

                    {/* Eligible workers */}
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800 num">{zone.activePolicyCount}</span>
                      <span className="text-slate-400 text-2xs ml-1">/ {zone.workerCount}</span>
                    </td>

                    {/* Claims (pending / total) */}
                    <td className="px-4 py-3">
                      {zone.totalClaims > 0 ? (
                        <div>
                          <span className={`font-bold num ${zone.pendingClaimCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {zone.pendingClaimCount}
                          </span>
                          <span className="text-slate-400 text-2xs ml-1">pending</span>
                          <p className="text-2xs text-slate-400">{zone.totalClaims} total</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Pending payout */}
                    <td className="px-4 py-3">
                      {zone.pendingPayout > 0 ? (
                        <span className="font-bold text-amber-700 num">Rs.{fmt(zone.pendingPayout)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Total paid */}
                    <td className="px-4 py-3">
                      {zone.totalPaid > 0 ? (
                        <span className="font-semibold text-emerald-600 num">Rs.{fmt(zone.totalPaid)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Avg fraud score */}
                    <td className="px-4 py-3 min-w-[100px]">
                      <FraudBar score={zone.avgFraudScore} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {zone.pendingClaimCount > 0 && (
                          <button
                            onClick={e => handleBatchApprove(zone.pincode, e)}
                            disabled={isBatch}
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {isBatch
                              ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                              : <Zap size={10} />}
                            Approve All
                          </button>
                        )}
                        {zone.status === 'ACTIVE' && zone.pendingClaimCount === 0 && (
                          <span className="text-2xs text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={11} /> Clear
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── Expanded Worker Detail ─────────────────────────── */}
                  {isExpanded && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={9} className="px-0 py-0">
                        <div className="bg-slate-50/80 border-t border-slate-100">

                          {isLoading ? (
                            <div className="py-6 flex justify-center">
                              <div className="spinner" />
                            </div>

                          ) : detail ? (
                            <div className="px-6 py-4">

                              {/* Active trigger pills */}
                              {detail.activeTriggers?.length > 0 && (
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                                    Active Triggers:
                                  </span>
                                  {detail.activeTriggers.map((t, i) => (
                                    <span key={i}
                                      className="text-2xs font-bold bg-red-100 text-red-700 ring-1 ring-red-200 px-2 py-0.5 rounded-full capitalize">
                                      {t.type?.replace(/_/g, ' ')} · {t.value}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Stats row */}
                              <div className="flex items-center gap-4 mb-3 pb-3 border-b border-slate-200">
                                {[
                                  ['Eligible',  detail.stats?.eligible    ?? 0, 'text-navy'],
                                  ['Filed',     detail.stats?.claimsFiled ?? 0, 'text-violet-600'],
                                  ['Auto-paid', detail.stats?.autoPaid    ?? 0, 'text-emerald-600'],
                                  ['Pending',   detail.stats?.pending     ?? 0, 'text-amber-600'],
                                ].map(([lbl, val, color]) => (
                                  <div key={lbl} className="flex items-center gap-1.5">
                                    <span className={`text-sm font-bold num ${color}`}>{val}</span>
                                    <span className="text-2xs text-slate-400">{lbl}</span>
                                  </div>
                                ))}
                                {detail.stats?.pending > 0 && (
                                  <button
                                    onClick={() => handleBatchApprove(zone.pincode, { stopPropagation: () => {} })}
                                    disabled={batchLoad[zone.pincode]}
                                    className="ml-auto inline-flex items-center gap-1.5 text-2xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                  >
                                    {batchLoad[zone.pincode]
                                      ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                      : <Zap size={11} />}
                                    Approve All Pending ({detail.stats.pending})
                                  </button>
                                )}
                              </div>

                              {/* Worker table */}
                              {detail.workers?.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                                      <th className="text-left pb-2 pr-4">Name</th>
                                      <th className="text-left pb-2 pr-4">Platform</th>
                                      <th className="text-left pb-2 pr-4">Plan</th>
                                      <th className="text-left pb-2 pr-4">Claim Status</th>
                                      <th className="text-left pb-2 pr-4">Fraud Score</th>
                                      <th className="text-left pb-2">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.workers.map(w => {
                                      const isReviewable = ['SOFT_HOLD', 'MANUAL_REVIEW'].includes(w.claimDecision)
                                      const busy = actionLoad[w.claimId]
                                      return (
                                        <tr key={w.workerId}
                                          className="border-t border-slate-200/60 hover:bg-white/70 transition-colors">
                                          <td className="py-2 pr-4">
                                            <p className="font-semibold text-slate-800">{w.name}</p>
                                          </td>
                                          <td className="py-2 pr-4">
                                            <span className="capitalize text-slate-600">{w.platform}</span>
                                          </td>
                                          <td className="py-2 pr-4">
                                            {w.plan
                                              ? <span className="capitalize text-slate-600">{w.plan}</span>
                                              : <span className="text-slate-300">—</span>}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {w.claimStatus ? (
                                              <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize ${claimStatusStyle(w.claimStatus)}`}>
                                                {w.claimStatus.replace('_', ' ')}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">No claim</span>
                                            )}
                                          </td>
                                          <td className="py-2 pr-4">
                                            {w.fraudScore != null ? (
                                              <span className={`text-xs font-bold num px-2 py-0.5 rounded-md ${fraudBg(w.fraudScore)}`}>
                                                {(w.fraudScore * 100).toFixed(0)}%
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">—</span>
                                            )}
                                          </td>
                                          <td className="py-2">
                                            {isReviewable && w.claimId ? (
                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  onClick={() => handleClaimAction(zone.pincode, w.claimId, 'approve')}
                                                  disabled={!!busy}
                                                  className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50"
                                                >
                                                  {busy === 'approve'
                                                    ? <span className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                                    : <CheckCircle2 size={10} />}
                                                  Approve
                                                </button>
                                                <button
                                                  onClick={() => handleClaimAction(zone.pincode, w.claimId, 'decline')}
                                                  disabled={!!busy}
                                                  className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                                                >
                                                  {busy === 'decline'
                                                    ? <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                    : <XCircle size={10} />}
                                                  Decline
                                                </button>
                                              </div>
                                            ) : (
                                              <span className="text-slate-300 text-2xs">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-slate-400 py-2">No workers registered in this zone</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <p className="text-2xs text-slate-400">
          {visible.length} zone{visible.length !== 1 ? 's' : ''} · auto-refreshes every 30s
          {lastUpdated && ` · last updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        </p>
        <div className="flex items-center gap-3 text-2xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />Active</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Elevated</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Normal</span>
        </div>
      </div>
    </div>
  )
}
