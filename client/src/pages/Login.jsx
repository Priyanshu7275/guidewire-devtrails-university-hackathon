import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Phone, Lock, Eye, EyeOff, ArrowRight, CheckCircle, Zap, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { loginWorker } from '../services/api.js'
import toast from 'react-hot-toast'

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()
  const [phone,     setPhone]    = useState('')
  const [password,  setPassword] = useState('')
  const [showPw,    setShowPw]   = useState(false)
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (phone.trim().length < 10) { setError('Enter a valid 10-digit phone number.'); return }
    if (password.length < 4)      { setError('Password must be at least 4 characters.'); return }
    setLoading(true)
    try {
      const res = await loginWorker({ phone: phone.trim(), password })
      login(res.data, res.data.token)
      toast.success(`Welcome back, ${res.data.name?.split(' ')[0] || 'Partner'}!`)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your phone and password.')
    } finally {
      setLoading(false)
    }
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
        <Link to="/" className="relative flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-white rounded-lg">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-blue-200" />
          </div>
          <span className="text-white font-bold text-lg">GigInsure</span>
        </Link>

        {/* Main copy */}
        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Protect your income.<br />Every single day.
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-7">
            Rain, heat, AQI, curfew — when disruptions stop you from earning,
            we automatically put money in your UPI in under 90 seconds.
          </p>
          <div className="flex flex-col gap-2.5 mb-8">
            {[
              'AI-calculated zone risk premiums',
              'Automatic claim detection',
              'Payout in 90 seconds via UPI',
            ].map(t => (
              <div key={t} className="flex items-center gap-2.5 text-white/70">
                <CheckCircle size={14} className="text-blue-300 flex-shrink-0" />
                <span className="text-xs font-medium">{t}</span>
              </div>
            ))}
          </div>

          {/* Testimonial quote */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex mb-2 gap-0.5">
              {[1,2,3,4,5].map(i => (
                <span key={i} className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" />
              ))}
            </div>
            <p className="text-white/80 text-xs leading-relaxed italic mb-3">
              "Rs.780 in my PhonePe within 2 minutes of the AQI alert. I didn't even have to tap anything."
            </p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white font-bold text-xs">MD</div>
              <div>
                <p className="text-white text-xs font-semibold">Meena Devi</p>
                <p className="text-white/40 text-2xs">Zomato Partner · Bengaluru</p>
              </div>
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
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1.5">Welcome back</h1>
          <p className="text-slate-400 text-sm mb-7">Sign in to your income protection dashboard.</p>

          {error && (
            <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  className="input pl-10"
                  placeholder="9876543210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
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
                  placeholder="Your password"
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
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing In…</>
                : <>Sign In <ArrowRight size={15} /></>}
            </button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-6">
            New to GigInsure?{' '}
            <Link to="/register" className="text-navy font-semibold hover:text-navy-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy rounded">
              Create an account
            </Link>
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mt-8 pt-6 border-t border-slate-100">
            {[
              [Lock,    'Secure Login'],
              [Zap,     'Instant Access'],
              [Database,'Data Protected'],
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
