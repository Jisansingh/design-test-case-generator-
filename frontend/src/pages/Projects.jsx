import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { PageSpinner } from '../components/common/Spinner'
import { EmptyState } from '../components/common/EmptyState'
import { Modal } from '../components/common/Modal'
import { formatDate, statusLabel, languageColor } from '../utils/formatters'

export default function Projects() {
  const navigate = useNavigate()
  const { projects, loading, error, refresh, remove } = useProjects()
  const [search, setSearch] = useState('')
  const [filterLang, setFilterLang] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (search && !p.project_name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterLang && p.language !== filterLang) return false
      return true
    })
  }, [projects, search, filterLang])

  const langs = useMemo(() => {
    return [...new Set(projects.map(p => p.language).filter(Boolean))]
  }, [projects])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Projects</h1>
          <p className="text-sm text-surface-500 mt-1">{projects.length} total projects</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/workspace')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Project
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-accent-500/50"
          />
        </div>
        <select value={filterLang} onChange={e => setFilterLang(e.target.value)}
          className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-accent-500/50"
        >
          <option value="">All Languages</option>
          {langs.map(l => <option key={l} value={l}>{l || 'auto'}</option>)}
        </select>
        <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
          title={search || filterLang ? 'No matching projects' : 'No projects yet'}
          description={search || filterLang ? 'Try adjusting your search or filters.' : 'Create your first project in the workspace.'}
          action={!search && !filterLang ? <Button variant="primary" onClick={() => navigate('/workspace')}>Go to Workspace</Button> : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.project_name} hover onClick={() => navigate(`/projects/${encodeURIComponent(p.project_name)}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-surface-200 truncate">{p.project_name}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">{formatDate(p.created_at)}</p>
                </div>
                <Badge variant={p.status === 'report_generated' ? 'success' : 'default'}>{statusLabel(p.status)}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-surface-500">
                <span className={languageColor(p.language)}>{p.language || 'auto'}</span>
                <span>{p.generated_tests || 0} tests</span>
                <span className={p.success_rate >= 50 ? 'text-accent-400' : 'text-red-400'}>{p.success_rate || 0}% pass</span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-surface-800">
                <Button variant="secondary" size="xs" className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${encodeURIComponent(p.project_name)}`) }}>
                  Open
                </Button>
                <Button variant="danger" size="xs" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.project_name) }}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project">
        <p className="text-sm text-surface-400 mb-5">Are you sure you want to delete <strong className="text-surface-200">{deleteTarget}</strong>? This will permanently remove all generated artifacts.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
