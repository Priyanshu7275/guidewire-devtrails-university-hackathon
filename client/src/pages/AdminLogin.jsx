import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, User, Lock, Eye, EyeOff, ArrowRight, CheckCircle, BarChart2, Zap, Users } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Hardcoded admin credential ────────────────────────────────────────────────
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin2026'
const ADMIN_SESSION_KEY = 'giginsure_admin'

export function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true'
}

export function adminLogout() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

export default function AdminLogin() {
  const navigate  = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // If already logged in as admin, go straight to dashboard
  useEffect(() => {
    if (isAdminLoggedIn()) navigate('/admin', { replace: true })
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Simulate a brief network delay for realism
    setTimeout(() => {
      if (username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        localStorage.setItem(ADMIN_SESSION_KEY, 'true')
        toast.success('Welcome, Admin')
        navigate('/admin', { replace: true })
      } else {
        setError('Invalid admin credentials.')
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg,#082B6B 0%,#0B3B8C 55%,#1A5CB4 100%)' }}>

        {/* Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-16 right-8   w-60 h-60 rounded-full blur-3xl" style={{ background: 'rgba(26,92,180,.22)' }} />
          <div className="absolute bottom-16 left-8 w-72 h-72 rounded-full blur-3xl" style={{ background: 'rgba(11,59,140,.18)' }} />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-blue-200" />
          </div>
          <div>
            <span className="text-white font-bold text-lg">GigInsure</span>
            <span className="ml-2 text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">Admin</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Operations Console
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-7">
            Monitor all active zones, review claims, run disruption simulations,
            and track real-time fraud signals across India.
          </p>
          <div className="flex flex-col gap-3 mb-8">
            {[
              [BarChart2, 'Live KPI dashboard — workers, policies, payouts'],
              [Users,     'Claims ledger with ML fraud score breakdown'],
              [Zap,       'Disruption simulator for demo scenarios'],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-center gap-2.5 text-white/70">
                <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon size={12} className="text-blue-200" />
                </div>
                <span className="text-xs font-medium">{text}</span>
              </div>
            ))}
          </div>

          {/* Credential hint card */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-white/50 text-2xs font-semibold uppercase tracking-widest mb-2">Demo Credentials</p>
            <div className="flex flex-col gap-1">
              <p className="text-white text-sm font-mono">
                <span className="text-white/50">Username: </span>admin
              </p>
              <p className="text-white text-sm font-mono">
                <span className="text-white/50">Password: </span>admin2026
              </p>
            </div>
          </div>
        </div>

        <p className="relative text-white/30 text-xs">DEVTrails 2026 — Guidewire Challenge</p>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────── */}
      <div className="w-full lg:w-[55%] flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-navy">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-navy">GigInsure</span>
            <span className="text-xs font-semibold bg-navy/10 text-navy px-2 py-0.5 rounded-full">Admin</span>
          </div>

          <div className="mb-7">
            <div className="inline-flex items-center gap-2 bg-navy/8 border border-navy/15 px-3 py-1.5 rounded-full mb-4">
              <Shield size={12} className="text-navy" />
              <span className="text-xs font-semibold text-navy">Admin Access Only</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Operations Sign In</h1>
            <p className="text-slate-400 text-sm">Enter your admin credentials to access the operations console.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input pl-10 pr-12"
                  placeholder="Admin password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm mt-2 flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing In…</>
                : <>Access Console <ArrowRight size={15} /></>}
            </button>
          </form>

          {/* Trust row */}
          <div className="flex items-center justify-center gap-5 mt-8 pt-6 border-t border-slate-100">
            {[
              [CheckCircle, 'Secure Access'],
              [Shield,      'Role Protected'],
              [Lock,        'Session Only'],
            ].map(([Icon, lbl]) => (
              <div key={lbl} className="text-center">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-1">
                  <Icon size={13} className="text-navy" />
                </div>
                <p className="text-2xs text-slate-400 font-medium">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
