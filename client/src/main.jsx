/*
 * main.jsx — Application Entry Point
 *
 * This is the first JavaScript file Vite executes when the app starts.
 *
 * What happens here:
 *   1. We import React and ReactDOM (React 18 API).
 *   2. We import our global CSS so Tailwind styles are available everywhere.
 *   3. We wrap the entire app in <AuthProvider> so every component can access
 *      the logged-in worker's data via React Context.
 *   4. We wrap in <BrowserRouter> so React Router can read the URL and render
 *      the correct page.
 *   5. ReactDOM.createRoot().render() mounts React onto the <div id="root">
 *      element in index.html.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'

// Global styles (Tailwind + custom CSS variables)
import './index.css'

// Root component that contains all routes
import App from './App.jsx'

// Auth context provider — wraps the whole app so any component can call useAuth()
import { AuthProvider } from './context/AuthContext.jsx'

// BrowserRouter enables React Router to use the browser's History API
import { BrowserRouter } from 'react-router-dom'

// Mount React onto the #root div in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode renders each component twice in development to catch bugs early.
  // It has no effect in production builds.
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
