import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getProjectFiles, getProjectTimeline, getReport, deleteProject } from '../api'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PageSpinner } from '../components/common/Spinner'
import { Modal } from '../components/common/Modal'
import { formatDate, formatDuration, statusLabel } from '../utils/formatters'

export default function ProjectDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [timeline, setTimeline] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeFile, setActiveFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  const decodedName = decodeURIComponent(name)

  useEffect(() => {
    Promise.all([
      getProject(decodedName),
      getProjectFiles(decodedName),
      getProjectTimeline(decodedName),
      getReport(decodedName).catch(() => ({ success: false })),
    ]).then(([pRes, fRes, tRes, rRes]) => {
      if (pRes.success) setProject(pRes.data)
      if (fRes.success) setFiles(fRes.data || [])
      if (tRes.success) setTimeline(tRes.data || [])
      if (rRes.success) setReport(rRes.data?.report || null)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [decodedName])

  const handleDelete = async () => {
    await deleteProject(decodedName)
    navigate('/projects')
  }

  if (loading) return <PageSpinner />
  if (!project) return <div className="flex-1 flex items-center justify-center text-surface-500">Project not found</div>

  const stats = [
    { label: 'Language', value: project.language || 'auto' },
    { label: 'Status', value: statusLabel(project.status) },
    { label: 'Created', value: formatDate(project.created_at) },
    { label: 'Updated', value: formatDate(project.updated_at) },
    { label: 'Generation', value: formatDuration(project.generation_time) },
    { label: 'Compilation', value: formatDuration(project.compilation_time) },
    { label: 'Execution', value: formatDuration(project.execution_time) },
    { label: 'Report Gen', value: formatDuration(project.report_generation_time) },
    { label: 'Total Tests', value: project.generated_tests },
    { label: 'Passed', value: project.passed },
    { label: 'Failed', value: project.failed },
    { label: 'Pass Rate', value: `${project.success_rate || 0}%` },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')} className="text-surface-500 hover:text-surface-300 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-surface-100">{project.project_name}</h1>
            <p className="text-sm text-surface-500">{formatDate(project.updated_at)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/workspace')}>Open in Workspace</Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <Card>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-surface-600">No timeline entries</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((e, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${e.status === 'completed' ? 'bg-accent-500' : 'bg-surface-600'}`} />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-surface-200">{e.step}</span>
                      <span className="text-xs text-surface-500">{e.duration || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {files.length > 0 && (
            <Card>
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Files</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {files.map(f => (
                  <button
                    key={f.name}
                    onClick={() => setPreviewFile(f)}
                    className="text-left p-3 rounded-lg border text-sm transition-colors bg-surface-900/50 border-surface-800 hover:border-surface-700"
                  >
                    <p className="text-surface-200 truncate font-mono text-xs">{f.name}</p>
                    <p className="text-xs text-surface-600 mt-1">{(f.size / 1024).toFixed(1)} KB</p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {report && (
            <Card>
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Report Preview</h3>
              <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-surface-950 rounded-lg p-3">{report}</pre>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Details</h3>
            <div className="space-y-2.5">
              {stats.map(s => (
                <div key={s.label} className="flex justify-between items-center">
                  <span className="text-xs text-surface-500">{s.label}</span>
                  <span className="text-xs text-surface-200 font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => {
              const blob = new Blob([report || ''], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `${project.project_name}_report.txt`
              document.body.appendChild(a); a.click()
              document.body.removeChild(a); URL.revokeObjectURL(url)
            }} disabled={!report}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Download Report
            </Button>
          </div>
        </div>
      </div>

      <Modal open={!!previewFile} onClose={() => setPreviewFile(null)} title={previewFile?.name}>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Name', value: previewFile?.name },
              { label: 'Size', value: previewFile?.size ? `${(previewFile.size / 1024).toFixed(1)} KB` : '-' },
              { label: 'Modified', value: previewFile?.modified ? formatDate(previewFile.modified) : '-' },
            ].map(s => (
              <div key={s.label} className="bg-surface-900 rounded-lg p-3">
                <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="text-sm text-surface-200 font-mono">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-surface-900 rounded-lg p-4 text-center">
            <p className="text-surface-500 text-sm">File preview is not available</p>
            <p className="text-surface-600 text-xs mt-1">Download the project files to view this file locally.</p>
          </div>
        </div>
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Project">
        <p className="text-sm text-surface-400 mb-5">Delete <strong className="text-surface-200">{project.project_name}</strong>? All files will be permanently removed.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
