import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import { useAuth } from './context/AuthContext.jsx'
import Landing         from './pages/Landing.jsx'
import Login           from './pages/Login.jsx'
import Register        from './pages/Register.jsx'
import WorkerDashboard from './pages/WorkerDashboard.jsx'
import AdminDashboard  from './pages/AdminDashboard.jsx'
import AdminLogin from './pages/AdminLogin.jsx'

const PAGE_TITLES = {
  '/':            'GigInsure — Parametric Income Insurance for Gig Workers',
  '/login':       'Sign In — GigInsure',
  '/register':    'Get Protected — GigInsure',
  '/dashboard':   'My Dashboard — GigInsure',
  '/admin':       'Operations Console — GigInsure',
  '/admin-login': 'Admin Sign In — GigInsure',
}

function TitleUpdater() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] || 'GigInsure'
  }, [pathname])
  return null
}

// ── Worker protected route ────────────────────────────────────────────────────
function ProtectedRoute({ element }) {
  const { worker, token, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="spinner spinner-lg" />
      </div>
    )
  }
  if (!token || !worker) return <Navigate to="/login" replace />
  return element
}


export default function App() {
  return (
    <>
      <TitleUpdater />
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0F172A',
            color: '#f1f5f9',
            fontSize: '0.875rem',
            fontWeight: '500',
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#ecfdf5' } },
          error:   { iconTheme: { primary: '#E11D48', secondary: '#fff1f2' } },
        }}
      />
      <Routes>
        <Route path="/"            element={<Landing />} />
        <Route path="/login"       element={<Login />} />
        <Route path="/register"    element={<Register />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin"       element={<AdminDashboard />} />
        <Route path="/dashboard"   element={<ProtectedRoute element={<WorkerDashboard />} />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
