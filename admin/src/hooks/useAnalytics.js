// frontend/src/hooks/useAnalytics.js
// Custom hook — fetches analytics from /api/analytics endpoint

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const useAnalytics = (backendUrl, aToken, range = '30') => {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetch = useCallback(async () => {
    if (!aToken) return
    setLoading(true)
    setError('')
    try {
      const { data: res } = await axios.get(
        `${backendUrl}/api/analytics?range=${range}`,
        { headers: { aToken } }
      )
      if (res.success) setData(res.data)
      else setError(res.message || 'Failed to load analytics')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [backendUrl, aToken, range])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export default useAnalytics