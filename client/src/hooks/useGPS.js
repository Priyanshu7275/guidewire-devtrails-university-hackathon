/*
 * hooks/useGPS.js — Custom React Hook for Browser Geolocation
 *
 * This hook wraps the browser's navigator.geolocation API in a React-friendly
 * way. It handles the async nature of GPS requests and keeps React state in sync.
 *
 * Why a custom hook?
 *   - Multiple components (ClaimModal, WorkerDashboard) need GPS coordinates.
 *   - A hook lets us share the logic without copying code.
 *   - The hook returns a consistent {lat, lng, accuracy, error, loading} shape.
 *
 * How to use:
 *   const { lat, lng, accuracy, error, loading, request } = useGPS()
 *
 *   - lat, lng:   decimal degrees (null until GPS responds)
 *   - accuracy:   metres radius of uncertainty
 *   - error:      string message if permission denied or not supported
 *   - loading:    true while waiting for GPS response
 *   - request():  call this function to trigger/re-trigger GPS lookup
 */

import { useState, useCallback } from 'react'

export function useGPS() {
  const [lat,      setLat]      = useState(null)
  const [lng,      setLng]      = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  /*
   * request()
   *
   * Calls the browser Geolocation API. This is wrapped in useCallback so its
   * reference stays stable across re-renders (safe to put in dependency arrays).
   */
  const request = useCallback(() => {
    // Check if the browser supports geolocation at all
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    setLoading(true)
    setError(null)

    // getCurrentPosition is asynchronous — it asks the user for permission
    // and then calls either the success or error callback.
    navigator.geolocation.getCurrentPosition(
      // Success callback — called when GPS returns a fix
      (position) => {
        setLat(position.coords.latitude)
        setLng(position.coords.longitude)
        setAccuracy(Math.round(position.coords.accuracy)) // round to whole metres
        setLoading(false)
      },

      // Error callback — called if permission denied or timeout
      (geoError) => {
        // GeolocationPositionError codes:
        //   1 = PERMISSION_DENIED
        //   2 = POSITION_UNAVAILABLE
        //   3 = TIMEOUT
        switch (geoError.code) {
          case 1:
            setError('Location permission denied. Please enable it in browser settings.')
            break
          case 2:
            setError('Location unavailable. Check GPS signal.')
            break
          case 3:
            setError('Location request timed out. Please try again.')
            break
          default:
            setError('An unknown location error occurred.')
        }
        setLoading(false)
      },

      // Options object
      {
        enableHighAccuracy: true, // request GPS rather than Wi-Fi triangulation
        timeout: 10000,           // give up after 10 seconds
        maximumAge: 60000         // accept a cached position up to 1 minute old
      }
    )
  }, []) // empty deps — this function never changes

  return { lat, lng, accuracy, error, loading, request }
}

export default useGPS
