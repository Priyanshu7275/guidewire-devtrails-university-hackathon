import React, { useState, useEffect } from 'react'
import { CloudRain, Thermometer, Wind, Newspaper, RefreshCw, ExternalLink } from 'lucide-react'
import { checkTriggers } from '../services/api.js'

function riskLevel(value, low, high) {
  if (value >= high) return { color: 'text-rose-600', bg: 'bg-rose-500', label: 'Danger' }
  if (value >= low)  return { color: 'text-amber-600', bg: 'bg-amber-400', label: 'Caution' }
  return { color: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Safe' }
}

function MetricRow({ icon, label, value, rawValue, low, high, unit }) {
  const risk = riskLevel(rawValue, low, high)
  const pct  = Math.min(rawValue / high * 80, 100)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 text-slate-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 font-medium">{label}</span>
          <span className={`text-xs font-bold num ${risk.color}`}>{value}</span>
        </div>
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${risk.bg}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

export default function WeatherWidget({ pincode, platform = 'blinkit' }) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function fetchWeather() {
    if (!pincode) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await checkTriggers(pincode, platform)
      setData(res.data)
      setLastUpdated(new Date())
      setError(null)
    } catch {
      setError('Weather data unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
    const id = setInterval(fetchWeather, 300_000)
    return () => clearInterval(id)
  }, [pincode, platform])

  if (!pincode) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card flex items-center justify-center h-44">
        <p className="text-xs text-slate-400">Pincode not set</p>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="skeleton h-4 w-32 rounded" />
        </div>
        <div className="p-4 space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-card flex flex-col items-center justify-center h-44 gap-2 text-slate-400">
        <CloudRain size={28} className="opacity-40" />
        <p className="text-xs">{error}</p>
        <button onClick={fetchWeather} className="btn-ghost text-xs py-1 px-3 h-auto">Retry</button>
      </div>
    )
  }

  const weather   = data?.weather   || {}
  const aqi       = data?.aqi       || {}
  const news      = data?.news      || []
  const firedSet  = new Set(data?.fired || [])
  // Use the full trigger objects (with label/value) filtered to just fired ones
  const firedTriggers = (data?.triggers || []).filter(t => t.triggered)
  const isLive    = data?.dataSource === 'openweathermap_live'

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <CloudRain size={14} className="text-navy" />
            Zone Conditions
          </p>
          <p className="text-2xs text-slate-400 mt-0.5">Pincode {pincode}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isLive ? 'Live' : 'Demo'}
          </span>
          <button onClick={fetchWeather} disabled={loading}
            className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-md text-slate-400 hover:text-navy hover:bg-blue-50 transition-colors">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active trigger chips */}
      {firedTriggers.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {firedTriggers.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-2xs font-semibold bg-rose-100 text-rose-700 ring-1 ring-rose-200 px-2 py-0.5 rounded-full animate-fade-in">
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
              {t.label || t.type?.replace(/_/g,' ')} {t.value != null ? `· ${t.value}${t.unit||''}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Metrics */}
      <div className="px-4 py-1">
        <MetricRow icon={<CloudRain size={12} />} label="Rainfall" value={`${weather.rainMm ?? 0} mm/hr`}
          rawValue={weather.rainMm ?? 0} low={5} high={20} />
        <MetricRow icon={<Thermometer size={12} />} label="Temperature" value={`${weather.tempC ?? '--'}°C`}
          rawValue={weather.tempC ?? 0} low={38} high={44} />
        <MetricRow icon={<Wind size={12} />} label="AQI" value={String(aqi.aqi ?? '--')}
          rawValue={aqi.aqi ?? 0} low={100} high={250} />
      </div>

      {/* News */}
      {news.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
            <Newspaper size={10} /> Zone News
          </p>
          <ul className="space-y-1.5">
            {news.slice(0, 2).map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 flex-shrink-0" />
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-navy transition-colors line-clamp-2 leading-tight flex-1">
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastUpdated && (
        <div className="px-4 pb-3">
          <p className="text-2xs text-slate-300">Updated {lastUpdated.toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  )
}
