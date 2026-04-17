import React, { useState, useEffect, useCallback } from 'react'
import {
  IndianRupee, FileText, TrendingUp, ShieldCheck, AlertTriangle,
  RefreshCw, Zap, CalendarDays, Clock, BarChart2, Newspaper
} from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { useGPS }  from '../hooks/useGPS.js'
import Navbar       from '../components/Navbar.jsx'
import AlertBanner  from '../components/AlertBanner.jsx'
import PolicyCard   from '../components/PolicyCard.jsx'
import WeatherWidget from '../components/WeatherWidget.jsx'
import ClaimModal    from '../components/ClaimModal.jsx'
import UpgradeModal  from '../components/UpgradeModal.jsx'
import { getActivePolicy, getClaimsHistory, checkTriggers } from '../services/api.js'

const decisionBadge = {
  AUTO_APPROVE:  'badge-green',
  SOFT_HOLD:     'badge-yellow',
  MANUAL_REVIEW: 'badge-blue',
  AUTO_REJECT:   'badge-red',
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Generate fake 7-day risk trend based on current score
function buildRiskTrend(baseScore) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return days.map((d, i) => ({
    day: d,
    risk: Math.max(10, Math.min(95, baseScore + (Math.random() - 0.5) * 18)),
  }))
}

export default function WorkerDashboard() {
  const { worker }                         = useAuth()
  const { lat, lng, request: requestGPS } = useGPS()

  const [policy,          setPolicy]         = useState(null)
  const [claims,          setClaims]         = useState([])
  const [totalPaid,       setTotalPaid]      = useState(0)
  const [activeTriggers,  setActiveTriggers] = useState([])
  const [showModal,       setShowModal]      = useState(false)
  const [showUpgrade,     setShowUpgrade]    = useState(false)
  const [showBanner,      setShowBanner]     = useState(true)
  const [loading,         setLoading]        = useState(true)
  const [error,           setError]          = useState(null)
  const [claimsSearch,    setClaimsSearch]   = useState('')

  const workerId    = worker?.workerId || worker?.id
  const pincode     = worker?.pincode
  const platform    = worker?.platform?.toLowerCase() || 'blinkit'
  const dailyIncome = worker?.dailyIncome || 0
  const zoneRisk    = worker?.zoneRiskScore || 0
  const riskTrend   = buildRiskTrend(zoneRisk)

  const loadDashboard = useCallback(async () => {
    if (!workerId) { setLoading(false); return }
    setLoading(true)
    try {
      const [policyRes, claimsRes] = await Promise.all([
        getActivePolicy(workerId),
        getClaimsHistory(workerId),
      ])
      setPolicy(policyRes.data.policy || null)
      setClaims(claimsRes.data.claims || [])
      setTotalPaid(claimsRes.data.totalPaid || 0)

      // Load triggers only if pincode is available
      if (pincode) {
        try {
          const triggersRes = await checkTriggers(pincode, platform)
          // Use full trigger objects filtered to only fired ones for AlertBanner + ClaimModal
          const allTriggers = triggersRes.data.triggers || []
          setActiveTriggers(allTriggers.filter(t => t.triggered))
        } catch { /* triggers non-critical */ }
      }
    } catch (err) {
      setError('Could not load dashboard data.')
      toast.error('Failed to load dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [workerId, pincode, platform])

  useEffect(() => { loadDashboard(); requestGPS() }, [loadDashboard])

  function handleClaimFiled() {
    setShowModal(false)
    loadDashboard()
    toast.success('Claim submitted successfully!')
  }

  async function handleRefresh() {
    await loadDashboard()
    toast.success('Dashboard refreshed')
  }

  // Derived stats
  const totalPremium  = worker?.total_premium || 0
  const roi           = totalPremium > 0 ? (totalPaid / totalPremium).toFixed(1) : null
  const riskLabel     = zoneRisk > 70 ? 'High' : zoneRisk > 40 ? 'Moderate' : 'Low'
  const riskColor     = zoneRisk > 70 ? 'text-rose-600' : zoneRisk > 40 ? 'text-amber-600' : 'text-emerald-600'
  const riskBarColor  = zoneRisk > 70 ? 'bg-rose-500' : zoneRisk > 40 ? 'bg-amber-400' : 'bg-emerald-500'
  const weeklyAtRisk  = dailyIncome * 5

  const filteredClaims = claims.filter(c =>
    !claimsSearch || c.triggerType?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
    c.decision?.toLowerCase().includes(claimsSearch.toLowerCase())
  )

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar gpsActive={!!lat} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded" />
          <div className="grid sm:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar gpsActive={!!lat} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {getGreeting()}, {worker?.name?.split(' ')[0]}
              </h1>
              {policy && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={11} /> {policy.daysLeft}d coverage left
                </span>
              )}
              {activeTriggers.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-100 text-rose-600 ring-1 ring-rose-200 px-2 py-0.5 rounded-full animate-pulse-slow">
                  <Zap size={11} /> Alert active
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5 capitalize">
              {worker?.platform} · {worker?.city}{pincode ? ` · ${pincode}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh}
              className="btn-ghost text-xs px-3 py-1.5 h-auto gap-1.5">
              <RefreshCw size={13} /> Refresh
            </button>
            <button onClick={() => setShowModal(true)} disabled={!policy}
              className="btn-primary text-xs px-4 py-2 h-auto">
              <FileText size={13} /> File a Claim
            </button>
          </div>
        </div>

        {/* ── Alert banner ─────────────────────────────────────────── */}
        {showBanner && activeTriggers.length > 0 && (
          <AlertBanner
            triggers={activeTriggers}
            hasPolicy={!!policy}
            onFileClaim={policy ? () => setShowModal(true) : undefined}
            onDismiss={() => setShowBanner(false)}
          />
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
            <AlertTriangle size={14} className="flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── 3 main cards ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-5">

          {/* Policy card */}
          <PolicyCard
            policy={policy}
            onFileClaim={() => setShowModal(true)}
            onBuyPolicy={() => window.location.href = '/register'}
          />

          {/* Weather widget */}
          <WeatherWidget pincode={pincode} platform={platform} />

          {/* Earnings card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Earnings Protected</p>
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={15} className="text-emerald-600" />
              </div>
            </div>

            {/* Total received */}
            {totalPaid > 0 ? (
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                <p className="text-2xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Total Received</p>
                <p className="text-3xl font-bold text-emerald-700 num">Rs. {totalPaid.toFixed(0)}</p>
                <p className="text-xs text-emerald-500 mt-1">via approved claims</p>
              </div>
            ) : (
              /* Empty state when no payouts yet */
              <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-4 border border-slate-100 text-center gap-1.5">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <IndianRupee size={16} className="text-slate-300" />
                </div>
                <p className="text-xs font-semibold text-slate-500">No payouts yet</p>
                <p className="text-2xs text-slate-400">Your first payout will appear here</p>
              </div>
            )}

            {/* Mini stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Claims</p>
                <p className="text-2xl font-bold text-slate-900 num">{claims.length}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold mb-1">ROI</p>
                <p className="text-2xl font-bold text-slate-900 num">{roi ? `${roi}×` : '—'}</p>
              </div>
            </div>

            {/* Zone risk with sparkline */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs text-slate-500 font-semibold uppercase tracking-wide">Zone Risk · 7 Days</span>
                <span className={`text-xs font-bold num ${riskColor}`}>{riskLabel} · {zoneRisk}/100</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${riskBarColor}`} style={{ width: `${zoneRisk}%` }} />
              </div>
              <ResponsiveContainer width="100%" height={36}>
                <LineChart data={riskTrend}>
                  <Line type="monotone" dataKey="risk" stroke={zoneRisk > 70 ? '#f43f5e' : zoneRisk > 40 ? '#f59e0b' : '#059669'}
                    strokeWidth={1.5} dot={false} />
                  <Tooltip
                    contentStyle={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff' }}
                    formatter={v => [`${v.toFixed(0)}`, 'Risk']}
                    labelFormatter={l => l}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly at risk */}
            {dailyIncome > 0 && (
              <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                <span className="text-xs text-amber-700 font-medium">Weekly earnings at risk</span>
                <span className="text-sm font-bold text-amber-700 num">Rs. {weeklyAtRisk.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Next premium / renewal row ──────────────────────────── */}
        {policy && (
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CalendarDays size={16} className="text-navy" />
              </div>
              <div>
                <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold">Next Premium Due</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {new Date(policy.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                </p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-violet-600" />
              </div>
              <div>
                <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold">Payout Speed</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">Under 90 seconds</p>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xs text-slate-400 uppercase tracking-wide font-semibold">Coverage Status</p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5 capitalize">{policy.status} — {policy.plan} plan</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Recommendation row ──────────────────────────────────── */}
        {policy && zoneRisk > 60 && policy.plan === 'basic' && (
          <div className="flex items-start gap-4 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
            <div className="w-9 h-9 bg-navy rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-navy">Upgrade recommended for your zone</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Your zone risk score of <span className="font-bold">{zoneRisk}/100</span> puts you at elevated risk.
                Standard Shield adds Rs.400 more coverage and covers up to 18 hrs/week — for only Rs.40–50/week.
              </p>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex-shrink-0 text-xs font-bold text-navy border border-navy/30 bg-white hover:bg-navy hover:text-white px-3 py-1.5 rounded-lg transition-all">
              Upgrade
            </button>
          </div>
        )}

        {/* ── Claims history ───────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BarChart2 size={15} className="text-navy" />
              Claims History
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{claims.length} total</span>
              {claims.length > 0 && (
                <input type="text" placeholder="Filter…"
                  value={claimsSearch} onChange={e => setClaimsSearch(e.target.value)}
                  className="h-7 px-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-navy w-28" />
              )}
            </div>
          </div>

          {filteredClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
                <FileText size={20} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {claims.length === 0 ? 'No claims filed yet' : 'No results matching your filter'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {claims.length === 0 ? 'When a disruption occurs, file a claim to receive your payout.' : 'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Trigger</th>
                    <th>Fraud Score</th>
                    <th>Decision</th>
                    <th className="text-right">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map(c => (
                    <tr key={c.claimId}>
                      <td className="whitespace-nowrap text-slate-500 text-xs num">
                        {c.initiatedAt ? new Date(c.initiatedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="capitalize font-medium text-slate-700">{c.triggerType?.replace(/_/g, ' ')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              c.fraudScore > 0.65 ? 'bg-rose-500' : c.fraudScore > 0.35 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`} style={{ width: `${(c.fraudScore ?? 0) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-400 num">{((c.fraudScore ?? 0) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${decisionBadge[c.decision] || 'badge-gray'} text-2xs`}>
                          {c.decision?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={`text-right font-bold num ${c.payoutAmount > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {c.payoutAmount > 0 ? `Rs. ${c.payoutAmount}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showModal && policy && (
        <ClaimModal
          worker={worker}
          policy={policy}
          activeTriggers={activeTriggers}
          onClose={handleClaimFiled}
        />
      )}

      {showUpgrade && policy && (
        <UpgradeModal
          worker={worker}
          currentPolicy={policy}
          onClose={() => setShowUpgrade(false)}
          onUpgraded={() => { setShowUpgrade(false); loadDashboard() }}
        />
      )}
    </div>
  )
}
