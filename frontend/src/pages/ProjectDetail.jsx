import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { getProject, getProjectFiles, getProjectTimeline, getReport, getProjectFile, deleteProject } from '../api'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PageSpinner, Spinner } from '../components/common/Spinner'
import { Modal } from '../components/common/Modal'
import { formatDate, formatDuration, statusLabel } from '../utils/formatters'

const FILE_LANG_MAP = {
  cpp: 'cpp', c: 'c', h: 'cpp', hpp: 'cpp',
  py: 'python', js: 'javascript', jsx: 'javascript',
  java: 'java', json: 'json', txt: 'plaintext',
  md: 'markdown', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  toml: 'plaintext', cfg: 'plaintext', ini: 'plaintext',
  log: 'plaintext', out: 'plaintext',
}

export default function ProjectDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [timeline, setTimeline] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)

  const [previewFile, setPreviewFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState(null)

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

  useEffect(() => {
    if (!previewFile) {
      setFileContent('')
      setFileError(null)
      return
    }
    setLoadingFile(true)
    setFileError(null)
    getProjectFile(decodedName, previewFile.name)
      .then(res => {
        if (res.success) setFileContent(res.data.content)
        else setFileError(res.error?.message || 'Failed to load file')
      })
      .catch(() => setFileError('Failed to load file'))
      .finally(() => setLoadingFile(false))
  }, [decodedName, previewFile])

  const handleOpenInWorkspace = () => {
    navigate('/workspace', { state: { projectName: decodedName } })
  }

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
          <Button variant="secondary" onClick={handleOpenInWorkspace}>Open in Workspace</Button>
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
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                      previewFile?.name === f.name
                        ? 'bg-surface-800 border-accent-500/30'
                        : 'bg-surface-900/50 border-surface-800 hover:border-surface-700'
                    }`}
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

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
          <div className="relative bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl w-[80vw] max-w-[1200px] min-w-[320px] h-[80vh] max-h-[900px] min-h-[300px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 shrink-0">
              <h2 className="text-lg font-semibold text-surface-100 truncate">{previewFile.name}</h2>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigator.clipboard.writeText(fileContent)}
                  disabled={!fileContent || loadingFile || !!fileError}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                  Copy
                </button>
                <button onClick={() => setPreviewFile(null)} className="text-surface-500 hover:text-surface-300 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>
              ) : fileError ? (
                <div className="flex items-center justify-center h-full text-surface-500 text-sm">{fileError}</div>
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage={FILE_LANG_MAP[previewFile.name?.split('.').pop()] || 'plaintext'}
                  value={fileContent}
                  theme="vs-dark"
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 12 } }}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
