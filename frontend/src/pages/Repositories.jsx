import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Spinner, PageSpinner } from '../components/common/Spinner'
import { EmptyState } from '../components/common/EmptyState'
import { Modal } from '../components/common/Modal'
import { formatDate } from '../utils/formatters'
import * as api from '../api'

export default function Repositories() {
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)

  const fetchRepos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getRepositories()
      if (res.success) setRepos(res.data || [])
      else setError(res.error?.message || 'Failed to fetch repositories')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRepos() }, [fetchRepos])

  const handleUpload = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Only ZIP files are accepted')
      return
    }

    setUploading(true)
    setError(null)
    setSuccessMsg(null)
    setUploadProgress(0)

    try {
      const res = await api.uploadRepository(file, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      if (res.success) {
        setSuccessMsg(`Repository "${res.data.repository_name}" uploaded successfully`)
        await fetchRepos()
      } else {
        setError(res.error?.message || 'Upload failed')
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleUpload(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.deleteRepository(deleteTarget)
      if (res.success) {
        setRepos(prev => prev.filter(r => r.repository_id !== deleteTarget))
        setSuccessMsg('Repository deleted')
      } else {
        setError(res.error?.message || 'Delete failed')
      }
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const dismissSuccess = () => setSuccessMsg(null)
  const dismissError = () => setError(null)

  if (loading) return <PageSpinner />

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Repositories</h1>
          <p className="text-sm text-surface-500 mt-1">{repos.length} repositories</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={e => handleUpload(e.target.files[0])}
        />
        <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Upload ZIP
        </Button>
      </div>

      {successMsg && (
        <div className="bg-accent-600/10 border border-accent-600/20 rounded-lg px-4 py-3 text-sm text-accent-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            {successMsg}
          </span>
          <button onClick={dismissSuccess} className="text-accent-400/60 hover:text-accent-400">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-red-600/10 border border-red-600/20 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            {error}
          </span>
          <button onClick={dismissError} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragOver
            ? 'border-accent-500 bg-accent-600/5'
            : 'border-surface-700 hover:border-surface-600 bg-surface-900/30'
        } ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
            <p className="text-sm text-surface-400">Uploading... {uploadProgress}%</p>
            {uploadProgress > 0 && (
              <div className="w-64 h-2 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-surface-500">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-medium text-surface-400">
              Drag & drop a ZIP file here, or click to browse
            </p>
            <p className="text-xs text-surface-600">Only .zip files are accepted</p>
          </div>
        )}
      </div>

      {repos.length === 0 ? (
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-surface-600">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          }
          title="No repositories yet"
          description="Upload a ZIP file to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {repos.map(r => (
            <Card key={r.repository_id} padding>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-surface-200">{r.repository_name}</h3>
                    <Badge variant="info">READY_FOR_ANALYSIS</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                    <span>ID: <span className="text-surface-400 font-mono">{r.repository_id.slice(0, 8)}...</span></span>
                    <span>Size: <span className="text-surface-400">{formatSize(r.repository_size)}</span></span>
                    <span>Files: <span className="text-surface-400">{r.total_files}</span></span>
                    <span>Uploaded: <span className="text-surface-400">{formatDate(r.upload_time)}</span></span>
                  </div>
                </div>
                <Button variant="danger" size="xs" onClick={() => setDeleteTarget(r.repository_id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Repository">
        <p className="text-sm text-surface-400 mb-5">
          Are you sure you want to delete this repository? This will permanently remove the uploaded source files and all associated data.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
