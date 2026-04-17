import React, { useState, useEffect, useRef } from 'react'
import {
  MapPin, Users, Shield, RefreshCw, X, CheckCircle2, AlertTriangle, Zap,
} from 'lucide-react'
import {
  getEligibilityMapData, getEligibilityZoneDetail, batchApproveZone,
} from '../../services/api.js'
import toast from 'react-hot-toast'

// ── SVG projection ────────────────────────────────────────────────────────────
const MAP_W   = 700
const MAP_H   = 750
const LAT_MAX = 35.5
const LAT_MIN = 7.4
const LON_MIN = 68.0
const LON_MAX = 97.5

function project(lat, lng) {
  const x = ((lng - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W
  const y = MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H
  return { x: Math.round(x), y: Math.round(y) }
}

// Dot radius: base from status + scales with policy count
function dotRadius(status, policyCount) {
  const base = status === 'ACTIVE' ? 8 : status === 'ELEVATED' ? 6 : 5
  const extra = Math.min(Math.floor((policyCount || 0) / 2), 8)
  return Math.min(base + extra, 16)
}

const STATUS_COLOR = { ACTIVE: '#EF4444', ELEVATED: '#F59E0B', NORMAL: '#059669' }

// ── Fraud score color ─────────────────────────────────────────────────────────
function fraudColor(score) {
  if (score == null) return 'text-slate-400'
  if (score > 0.7) return 'text-red-600'
  if (score > 0.3) return 'text-amber-600'
  return 'text-emerald-600'
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EligibilityMap() {
  const [zones,         setZones]         = useState([])
  const [summary,       setSummary]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [selectedPin,   setSelectedPin]   = useState(null)
  const [zoneDetail,    setZoneDetail]    = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [batchLoading,  setBatchLoading]  = useState(false)
  const [tooltip,       setTooltip]       = useState(null) // { zone, x, y }
  const mapContainerRef = useRef(null)

  // ── Data loading ────────────────────────────────────────────────────────────
  async function loadZones(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await getEligibilityMapData()
      setZones(res.data.zones    || [])
      setSummary(res.data.summary || null)
    } catch {
      // silently fall back — map still renders if backend is down
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadZones()
    const id = setInterval(() => loadZones(true), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Zone selection + detail fetch ───────────────────────────────────────────
  async function selectZone(zone) {
    if (selectedPin === zone.pincode) {
      setSelectedPin(null)
      setZoneDetail(null)
      return
    }
    setSelectedPin(zone.pincode)
    setZoneDetail(null)
    setDetailLoading(true)
    try {
      const res = await getEligibilityZoneDetail(zone.pincode)
      setZoneDetail(res.data)
    } catch {
      toast.error('Failed to load zone details')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Batch approve ───────────────────────────────────────────────────────────
  async function handleBatchApprove() {
    if (!selectedPin) return
    setBatchLoading(true)
    try {
      const res = await batchApproveZone(selectedPin)
      toast.success(res.data.message)
      const detailRes = await getEligibilityZoneDetail(selectedPin)
      setZoneDetail(detailRes.data)
      loadZones(true)
    } catch {
      toast.error('Batch approve failed')
    } finally {
      setBatchLoading(false)
    }
  }

  // ── Tooltip positioning ─────────────────────────────────────────────────────
  function handleDotMouseMove(e, zone) {
    const rect = mapContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ zone, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeZonesList = zones
    .filter(z => z.status === 'ACTIVE')
    .sort((a, b) => b.pendingPayout - a.pendingPayout)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <MapPin size={15} className="text-navy" />
            Eligibility Coverage Map
          </h3>
          <p className="text-2xs text-slate-400 mt-0.5">
            {summary
              ? `${summary.activeZones} zones active · ${summary.totalEligibleWorkers} workers eligible · Rs.${(summary.totalPendingPayout || 0).toLocaleString('en-IN')} pending`
              : `${zones.length} covered zones`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-2xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse inline-block" />Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Elevated
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Normal
            </span>
          </div>
          <button onClick={() => loadZones()} disabled={loading}
            className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:text-navy hover:bg-blue-50 transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body: Map (65%) + Right Panel (35%) — stacks vertically on mobile */}
      <div className="flex flex-col md:flex-row" style={{ minHeight: 420 }}>

        {/* ── SVG Map ───────────────────────────────────────────────────────── */}
        <div
          ref={mapContainerRef}
          className="relative bg-[#EEF3FF] overflow-hidden md:flex-[0_0_65%]"
          onMouseLeave={() => setTooltip(null)}
        >
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            style={{ width: '100%', height: 420, display: 'block' }}
          >
            {/* ── India outline ────────────────────────────────────────── */}
            <path
              d="M 178 62 L 215 52 L 275 46 L 348 56 L 418 72 L 478 92 L 528 122 L 558 158
                 L 574 198 L 579 242 L 563 282 L 552 322 L 538 362 L 508 402 L 478 442
                 L 448 482 L 412 516 L 386 546 L 364 568 L 344 582 L 324 594 L 306 604
                 L 290 614 L 276 622 L 264 628 L 256 634 L 250 640 L 248 648 L 250 658
                 L 254 670 L 256 684 L 254 698 L 250 712 L 246 724 L 240 732
                 L 232 724 L 222 710 L 210 692 L 198 670 L 190 648 L 184 626
                 L 174 600 L 158 570 L 140 538 L 124 504 L 112 468 L 104 430
                 L 100 390 L 100 348 L 104 306 L 110 266 L 118 228 L 130 192
                 L 146 158 L 164 126 L 178 62 Z"
              fill="#DDE6FF"
              stroke="#C5D3F5"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* ── City dots ─────────────────────────────────────────────── */}
            {zones.map(zone => {
              const { x, y } = project(zone.lat, zone.lng)
              const r        = dotRadius(zone.status, zone.activePolicyCount)
              const fill     = STATUS_COLOR[zone.status] || '#059669'
              const isSel    = selectedPin === zone.pincode
              const isActive = zone.status === 'ACTIVE'

              return (
                <g
                  key={zone.pincode}
                  style={{ cursor: 'pointer' }}
                  onClick={() => selectZone(zone)}
                  onMouseMove={e => handleDotMouseMove(e, zone)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Pulse ring for ACTIVE zones */}
                  {isActive && (
                    <circle cx={x} cy={y} r={r + 4} fill="#EF4444" opacity={0.25}>
                      <animate attributeName="r"
                        values={`${r + 2};${r + 12};${r + 2}`}
                        dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity"
                        values="0.35;0;0.35"
                        dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Main dot */}
                  <circle
                    cx={x} cy={y} r={isSel ? r + 3 : r}
                    fill={fill}
                    stroke="white"
                    strokeWidth={isSel ? 3 : 1.5}
                    opacity={0.92}
                  />

                  {/* City label — only for ACTIVE zones */}
                  {isActive && (
                    <text
                      x={x} y={y - r - 5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#B91C1C"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      {zone.city}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* ── HTML Tooltip ──────────────────────────────────────────────── */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 bg-slate-900 text-white rounded-xl px-3 py-2.5 shadow-2xl border border-white/10"
              style={{
                left: tooltip.x + 14,
                top:  tooltip.y - 14,
                maxWidth: 220,
                transform: tooltip.x > (mapContainerRef.current?.offsetWidth ?? 400) * 0.65
                  ? 'translateX(-110%)'
                  : 'none',
              }}
            >
              <p className="text-xs font-bold text-white leading-tight">
                {tooltip.zone.city}
                <span className="font-normal text-slate-400 ml-1">· {tooltip.zone.pincode}</span>
              </p>
              <p className={`text-2xs font-semibold mt-0.5 ${
                tooltip.zone.status === 'ACTIVE'   ? 'text-red-400'     :
                tooltip.zone.status === 'ELEVATED' ? 'text-amber-400'   : 'text-emerald-400'
              }`}>
                {tooltip.zone.status === 'ACTIVE'   ? '● ACTIVE'   :
                 tooltip.zone.status === 'ELEVATED' ? '● ELEVATED' : '● NORMAL'}
              </p>
              <div className="mt-1.5 space-y-0.5 text-2xs text-slate-300">
                <p>{tooltip.zone.activePolicyCount} workers eligible</p>
                {tooltip.zone.pendingPayout > 0 && (
                  <p>Rs.{tooltip.zone.pendingPayout.toLocaleString('en-IN')} pending</p>
                )}
                {tooltip.zone.activeTriggers?.length > 0 && (
                  <p className="capitalize">
                    {tooltip.zone.activeTriggers.map(t => t.type?.replace(/_/g, ' ')).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <div className="spinner" />
            </div>
          )}
        </div>

        {/* ── Right Panel (35%) ─────────────────────────────────────────────── */}
        <div
          className="flex-1 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col overflow-hidden"
          style={{ minWidth: 0 }}
        >

          {selectedPin ? (
            /* ── Zone Detail Panel ─────────────────────────────────────── */
            <div className="flex flex-col h-full animate-fade-in">

              {/* Panel header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {zoneDetail?.city || zones.find(z => z.pincode === selectedPin)?.city || selectedPin}
                  </p>
                  <p className="text-2xs text-slate-400">{selectedPin} · {zoneDetail?.state}</p>
                </div>
                <button
                  onClick={() => { setSelectedPin(null); setZoneDetail(null) }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="spinner" />
                </div>
              ) : zoneDetail ? (
                <div className="flex-1 overflow-y-auto">

                  {/* Active triggers */}
                  {zoneDetail.activeTriggers?.length > 0 && (
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                        Active Triggers
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {zoneDetail.activeTriggers.map((t, i) => (
                          <span key={i}
                            className="text-2xs font-semibold bg-red-100 text-red-700 ring-1 ring-red-200 px-2 py-0.5 rounded-full capitalize">
                            {t.type?.replace(/_/g, ' ')} · {t.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-slate-100">
                    {[
                      ['Eligible',   zoneDetail.stats?.eligible   ?? 0, 'text-navy'],
                      ['Claims',     zoneDetail.stats?.claimsFiled ?? 0, 'text-violet-600'],
                      ['Auto-paid',  zoneDetail.stats?.autoPaid   ?? 0, 'text-emerald-600'],
                      ['Pending',    zoneDetail.stats?.pending    ?? 0, 'text-amber-600'],
                    ].map(([label, val, color]) => (
                      <div key={label}
                        className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-center">
                        <p className={`text-sm font-bold num ${color}`}>{val}</p>
                        <p className="text-2xs text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Worker list */}
                  <div className="px-4 py-3">
                    <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                      Workers
                    </p>
                    {zoneDetail.workers?.length > 0 ? (
                      <div className="space-y-1.5">
                        {zoneDetail.workers.map(w => (
                          <div key={w.workerId}
                            className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {w.name}
                              </p>
                              {w.fraudScore != null && (
                                <span className={`text-2xs font-bold num flex-shrink-0 ml-2 ${fraudColor(w.fraudScore)}`}>
                                  {(w.fraudScore * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-2xs text-slate-400 mt-0.5">
                              <span className="capitalize">{w.platform}</span>
                              {w.plan && <span>· {w.plan}</span>}
                              {w.claimStatus && (
                                <span className={`font-semibold capitalize ${
                                  w.claimStatus === 'paid'         ? 'text-emerald-600' :
                                  w.claimStatus === 'pending'      ? 'text-amber-600' :
                                  w.claimStatus === 'under_review' ? 'text-blue-600' :
                                  w.claimStatus === 'rejected'     ? 'text-red-600' : 'text-slate-400'
                                }`}>
                                  · {w.claimStatus.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No workers in this zone</p>
                    )}
                  </div>

                  {/* Batch approve button — only for zones with active triggers */}
                  {(zoneDetail.stats?.pending ?? 0) > 0 && (zoneDetail.activeTriggers?.length ?? 0) > 0 && (
                    <div className="px-4 pb-4">
                      <button
                        onClick={handleBatchApprove}
                        disabled={batchLoading}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-sm"
                      >
                        {batchLoading ? (
                          <>
                            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} />
                            Approve All Pending ({zoneDetail.stats.pending})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

          ) : (
            /* ── Live Feed ─────────────────────────────────────────────── */
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <p className="text-xs font-bold text-slate-900">Eligible Right Now</p>
                <p className="text-2xs text-slate-400 mt-0.5">
                  {summary
                    ? `${summary.activeZones} zones active · ${summary.totalEligibleWorkers} eligible`
                    : 'Live zone feed · auto-refreshes 30s'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeZonesList.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {activeZonesList.map(zone => (
                      <button
                        key={zone.pincode}
                        onClick={() => selectZone(zone)}
                        className="w-full text-left px-4 py-3 hover:bg-red-50/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              {zone.city}
                            </p>
                            <p className="text-2xs text-slate-400 mt-0.5">{zone.pincode}</p>
                            {zone.activeTriggers?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {zone.activeTriggers.slice(0, 2).map((t, i) => (
                                  <span key={i}
                                    className="text-2xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium capitalize">
                                    {t.type?.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold text-slate-700 num">
                              {zone.activePolicyCount}
                            </p>
                            <p className="text-2xs text-slate-400">workers</p>
                            {zone.pendingPayout > 0 && (
                              <p className="text-2xs text-emerald-600 font-semibold num mt-0.5">
                                Rs.{zone.pendingPayout.toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <Shield size={18} className="text-emerald-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">All zones clear</p>
                    <p className="text-2xs text-slate-400 mt-1">
                      No active disruptions right now.
                      <br />Auto-refreshes every 30 seconds.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
