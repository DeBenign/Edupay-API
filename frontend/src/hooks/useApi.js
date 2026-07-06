// src/hooks/useApi.js — generic data fetching hook
import { useState, useEffect, useCallback } from 'react'

export const useApi = (apiFn, deps = []) => {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetch = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await apiFn()
      setData(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}