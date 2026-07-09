import { useState, useEffect, useCallback } from 'react'
import { getProjects, deleteProject, deleteAllProjects } from '../api'

export function useProjects() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProjects()
      if (res.success) setList(res.data || [])
      else setError(res.error?.message || 'Failed to fetch projects')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const remove = useCallback(async (name) => {
    const res = await deleteProject(name)
    if (res.success) setList(prev => prev.filter(p => p.project_name !== name))
    return res
  }, [])

  const removeAll = useCallback(async () => {
    const res = await deleteAllProjects()
    if (res.success) setList([])
    return res
  }, [])

  return { projects: list, loading, error, refresh: fetch, remove, removeAll }
}
