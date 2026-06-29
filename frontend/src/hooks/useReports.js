import { useState, useEffect, useCallback } from 'react'
import { getReports, deleteReport } from '../api'

export function useReports() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getReports()
      if (res.success) setList(res.data || [])
      else setError(res.error?.message || 'Failed to fetch reports')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const remove = useCallback(async (name) => {
    const res = await deleteReport(name)
    if (res.success) setList(prev => prev.filter(r => r.project_name !== name))
    return res
  }, [])

  return { reports: list, loading, error, refresh: fetch, remove }
}
