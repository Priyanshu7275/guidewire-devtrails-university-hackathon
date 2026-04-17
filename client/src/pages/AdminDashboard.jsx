import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, ShieldCheck, FileText, IndianRupee, Activity,
  TrendingUp, RefreshCw, Zap, BarChart2, PlayCircle,
  Search, Clock, AlertTriangle, CheckCircle2, XCircle, Eye, LogOut, Shield
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import StatCard            from '../components/StatCard.jsx'
import ZoneCommandCenter   from '../components/admin/ZoneCommandCenter.jsx'
import { adminLogout }     from './AdminLogin.jsx'
import toast                from 'react-hot-toast'
import {
  getAdminDashboard, getAdminClaims,
  getZoneSummary, predictZone, simulateDisruption, reviewClaim
} from '../services/api.js'

// ── Seed deterministic fake 30-day history ───────────────────────────────────
function buildDailyHistory() {
  const out = []
  const now  = new Date()
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(now)
    d.setDate(d.getDate() - i)
    const day = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const base = 4 + Math.floor(Math.sin(i * 0.8) * 3 + Math.random() * 6)
    out.push({ day, claims: Math.max(0, base), payout: Math.max(0, (base * 85 + Math.random() * 200) | 0) })
  }
  return out
}

const DAILY_HISTORY = buildDailyHistory()

// ── Trigger colour palette ────────────────────────────────────────────────────
const TRIGGER_COLORS = {
  heavy_rain:      '#0B3B8C',
  extreme_heat:    '#F59E0B',
  dangerous_aqi:   '#059669',
  curfew:          '#EF4444',
  platform_outage: '#8B5CF6',
}

// ── Custom Tooltip for recharts ───────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-white/10">
      <p className="font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value > 100 ? `Rs. ${p.value}` : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Decision badge ────────────────────────────────────────────────────────────
