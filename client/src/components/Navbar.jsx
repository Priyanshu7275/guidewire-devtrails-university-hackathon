import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Shield, LogOut, LayoutDashboard, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import toast from 'react-hot-toast'

export default function Navbar({ gpsActive = false }) {
  const { worker, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [open,     setOpen]     = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function handleLogout() {
    logout()
    toast.success('Signed out successfully')
    navigate('/')
  }

  const isTransparent = location.pathname === '/' && !scrolled

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      isTransparent
        ? 'bg-transparent'
        : 'bg-navy-dark/95 backdrop-blur-md border-b border-white/10 shadow-lg'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg">
            <div className="w-8 h-8 bg-white/10 group-hover:bg-white/20 transition-colors rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-blue-200" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">GigInsure</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1.5">
            {worker ? (
              <>
                {/* GPS status pill */}
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                  gpsActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                    : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${gpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {gpsActive ? 'GPS' : 'No GPS'}
                </span>

                {/* Worker chip */}
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2.5 py-1.5 ml-1">
                  <div className="w-6 h-6 rounded-full bg-navy-light flex items-center justify-center text-2xs font-bold text-white">
                    {worker.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{worker.name?.split(' ')[0]}</span>
                </div>

                <Link to="/dashboard"
                  className="text-white/75 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                  Dashboard
                </Link>

                <Link to="/admin-login"
                  className="text-white/50 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
                  Admin Demo
                </Link>

                <button onClick={handleLogout}
                  className="flex items-center gap-1.5 text-white/60 hover:text-rose-300 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50">
                  <LogOut size={14} />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/admin-login"
                  className="text-white/60 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
                  Admin Demo
                </Link>
                <Link to="/login"
                  className="text-white/80 hover:text-white text-sm font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
                  Sign In
                </Link>
                <Link to="/register"
                  className="bg-white text-navy hover:bg-blue-50 text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-md">
                  Get Protected
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="sm:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="sm:hidden border-t border-white/10 py-3 space-y-1 animate-fade-in">
            {worker ? (
              <>
                <div className="flex items-center gap-2.5 px-4 py-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-navy-light flex items-center justify-center text-sm font-bold text-white">
                    {worker.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{worker.name}</p>
                    <p className="text-white/50 text-xs capitalize">{worker.platform}</p>
                  </div>
                </div>
                <Link to="/dashboard" onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-white/80 px-4 py-2.5 hover:bg-white/10 rounded-lg mx-2 text-sm font-medium transition-colors">
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
                <Link to="/admin-login" onClick={() => setOpen(false)}
                  className="flex items-center gap-2 text-white/50 px-4 py-2.5 hover:bg-white/10 rounded-lg mx-2 text-sm font-medium transition-colors">
                  Admin Demo
                </Link>
                <button onClick={() => { handleLogout(); setOpen(false) }}
                  className="flex items-center gap-2 text-rose-300 px-4 py-2.5 hover:bg-rose-500/10 rounded-lg mx-2 w-full text-sm font-medium transition-colors">
                  <LogOut size={15} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}
                  className="block text-white/80 px-4 py-2.5 hover:bg-white/10 rounded-lg mx-2 text-sm font-medium">
                  Sign In
                </Link>
                <Link to="/register" onClick={() => setOpen(false)}
                  className="block text-navy font-bold px-4 py-2.5 bg-white rounded-lg mx-2 text-sm">
                  Get Protected
                </Link>
                <Link to="/admin-login" onClick={() => setOpen(false)}
                  className="block text-white/50 px-4 py-2.5 hover:bg-white/10 rounded-lg mx-2 text-sm">
                  Admin Demo
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
