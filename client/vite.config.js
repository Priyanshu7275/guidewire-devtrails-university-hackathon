/*
 * vite.config.js
 *
 * Vite build tool configuration for the GigInsure React app.
 *
 * Key settings:
 *   - Uses the official React Vite plugin so JSX works and Fast Refresh is enabled.
 *   - The server proxy rewrites any request starting with "/api" to our backend
 *     running on localhost:5000. This avoids CORS issues during development because
 *     the browser sees everything on the same origin (localhost:5173).
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Any fetch/axios call to /api/... is forwarded to the Express backend.
      '/api': 'http://localhost:5000'
    }
  }
})