function DecisionBadge({ decision }) {
  const map = {
    AUTO_APPROVE:   { bg: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icon: <CheckCircle2 size={10} /> },
    ADMIN_APPROVED: { bg: 'bg-emerald-100 text-emerald-700 ring-emerald-200', icon: <CheckCircle2 size={10} /> },
    SOFT_HOLD:      { bg: 'bg-amber-100 text-amber-700 ring-amber-200',       icon: <Clock size={10} /> },
    MANUAL_REVIEW:  { bg: 'bg-blue-100 text-navy ring-blue-200',              icon: <Eye size={10} /> },
    AUTO_REJECT:    { bg: 'bg-rose-100 text-rose-700 ring-rose-200',          icon: <XCircle size={10} /> },
    ADMIN_DECLINED: { bg: 'bg-rose-100 text-rose-700 ring-rose-200',          icon: <XCircle size={10} /> },
  }
  const style = map[decision] || { bg: 'bg-slate-100 text-slate-500 ring-slate-200', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full ring-1 ${style.bg}`}>
      {style.icon}
      {decision?.replace(/_/g, ' ')}
    </span>
  )
}

// ── Fraud score bar ───────────────────────────────────────────────────────────
function FraudBar({ score }) {
  const pct   = ((score ?? 0) * 100).toFixed(0)
  const color = score > 0.7 ? 'bg-rose-500'
              : score > 0.3 ? 'bg-amber-400'
              : 'bg-emerald-500'
  const text  = score > 0.7 ? 'text-rose-600'
              : score > 0.3 ? 'text-amber-600'
              : 'text-emerald-600'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-2xs font-bold num ${text}`}>{pct}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()

  // All hooks declared before any conditional return (Rules of Hooks)
  const [kpis,       setKpis]       = useState(null)
  const [zones,      setZones]      = useState([])
  const [claims,     setClaims]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Claims table filters
  const [claimSearch,   setClaimSearch]   = useState('')
  const [fraudFilter,   setFraudFilter]   = useState('all')
  const [decisionFilt,  setDecisionFilt]  = useState('all')
  const [actionLoading, setActionLoading] = useState({})

  // Prediction panel
  const [predPincode, setPredPincode] = useState('201301')
  const [prediction,  setPrediction]  = useState(null)
  const [predLoading, setPredLoading] = useState(false)

  // Simulator panel
  const [simPincode,  setSimPincode]  = useState('201301')
  const [simTrigger,  setSimTrigger]  = useState('heavy_rain')
  const [simValue,    setSimValue]    = useState('22.5')
  const [simResult,   setSimResult]   = useState(null)
  const [simLoading,  setSimLoading]  = useState(false)

  // Synchronous auth check — must come after all useState declarations
  const isAuthed = localStorage.getItem('giginsure_admin') === 'true'

  // loadAll is defined here so it can be called by both useEffect and the Refresh button
  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [kpisRes, claimsRes, zonesRes] = await Promise.all([
        getAdminDashboard(),
        getAdminClaims(),
        getZoneSummary(),
      ])
      setKpis(kpisRes.data)
      setClaims(claimsRes.data.claims || [])
      setZones(zonesRes.data.zones    || [])
      if (silent) toast.success('Dashboard refreshed')
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // All useEffect / useMemo hooks before any conditional return (Rules of Hooks)
  useEffect(() => {
    if (!isAuthed) { navigate('/admin-login', { replace: true }); return }
    loadAll()
  }, [])

  async function runPrediction() {
    setPredLoading(true)
    try {
      const res = await predictZone(predPincode)
      setPrediction(res.data)
    } catch {
      toast.error('Prediction failed')
    } finally {
      setPredLoading(false)
    }
  }

  async function runSimulation() {
    setSimLoading(true)
    setSimResult(null)
    try {
      const res = await simulateDisruption({
        pincode:       Number(simPincode),
        trigger_type:  simTrigger,
        trigger_value: Number(simValue),
      })
      setSimResult(res.data)
      toast.success(`Simulation complete — ${res.data.autoApproved ?? 0} claims auto-approved`)
    } catch {
      toast.error('Simulation failed')
    } finally {
      setSimLoading(false)
    }
  }

  // ── Filtered claims ────────────────────────────────────────────────────────
  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      const matchSearch = !claimSearch
        || (c.triggerType?.toLowerCase().includes(claimSearch.toLowerCase()))
        || (c.decision?.toLowerCase().includes(claimSearch.toLowerCase()))
        || (String(c.claimId).includes(claimSearch))
      const fs = c.fraudScore ?? 0
      const matchFraud = fraudFilter === 'all'
        || (fraudFilter === 'low'  && fs <= 0.3)
        || (fraudFilter === 'med'  && fs > 0.3 && fs <= 0.7)
        || (fraudFilter === 'high' && fs > 0.7)
      const matchDecision = decisionFilt === 'all' || c.decision === decisionFilt
      return matchSearch && matchFraud && matchDecision
    })
  }, [claims, claimSearch, fraudFilter, decisionFilt])

  // ── Trigger donut data ─────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    const counts = {}
    claims.forEach(c => {
      const t = c.triggerType || 'unknown'
      counts[t] = (counts[t] || 0) + 1
    })
    return Object.entries(counts).map(([type, count]) => ({
      name:  type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      fill:  TRIGGER_COLORS[type] || '#94A3B8',
    }))
  }, [claims])

  // ── Forecast bar data ──────────────────────────────────────────────────────
  const forecastData = prediction
    ? Object.entries(prediction.predictions || {}).map(([key, val]) => ({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        prob: val.probabilityPct,
        fill: val.probabilityPct > 60 ? '#EF4444'
            : val.probabilityPct > 25 ? '#F59E0B'
            : '#059669',
      }))
    : []

  const lossRatio = kpis?.lossRatioPct ?? 0

  async function handleReview(claimId, action) {
    setActionLoading(prev => ({ ...prev, [claimId]: action }))
    try {
      const res = await reviewClaim(claimId, action)
      const { decision, payoutAmount } = res.data
      setClaims(prev => prev.map(c =>
        c.claimId === claimId
          ? { ...c, decision, payout: payoutAmount, payoutAmount, status: action === 'approve' ? 'paid' : 'rejected' }
          : c
      ))
      toast.success(
        action === 'approve'
          ? `Claim approved — Rs.${payoutAmount} payout issued`
          : 'Claim declined'
      )
    } catch {
      toast.error('Failed to update claim')
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[claimId]; return n })
    }
  }

  function handleSignOut() {
    adminLogout()
    toast.success('Signed out')
    navigate('/admin-login', { replace: true })
  }

  // Guard comes after all hooks — this is valid (hooks don't run conditionally)
  if (!isAuthed) return null

  // ── Skeleton loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-navy-dark/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
              <Shield size={14} className="text-blue-200" />
            </div>
            <span className="text-white font-bold text-sm">GigInsure</span>
            <span className="text-2xs font-semibold bg-white/15 text-white px-2 py-0.5 rounded-full">Admin</span>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="skeleton h-72 rounded-xl lg:col-span-2" />
            <div className="skeleton h-72 rounded-xl" />
          </div>
          <div className="skeleton h-96 rounded-xl" />
          <div className="skeleton h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">

      {/* ── Admin topbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-navy-dark/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
              <Shield size={14} className="text-blue-200" />
            </div>
            <span className="text-white font-bold text-sm">GigInsure</span>
            <span className="text-2xs font-semibold bg-white/15 text-white px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <button onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Operations Dashboard
              <span className="inline-flex items-center gap-1 text-2xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full ml-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">GigInsure — DEVTrails 2026 · Guidewire Challenge</p>
          </div>
          <button onClick={() => loadAll(true)} disabled={refreshing}
            className="inline-flex items-center gap-2 btn-ghost text-sm py-2 px-4 h-auto">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── KPI Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Workers"   value={kpis?.totalWorkers   ?? 0}
            icon={<Users size={18} />}       color="bg-blue-100 text-navy"
            sub="registered on platform" />
          <StatCard title="Active Policies" value={kpis?.activePolicies ?? 0}
            icon={<ShieldCheck size={18} />} color="bg-emerald-100 text-emerald-600"
            sub="coverage in force" />
          <StatCard title="Total Claims"    value={kpis?.totalClaims    ?? 0}
            icon={<FileText size={18} />}    color="bg-violet-100 text-violet-600"
            sub={`${kpis?.fraudFlagged ?? 0} flagged for review`} />
          <StatCard title="Total Payouts"   value={`Rs.${(kpis?.totalPaidInr ?? 0).toLocaleString('en-IN')}`}
            icon={<IndianRupee size={18} />} color="bg-amber-100 text-amber-600"
            sub="disbursed to workers" />

          {/* Loss Ratio — special card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card p-4 flex flex-col justify-between col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest">Loss Ratio</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                lossRatio > 80 ? 'bg-rose-100' : lossRatio > 50 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                <Activity size={14} className={
                  lossRatio > 80 ? 'text-rose-600' : lossRatio > 50 ? 'text-amber-600' : 'text-emerald-600'} />
              </div>
            </div>
            <p className={`text-3xl font-bold num ${lossRatio > 80 ? 'text-rose-600' : lossRatio > 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
              {lossRatio}<span className="text-lg">%</span>
            </p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full transition-all ${
                lossRatio > 80 ? 'bg-rose-500' : lossRatio > 50 ? 'bg-amber-400' : 'bg-emerald-500'
              }`} style={{ width: `${Math.min(lossRatio, 100)}%` }} />
            </div>
            <p className="text-2xs text-slate-400 mt-1.5 num">
              {kpis?.fraudFlagged ?? 0} fraud flags
            </p>
          </div>
        </div>

        {/* ── Daily Claims Trend + Trigger Donut ──────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Line chart — 30-day claims */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp size={14} className="text-navy" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Claims Volume</p>
                <p className="text-2xs text-slate-400">Last 30 days — daily count</p>
              </div>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={DAILY_HISTORY} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94A3B8' }}
                    axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line
                    type="monotone" dataKey="claims" name="Claims"
                    stroke="#0B3B8C" strokeWidth={2} dot={false}
                    activeDot={{ r: 4, fill: '#0B3B8C', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trigger donut */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Trigger Breakdown</p>
              <p className="text-2xs text-slate-400 mt-0.5">All-time claim distribution</p>
            </div>
            <div className="p-5 flex flex-col items-center">
              {donutData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={donutData} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={72}
                        paddingAngle={3} dataKey="value"
                      >
                        {donutData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v, n) => [v, n]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full space-y-1.5 mt-2">
                    {donutData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                          {d.name}
                        </span>
                        <span className="text-xs font-bold text-slate-700 num">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                  <BarChart2 size={32} className="mb-2" />
                  <p className="text-xs text-slate-400">No claims yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Zone Command Center ──────────────────────────────────────── */}
        <ZoneCommandCenter />

        {/* ── Zone Overview Table ──────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">Zone Trigger Overview</p>
            <p className="text-2xs text-slate-400 mt-0.5">Live weather trigger status per zone</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pincode</th>
                  <th>City</th>
                  <th>Active Triggers</th>
                  <th>Last Checked</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-6 text-xs">No zone data</td></tr>
                ) : zones.map(z => (
                  <tr key={z.pincode}>
                    <td className="font-mono font-bold text-slate-700">{z.pincode}</td>
                    <td className="text-xs text-slate-600">{z.city || '—'}</td>
                    <td>
                      {z.activeTriggers?.length > 0
                        ? <span className="text-rose-600 font-semibold text-2xs">
                            {z.activeTriggers.map(t => t.type).join(', ')}
                          </span>
                        : <span className="text-slate-300 text-2xs">None</span>}
                    </td>
                    <td className="text-2xs text-slate-400 whitespace-nowrap">
                      {z.lastChecked
                        ? new Date(z.lastChecked).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td>
                      <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${
                        (z.anyActive || z.anyTriggerActive)
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {(z.anyActive || z.anyTriggerActive) ? 'Alert' : 'Clear'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Claims Ledger ────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Claims Ledger</p>
              <p className="text-2xs text-slate-400 mt-0.5">{filteredClaims.length} of {claims.length} records</p>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search trigger, decision…"
                  value={claimSearch}
                  onChange={e => setClaimSearch(e.target.value)}
                  className="pl-8 pr-3 h-8 text-xs border border-slate-200 rounded-lg focus-visible:ring-2 focus-visible:ring-navy focus:outline-none bg-slate-50 w-44"
                />
              </div>
              <select value={fraudFilter} onChange={e => setFraudFilter(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy">
                <option value="all">All Fraud Scores</option>
                <option value="low">Low (&lt;0.3)</option>
                <option value="med">Medium (0.3–0.7)</option>
                <option value="high">High (&gt;0.7)</option>
              </select>
              <select value={decisionFilt} onChange={e => setDecisionFilt(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy">
                <option value="all">All Decisions</option>
                <option value="AUTO_APPROVE">Auto Approved</option>
                <option value="SOFT_HOLD">Soft Hold</option>
                <option value="MANUAL_REVIEW">Manual Review</option>
                <option value="AUTO_REJECT">Auto Rejected</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Worker</th>
                  <th>Trigger</th>
                  <th>Fraud Score</th>
                  <th>Decision</th>
                  <th className="text-right">Payout</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-400 py-8 text-xs">
                      No claims match your filters
                    </td>
                  </tr>
                ) : filteredClaims.slice(0, 25).map(c => {
                  const reviewable = c.decision === 'SOFT_HOLD' || c.decision === 'MANUAL_REVIEW'
                  const busy = actionLoading[c.claimId]
                  return (
                  <tr key={c.claimId}
                    className={(c.fraudScore ?? 0) > 0.7 ? 'bg-rose-50/40' : ''}>
                    <td className="text-slate-400 text-2xs font-mono">#{c.claimId?.slice(-6)}</td>
                    <td className="text-xs font-medium text-slate-700">
                      {c.worker?.name || `Worker #${c.worker?.id?.slice(-4) || '—'}`}
                    </td>
                    <td className="text-xs capitalize text-slate-600">{c.triggerType?.replace(/_/g, ' ')}</td>
                    <td><FraudBar score={c.fraudScore} /></td>
                    <td><DecisionBadge decision={c.decision} /></td>
                    <td className={`text-right text-xs font-bold num ${(c.payoutAmount ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {(c.payoutAmount ?? 0) > 0 ? `Rs.${c.payoutAmount}` : '—'}
                    </td>
                    <td className="text-2xs text-slate-400 whitespace-nowrap">
                      {c.initiatedAt ? new Date(c.initiatedAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      {reviewable ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReview(c.claimId, 'approve')}
                            disabled={!!busy}
                            title="Approve claim"
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50">
                            {busy === 'approve'
                              ? <span className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                              : <CheckCircle2 size={11} />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(c.claimId, 'decline')}
                            disabled={!!busy}
                            title="Decline claim"
                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50">
                            {busy === 'decline'
                              ? <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                              : <XCircle size={11} />}
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-2xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Forecast + Simulator ─────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Next-Week Forecast */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart2 size={14} className="text-navy" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Next-Week Forecast</p>
                <p className="text-2xs text-slate-400">ML risk prediction by trigger type</p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <input type="number" placeholder="Pincode"
                value={predPincode} onChange={e => setPredPincode(e.target.value)}
                className="input flex-1 h-9 text-sm" />
              <button onClick={runPrediction} disabled={predLoading}
                className="btn-primary h-9 px-4 text-xs py-0">
                {predLoading ? <RefreshCw size={13} className="animate-spin" /> : 'Predict'}
              </button>
            </div>

            {prediction ? (
              <>
                <div className="flex items-center gap-2 mb-3 bg-rose-50 rounded-lg px-3 py-2 text-xs border border-rose-100">
                  <TrendingUp size={12} className="text-rose-500 flex-shrink-0" />
                  <span className="text-slate-600">Dominant risk:</span>
                  <strong className="text-rose-600">{prediction.summary?.dominantRisk?.replace(/_/g, ' ')}</strong>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={forecastData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} unit="%" axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="prob" name="Probability" radius={[4,4,0,0]}>
                      {forecastData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    ['Expected Claims',  prediction.summary?.expectedClaims],
                    ['Expected Payout',  `Rs.${prediction.summary?.expectedPayoutInr ?? 0}`],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-2xs text-slate-400 font-medium mb-0.5">{label}</p>
                      <p className="text-lg font-bold text-slate-900 num">{val}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                <BarChart2 size={32} className="mb-2" />
                <p className="text-xs text-slate-400">Enter a pincode and click Predict</p>
              </div>
            )}
          </div>

          {/* Disruption Simulator */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Disruption Simulator</p>
              </div>
            </div>
            <p className="text-2xs text-slate-400 mb-4 ml-9">
              Fire a synthetic disruption — auto-files claims for all insured workers in the zone.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Pincode</label>
                <input type="number" className="input h-9 text-sm"
                  value={simPincode} onChange={e => setSimPincode(e.target.value)} />
              </div>
              <div>
                <label className="label">Trigger Type</label>
                <select className="select h-9 text-sm"
                  value={simTrigger} onChange={e => setSimTrigger(e.target.value)}>
                  <option value="heavy_rain">Heavy Rain</option>
                  <option value="extreme_heat">Extreme Heat</option>
                  <option value="dangerous_aqi">Dangerous AQI</option>
                  <option value="curfew">Curfew / Strike</option>
                  <option value="platform_outage">Platform Outage</option>
                </select>
              </div>
              <div>
                <label className="label">Trigger Value</label>
                <input type="number" className="input h-9 text-sm"
                  value={simValue} onChange={e => setSimValue(e.target.value)} />
              </div>
            </div>

            <button onClick={runSimulation} disabled={simLoading}
              className="w-full btn-primary py-2.5 text-sm mb-4 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', boxShadow: '0 4px 16px rgba(239,68,68,.25)' }}>
              {simLoading
                ? <><RefreshCw size={14} className="animate-spin" /> Simulating…</>
                : <><PlayCircle size={14} /> Run Simulation</>}
            </button>

            {simResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 mb-3">
                  <ShieldCheck size={14} className="text-emerald-600" /> Simulation Complete
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {[
                    ['Workers Affected', simResult.workersAffected,                      'text-slate-900'],
                    ['Auto Approved',    simResult.autoApproved,                          'text-emerald-700'],
                    ['Total Payout',    `Rs.${simResult.totalPayoutInr ?? 0}`,            'text-emerald-700'],
                    ['Processing',       simResult.processingMs,                          'text-slate-900'],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} className="bg-white rounded-lg p-2.5 border border-emerald-100">
                      <p className="text-2xs text-slate-400">{lbl}</p>
                      <p className={`text-base font-bold num ${col}`}>{val}</p>
                    </div>
                  ))}
                </div>
                {simResult.story && (
                  <p className="text-2xs text-emerald-700 italic border-t border-emerald-200 pt-2.5">{simResult.story}</p>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
