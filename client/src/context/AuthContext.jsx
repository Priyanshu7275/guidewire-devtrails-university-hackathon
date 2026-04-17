/*
 * context/AuthContext.jsx — Authentication Context
 *
 * React Context lets us share state (the logged-in worker + JWT token) across
 * the entire component tree without manually passing props through every level.
 *
 * How it works:
 *   1. createContext() creates a "channel" called AuthContext.
 *   2. AuthProvider is a component that holds the state and broadcasts it.
 *   3. Any component can call useAuth() to read that state or call login/logout.
 *
 * Persistence:
 *   - On login, we save both the worker object and token in localStorage so the
 *     user stays logged in even after a page refresh.
 *   - On app load, we read localStorage to restore the session automatically.
 */

import React, { createContext, useContext, useState, useEffect } from 'react'

// Create the context object. The default value (null) is only used if a
// component tries to use the context outside of an AuthProvider.
const AuthContext = createContext(null)

/*
 * AuthProvider
 *
 * Wrap your entire app (or the part that needs auth) with this component.
 * It provides { worker, token, login, logout, isLoading } to all children.
 *
 * Props:
 *   children — any React nodes (typically the whole <App />)
 */
export function AuthProvider({ children }) {
  // worker: the authenticated worker object (or null if not logged in)
  const [worker, setWorker] = useState(null)

  // token: JWT string stored in localStorage (or null)
  const [token, setToken] = useState(null)

  // isLoading: true while we are reading localStorage on first render.
  // Prevents a flash of "logged-out" state before hydration completes.
  const [isLoading, setIsLoading] = useState(true)

  /*
   * On mount: restore session from localStorage.
   * localStorage.getItem returns null if the key doesn't exist.
   */
  useEffect(() => {
    try {
      const savedToken  = localStorage.getItem('giginsure_token')
      const savedWorker = localStorage.getItem('giginsure_worker')

      if (savedToken && savedWorker) {
        setToken(savedToken)
        setWorker(JSON.parse(savedWorker)) // parse the JSON string back to an object
      }
    } catch (err) {
      // If localStorage is corrupt, clear it and start fresh
      console.error('Failed to restore session:', err)
      localStorage.removeItem('giginsure_token')
      localStorage.removeItem('giginsure_worker')
    } finally {
      setIsLoading(false) // hydration done regardless of success/failure
    }
  }, [])

  /*
   * login(workerData, jwtToken)
   *
   * Called after a successful /auth/login or /auth/register API response.
   * Saves data in both state (for in-memory reactivity) and localStorage
   * (for persistence across page refreshes).
   */
  function login(workerData, jwtToken) {
    setWorker(workerData)
    setToken(jwtToken)
    localStorage.setItem('giginsure_token',  jwtToken)
    localStorage.setItem('giginsure_worker', JSON.stringify(workerData))
  }

  /*
   * logout()
   *
   * Clears state and removes data from localStorage.
   * The Navbar calls this when the user clicks "Sign Out".
   */
  function logout() {
    setWorker(null)
    setToken(null)
    localStorage.removeItem('giginsure_token')
    localStorage.removeItem('giginsure_worker')
  }

  /*
   * updateWorker(updatedData)
   *
   * Lets any component update the stored worker object (e.g., after a policy
   * is created and we need to show the new policy_id on the dashboard).
   */
  function updateWorker(updatedData) {
    const merged = { ...worker, ...updatedData }
    setWorker(merged)
    localStorage.setItem('giginsure_worker', JSON.stringify(merged))
  }

  // The value object is what useAuth() returns in any consuming component.
  const value = {
    worker,       // current worker (null = not logged in)
    token,        // JWT string
    isLoading,    // true while restoring from localStorage
    login,        // fn(workerData, token) — call after API login
    logout,       // fn() — call on sign-out
    updateWorker  // fn(partial) — update stored worker data
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/*
 * useAuth()
 *
 * Custom hook that returns the AuthContext value.
 * Usage: const { worker, login, logout } = useAuth()
 *
 * Throws an error if used outside of <AuthProvider> so the developer gets a
 * clear message instead of a cryptic "cannot read property of null" error.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return context
}

export default AuthContext
