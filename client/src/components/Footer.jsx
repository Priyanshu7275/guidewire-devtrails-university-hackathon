import React from 'react'
import { Link } from 'react-router-dom'
import { Shield, Lock } from 'lucide-react'

export default function Footer() {
  return (
    <footer style={{ background: '#051B44' }} className="text-white/40 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={18} className="text-blue-400" />
              <span className="text-white font-bold text-lg">GigInsure</span>
            </div>
            <p className="text-xs max-w-xs leading-relaxed">
              AI-powered parametric income insurance for India's gig economy workers.
              Protecting your livelihood, one delivery at a time.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-14 gap-y-2 text-xs">
            <Link to="/register" className="hover:text-white transition-colors">Get Protected</Link>
            <Link to="/login"    className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/admin"    className="hover:text-white transition-colors">Admin Demo</Link>
            <a href="/#faq"      className="hover:text-white transition-colors">FAQ</a>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-2xs">
          <span>© 2026 GigInsure · DEVTrails 2026 · Guidewire Challenge</span>
          <span className="flex items-center gap-1.5">
            <Lock size={10} /> SSL Secured · HTTPS
          </span>
        </div>
      </div>
    </footer>
  )
}
