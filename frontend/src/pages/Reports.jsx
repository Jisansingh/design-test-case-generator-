import { useState, useMemo } from 'react'
import { useReports } from '../hooks/useReports'
import { getReport } from '../api'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PageSpinner, Spinner } from '../components/common/Spinner'
import { EmptyState } from '../components/common/EmptyState'
import { Modal } from '../components/common/Modal'
import { formatDate } from '../utils/formatters'

export default function Reports() {
  const { reports, loading, error, refresh, remove } = useReports()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [reportContent, setReportContent] = useState(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (search && !r.project_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [reports, search])

  const openReport = async (projectName) => {
    setSelected(projectName)
    setLoadingContent(true)
    setReportContent(null)
    try {
      const res = await getReport(projectName)
      if (res.success) setReportContent(res.data?.report || 'No content')
      else setReportContent('No content')
    } catch {
      setReportContent('No content')
    } finally {
      setLoadingContent(false)
    }
  }

  const closeReport = () => {
    setSelected(null)
    setReportContent(null)
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    await remove(selected)
    setDeleting(false)
    setShowDelete(false)
    setSelected(null)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Reports</h1>
          <p className="text-sm text-surface-500 mt-1">{reports.length} total reports</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reports by project..."
            className="w-full bg-surface-900 border border-surface-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-accent-500/50"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
          title={search ? 'No matching reports' : 'No reports yet'}
          description={search ? 'Try adjusting your search.' : 'Generate a report from the workspace to see it here.'}
          action={!search ? <Button variant="primary" onClick={() => window.location.href = '/workspace'}>Go to Workspace</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.project_name + r.generated_at} hover onClick={() => openReport(r.project_name)}>
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-surface-200 truncate">{r.project_name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                    <span>{formatDate(r.generated_at)}</span>
                    <span>{r.report_file}</span>
                    <span>{r.size ? `${(r.size / 1024).toFixed(1)} KB` : ''}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4" onClick={e => e.stopPropagation()}>
                  <Button variant="secondary" size="xs" onClick={() => openReport(r.project_name)}>View</Button>
                  <Button variant="danger" size="xs" onClick={() => { setSelected(r.project_name); setShowDelete(true) }}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected && !showDelete} onClose={closeReport} title={selected}>
        {loadingContent ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : (
          <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto bg-surface-950 rounded-lg p-4">{reportContent}</pre>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={closeReport}>Close</Button>
          <Button variant="primary" className="ml-2" onClick={() => {
            const blob = new Blob([reportContent || ''], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `${selected}_report.txt`
            a.click()
            URL.revokeObjectURL(url)
          }}>Download</Button>
        </div>
      </Modal>

      <Modal open={showDelete} onClose={() => { setShowDelete(false); closeReport() }} title="Delete Report">
        <p className="text-sm text-surface-400 mb-5">Delete report for <strong className="text-surface-200">{selected}</strong>?</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setShowDelete(false); closeReport() }}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
