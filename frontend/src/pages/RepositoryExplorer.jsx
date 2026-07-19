import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Spinner, PageSpinner } from '../components/common/Spinner'
import { FileTree } from '../components/repository/FileTree'
import { formatDate, statusLabel } from '../utils/formatters'
import * as api from '../api'

const EXT_TO_MONACO = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', json: 'json',
  yml: 'yaml', yaml: 'yaml', md: 'markdown', html: 'html', css: 'css',
  xml: 'xml', sh: 'shell', txt: 'plaintext',
}

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cpp', '.h', '.hpp', '.py', '.java',
  '.js', '.jsx', '.ts', '.tsx', '.html', '.css',
  '.cs', '.go', '.rs',
])

function guessLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  return EXT_TO_MONACO[ext] || 'plaintext'
}

function isSourceFile(filePath) {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return false
  return SOURCE_EXTENSIONS.has(filePath.slice(dot).toLowerCase())
}

const TYPE_BADGE_VARIANT = {
  Function: 'info',
  Method: 'info',
  Class: 'success',
  Interface: 'warning',
  Variable: 'default',
}

function ContextPanel({ context, loading, filePath }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" />
      </div>
    )
  }

  if (!context) {
    return null
  }

  if (context.found === false) {
    const reason = context.reason || ''
    if (reason.includes('not indexed')) {
      return (
        <div className="bg-amber-600/5 border-t border-amber-600/20 px-4 py-3 text-xs text-amber-400">
          Repository not indexed — index it from the Repositories page to get code context.
        </div>
      )
    }
    if (reason) {
      return (
        <div className="bg-surface-900 border-t border-surface-800 px-4 py-3 text-xs text-surface-500">
          Context: {reason}
        </div>
      )
    }
    return null
  }

  const symbols = context.symbols || []
  const arch = context.project_architecture

  return (
    <div className="bg-surface-950 border-t border-surface-800 overflow-y-auto">
      <div className="px-4 py-2 bg-surface-900 border-b border-surface-800 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-400">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Context</span>
        {symbols.length > 0 && (
          <span className="text-[10px] text-surface-500 ml-auto">{symbols.length} symbols</span>
        )}
      </div>

      <div className="p-3 space-y-3 text-xs">
        {arch && (
          <div className="bg-surface-900/50 rounded-lg p-3 space-y-2">
            <h4 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Project</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {arch.languages?.length > 0 && (
                <span className="text-surface-400">
                  Languages: {arch.languages.map(l => l.language || l).join(', ')}
                </span>
              )}
              <span className="text-surface-400">Nodes: {arch.total_nodes}</span>
            </div>
            {arch.entry_points?.length > 0 && (
              <div>
                <span className="text-surface-500">Entry points:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {arch.entry_points.map((ep, i) => (
                    <span key={i} className="text-surface-400 bg-surface-800 rounded px-1.5 py-0.5">{ep.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {symbols.length > 0 ? (
          <div className="space-y-1">
            <h4 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Symbols in this file</h4>
            <div className="space-y-1">
              {symbols.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-surface-900/30 rounded px-2 py-1.5">
                  <Badge variant={TYPE_BADGE_VARIANT[s.type] || 'default'}>{s.type}</Badge>
                  <span className="text-surface-200 font-mono">{s.name}</span>
                  <span className="text-surface-600 ml-auto">{s.lines}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-surface-600 text-center py-3">
            No symbols found for this file in the code graph.
          </div>
        )}
      </div>
    </div>
  )
}

const TEST_CATEGORY_META = {
  functional: { label: 'Functional', variant: 'success' },
  edge_cases: { label: 'Edge Cases', variant: 'warning' },
  security: { label: 'Security', variant: 'danger' },
}

function TestResultsPanel({ testCases, generating, onGenerate }) {
  if (generating) {
    return (
      <div className="flex items-center justify-center py-8 border-t border-surface-800">
        <Spinner size="sm" />
        <span className="text-xs text-surface-500 ml-3">Generating test cases...</span>
      </div>
    )
  }

  if (!testCases) {
    return null
  }

  const hasTests = Object.values(testCases).some(cases => cases.length > 0)

  if (!hasTests) {
    return (
      <div className="border-t border-surface-800 px-4 py-4">
        <p className="text-xs text-surface-500">AI returned no test cases. Try again with a different file.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-950 border-t border-surface-800">
      <div className="px-4 py-2 bg-surface-900 border-b border-surface-800 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-400">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Generated Tests</span>
        {testCases.functional && (
          <span className="text-[10px] text-surface-500 ml-auto">
            {testCases.functional.length + testCases.edge_cases.length + testCases.security.length} cases
          </span>
        )}
      </div>
      <div className="p-3 space-y-3 text-xs">
        {Object.entries(TEST_CATEGORY_META).map(([key, meta]) => {
          const cases = testCases[key] || []
          if (cases.length === 0) return null
          return (
            <div key={key} className="space-y-1">
              <h4 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="ml-2 text-surface-600 font-normal normal-case">{cases.length} tests</span>
              </h4>
              <div className="space-y-1">
                {cases.map((tc, i) => (
                  <div key={i} className="flex items-start gap-2 bg-surface-900/30 rounded px-2 py-1.5">
                    <span className="text-surface-600 font-mono text-[10px] mt-0.5 flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-surface-200 leading-relaxed">{tc}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExecutionPanel({ result, generating, onExecute }) {
  if (generating) {
    return (
      <div className="flex items-center justify-center py-6 border-t border-surface-800">
        <Spinner size="sm" />
        <span className="text-xs text-surface-500 ml-3">Executing tests...</span>
      </div>
    )
  }

  if (!result) return null

  const summary = result.summary || { total: 0, passed: 0, failed: 0 }
  const failedTests = []
  const passedTests = []
  for (const key of ['functional', 'edge_cases', 'security']) {
    for (const t of result[key] || []) {
      const entry = { ...t, category: key }
      if (t.status === 'FAIL') failedTests.push(entry)
      else passedTests.push(entry)
    }
  }

  return (
    <div className="bg-surface-950 border-t border-surface-800">
      <div className="px-4 py-2 bg-surface-900 border-b border-surface-800 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-400">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Execution Results</span>
      </div>
      <div className="p-3 space-y-3 text-xs">
        <div className="flex items-center gap-4 bg-surface-900/50 rounded-lg p-3">
          <div className="text-center">
            <div className="text-lg font-bold text-surface-100">{summary.total}</div>
            <div className="text-[10px] text-surface-500 uppercase">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400">{summary.passed}</div>
            <div className="text-[10px] text-surface-500 uppercase">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">{summary.failed}</div>
            <div className="text-[10px] text-surface-500 uppercase">Failed</div>
          </div>
        </div>

        {failedTests.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Failed</h4>
            {failedTests.map((t, i) => (
              <div key={i} className="flex items-start gap-2 bg-red-900/10 rounded px-2 py-1.5">
                <Badge variant="danger">FAIL</Badge>
                <div className="min-w-0">
                  <span className="text-surface-200 leading-relaxed block">{t.test_case}</span>
                  <span className="text-red-400/70 text-[10px]">{t.remarks}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {passedTests.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Passed</h4>
            {passedTests.map((t, i) => (
              <div key={i} className="flex items-start gap-2 bg-emerald-900/5 rounded px-2 py-1.5">
                <Badge variant="success">PASS</Badge>
                <div className="min-w-0">
                  <span className="text-surface-200 leading-relaxed block">{t.test_case}</span>
                  <span className="text-surface-500 text-[10px]">{t.remarks}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportPanel({ reportText, generating, onGenerate, onDownload }) {
  if (generating) {
    return (
      <div className="flex items-center justify-center py-6 border-t border-surface-800">
        <Spinner size="sm" />
        <span className="text-xs text-surface-500 ml-3">Generating report...</span>
      </div>
    )
  }

  if (!reportText) return null

  return (
    <div className="bg-surface-950 border-t border-surface-800">
      <div className="px-4 py-2 bg-surface-900 border-b border-surface-800 flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-purple-400">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">Report</span>
        <div className="ml-auto">
          <Button variant="secondary" size="xs" onClick={onDownload}>
            Download Report
          </Button>
        </div>
      </div>
      <div className="p-3">
        <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap leading-relaxed bg-surface-900/30 rounded-lg p-3 max-h-80 overflow-y-auto">{reportText}</pre>
      </div>
    </div>
  )
}

function collectSupportedFiles(nodes) {
  const files = []
  for (const node of nodes) {
    if (node.type === 'file') {
      if (isSourceFile(node.path)) {
        files.push(node.path)
      }
    } else if (node.type === 'directory' && node.children) {
      files.push(...collectSupportedFiles(node.children))
    }
  }
  return files
}

export default function RepositoryExplorer() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [repo, setRepo] = useState(null)
  const [tree, setTree] = useState(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [fileContent, setFileContent] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [error, setError] = useState(null)
  const [testCases, setTestCases] = useState(null)
  const [testGenerating, setTestGenerating] = useState(false)
  const [executionResult, setExecutionResult] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [reportText, setReportText] = useState(null)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [generatedFiles, setGeneratedFiles] = useState(null)
  const [executedFiles, setExecutedFiles] = useState(null)
  const [summary, setSummary] = useState(null)
  const [expandedFiles, setExpandedFiles] = useState(new Set())
  const fetchIdRef = useRef(0)
  const selectAllRef = useRef(null)

  const allSupportedFiles = useMemo(() => {
    return tree ? collectSupportedFiles(tree) : []
  }, [tree])

  const supportedSelectedFiles = useMemo(() => {
    return [...selectedFiles].filter(f => isSourceFile(f))
  }, [selectedFiles])

  const isAllSelected = selectedFiles.size === allSupportedFiles.length && allSupportedFiles.length > 0
  const isIndeterminate = selectedFiles.size > 0 && !isAllSelected

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  useEffect(() => {
    async function load() {
      setTreeLoading(true)
      setError(null)
      try {
        const [repoRes, treeRes] = await Promise.all([
          api.getRepository(id),
          api.getRepositoryTree(id),
        ])
        if (repoRes.success) setRepo(repoRes.data)
        else setError(repoRes.error?.message || 'Repository not found')
        if (treeRes.success) setTree(treeRes.data?.tree || [])
        else setError(treeRes.error?.message || 'Failed to load tree')
      } catch (e) {
        setError(e.message)
      } finally {
        setTreeLoading(false)
      }
    }
    load()
  }, [id])

  const handleSelect = useCallback(async (filePath) => {
    const fetchId = ++fetchIdRef.current
    setSelectedFile(filePath)
    setFileLoading(true)
    setContext(null)
    setContextLoading(true)
    setTestCases(null)
    setGeneratedFiles(null)
    setExecutedFiles(null)
    setExecutionResult(null)
    setReportText(null)
    setSummary(null)
    setError(null)

    try {
      const [fileRes, ctxRes] = await Promise.all([
        api.getSourceFile(id, filePath),
        api.getFileContext(id, filePath),
      ])
      if (fetchId !== fetchIdRef.current) return
      if (fileRes.success) {
        setFileContent(fileRes.data.content)
      } else {
        setError(fileRes.error?.message || 'Failed to load file')
        setFileContent(null)
      }
      setContext(ctxRes.success ? ctxRes.data : ctxRes)
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return
      setError(e.message)
      setFileContent(null)
      setContext(null)
    } finally {
      if (fetchId === fetchIdRef.current) {
        setFileLoading(false)
        setContextLoading(false)
      }
    }
  }, [id])

  const handleToggle = useCallback((filePath) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
    setTestCases(null)
    setGeneratedFiles(null)
    setExecutedFiles(null)
    setExecutionResult(null)
    setReportText(null)
    setSummary(null)
    setError(null)
  }, [])

  const handleSelectAll = useCallback((checked) => {
    setSelectedFiles(checked ? new Set(allSupportedFiles) : new Set())
    setTestCases(null)
    setGeneratedFiles(null)
    setExecutedFiles(null)
    setExecutionResult(null)
    setReportText(null)
    setSummary(null)
    setError(null)
  }, [allSupportedFiles])

  const handleGenerateTests = useCallback(async () => {
    if (selectedFiles.size === 0) return
    setTestGenerating(true)
    setTestCases(null)
    setGeneratedFiles(null)
    setExecutedFiles(null)
    setExecutionResult(null)
    setReportText(null)
    setSummary(null)
    setError(null)
    try {
      const res = await api.generateRepositoryTests(id, [...selectedFiles])
      if (res.success) {
        setGeneratedFiles(res.data.files)
        setSummary(res.data.summary)
        if (res.data.files.length === 1 && res.data.files[0].status === 'success') {
          setTestCases(res.data.files[0].test_cases)
        }
      } else {
        setError(res.error?.message || 'Test generation failed')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setTestGenerating(false)
    }
  }, [id, selectedFiles])

  const handleExecuteTests = useCallback(async () => {
    if (selectedFiles.size === 0) return
    if (!testCases && !generatedFiles) return
    setExecuting(true)
    setExecutionResult(null)
    setExecutedFiles(null)
    setReportText(null)
    setSummary(null)
    setError(null)
    try {
      let testCasesMap = null
      if (generatedFiles && generatedFiles.length > 0) {
        testCasesMap = {}
        generatedFiles.forEach(f => {
          if (f.test_cases) testCasesMap[f.selected_file] = f.test_cases
        })
      }
      const res = await api.executeRepositoryTests(id, [...selectedFiles], testCases, testCasesMap)
      if (res.success) {
        setExecutedFiles(res.data.files)
        setSummary(res.data.summary)
        if (res.data.files.length === 1 && res.data.files[0].status === 'success') {
          setExecutionResult(res.data.files[0].execution_result)
        }
      } else {
        setError(res.error?.message || 'Test execution failed')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setExecuting(false)
    }
  }, [id, selectedFiles, testCases, generatedFiles])

  const handleGenerateReport = useCallback(async () => {
    if (selectedFiles.size === 0) return
    if (!executionResult && !executedFiles) return
    setReportGenerating(true)
    setReportText(null)
    setError(null)
    try {
      let executionResults = null
      if (executedFiles && executedFiles.length > 0) {
        executionResults = {}
        executedFiles.forEach(f => {
          if (f.execution_result) executionResults[f.selected_file] = f.execution_result
        })
      }
      const res = await api.generateRepositoryReport(id, [...selectedFiles], executionResults)
      if (res.success) {
        setReportText(res.data.report)
        setSummary(res.data.summary)
      } else {
        setError(res.error?.message || 'Report generation failed')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setReportGenerating(false)
    }
  }, [id, selectedFiles, executionResult, executedFiles])

  const handleDownloadReport = useCallback(() => {
    if (!selectedFile) return
    const url = `/api/repositories/${encodeURIComponent(id)}/download-report?selected_file=${encodeURIComponent(selectedFile)}`
    window.open(url, '_blank')
  }, [id, selectedFile])

  if (!repo && treeLoading) return <PageSpinner />

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-surface-800 bg-surface-950 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/repositories')}
            className="text-surface-500 hover:text-surface-200 transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-surface-100 truncate">{repo?.repository_name || 'Repository'}</h1>
            <p className="text-xs text-surface-500 truncate font-mono">{id}</p>
          </div>
          {repo && (
            <Badge variant={repo.status === 'READY' ? 'success' : 'warning'}>
              {statusLabel(repo.status)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-surface-500 flex-shrink-0 ml-4">
          {repo && (
            <>
              <span>{repo.total_files} files</span>
              <span className="text-surface-700">|</span>
              <span>{formatDate(repo.upload_time)}</span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-600/10 border-b border-red-600/20 px-6 py-2 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-4">✕</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-72 flex-shrink-0 border-r border-surface-800 overflow-y-auto bg-surface-950 p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Files</h2>
            {tree && <span className="text-[10px] text-surface-600">{tree.length} items</span>}
          </div>

          {allSupportedFiles.length > 0 && (
            <label className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-md hover:bg-surface-800 cursor-pointer text-xs">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="accent-accent-500 flex-shrink-0"
              />
              <span className="text-surface-400 font-medium">Select All Supported Files</span>
            </label>
          )}

          {selectedFiles.size > 0 && (
            <div className="px-2 pb-2 text-xs text-accent-400 font-medium">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </div>
          )}

          <FileTree
            tree={tree}
            selectedPaths={selectedFiles}
            onSelect={handleSelect}
            onToggle={handleToggle}
            loading={treeLoading}
            isSourceFile={isSourceFile}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-surface-950 overflow-y-auto">
          {selectedFile ? (
            <div className="flex flex-col min-h-full">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-900 border-b border-surface-800 sticky top-0 z-10">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-surface-500 flex-shrink-0">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="text-xs text-surface-300 font-mono truncate">{selectedFile}</span>
                </div>
                {supportedSelectedFiles.length > 0 ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleGenerateTests}
                    loading={testGenerating}
                    disabled={testGenerating}
                  >
                    Generate Tests
                    {selectedFiles.size > 1 ? ` (${selectedFiles.size} files)` : ''}
                  </Button>
                ) : (
                  <span className="text-[10px] text-surface-500 italic">
                    Test generation not available for this file type
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-[200px] relative">
                {fileLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size="sm" />
                  </div>
                ) : fileContent !== null ? (
                  <Editor
                    key={selectedFile}
                    height="100%"
                    defaultLanguage={guessLanguage(selectedFile)}
                    value={fileContent}
                    theme="vs-dark"
                    onMount={(editor) => {
                      setTimeout(() => editor.layout(), 0)
                    }}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
                      wordWrap: 'on',
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-surface-600">Unable to load file content</p>
                  </div>
                )}
              </div>
              <ContextPanel
                context={context}
                loading={contextLoading}
                filePath={selectedFile}
              />

              {generatedFiles && generatedFiles.length > 1 ? (
                <>
                  {summary && (
                    <div className="border-t border-surface-800 px-4 py-3 bg-surface-900">
                      <div className="flex items-center gap-6 text-xs">
                        <span className="text-surface-400">Files: <span className="text-surface-200 font-medium">{summary.files_processed}/{summary.files_selected}</span></span>
                        {summary.tests_generated !== undefined && (
                          <span className="text-surface-400">Tests: <span className="text-surface-200 font-medium">{summary.tests_generated}</span></span>
                        )}
                        {summary.tests_executed !== undefined && (
                          <>
                            <span className="text-surface-400">Executed: <span className="text-surface-200 font-medium">{summary.tests_executed}</span></span>
                            <span className="text-emerald-400">Passed: {summary.passed}</span>
                            <span className="text-red-400">Failed: {summary.failed}</span>
                            <span className="text-surface-400">Rate: <span className="text-surface-200 font-medium">{summary.overall_pass_percentage}%</span></span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-surface-800 divide-y divide-surface-800">
                    {(generatedFiles || executedFiles || []).map((f, i) => {
                      const fileResult = executedFiles ? executedFiles.find(ef => ef.selected_file === f.selected_file) || f : f
                      const isExpanded = expandedFiles.has(f.selected_file)
                      return (
                        <div key={f.selected_file}>
                          <button
                            onClick={() => setExpandedFiles(prev => {
                              const next = new Set(prev)
                              if (next.has(f.selected_file)) next.delete(f.selected_file)
                              else next.add(f.selected_file)
                              return next
                            })}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-surface-900/50 transition-colors text-left"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                              className={`flex-shrink-0 transition-transform text-surface-500 ${isExpanded ? 'rotate-90' : ''}`}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span className={`font-mono truncate flex-1 ${f.status === 'error' ? 'text-red-400' : 'text-surface-200'}`}>{f.selected_file}</span>
                            {f.status === 'success' && <span className="text-emerald-400 font-medium">Success</span>}
                            {f.status === 'error' && <span className="text-red-400 font-medium">Failed</span>}
                            {f.status === 'skipped' && <span className="text-surface-500 font-medium">Skipped</span>}
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-3">
                              {f.status === 'error' && (
                                <p className="text-xs text-red-400 bg-red-900/10 rounded px-3 py-2">{f.error || 'Unknown error'}</p>
                              )}
                              {fileResult.test_cases && (
                                <TestResultsPanel testCases={fileResult.test_cases} generating={false} onGenerate={() => {}} />
                              )}
                              {fileResult.execution_result && (
                                <ExecutionPanel result={fileResult.execution_result} generating={false} onExecute={() => {}} />
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {!executing && !executedFiles && (
                    <div className="border-t border-surface-800 px-4 py-3 flex justify-center">
                      <Button onClick={handleExecuteTests}>Execute Tests</Button>
                    </div>
                  )}

                  {executedFiles && !reportGenerating && !reportText && (
                    <div className="border-t border-surface-800 px-4 py-3 flex justify-center">
                      <Button onClick={handleGenerateReport}>Generate Report</Button>
                    </div>
                  )}

                  <ReportPanel
                    reportText={reportText}
                    generating={reportGenerating}
                    onGenerate={handleGenerateReport}
                    onDownload={handleDownloadReport}
                  />
                </>
              ) : (
                <>
                  <TestResultsPanel
                    testCases={testCases}
                    generating={testGenerating}
                    onGenerate={handleGenerateTests}
                  />
                  {(testCases || generatedFiles) && !executing && !executionResult && (
                    <div className="border-t border-surface-800 px-4 py-3 flex justify-center">
                      <Button onClick={handleExecuteTests}>Execute Tests</Button>
                    </div>
                  )}
                  <ExecutionPanel
                    result={executionResult}
                    generating={executing}
                    onExecute={handleExecuteTests}
                  />
                  {executionResult && !reportGenerating && !reportText && (
                    <div className="border-t border-surface-800 px-4 py-3 flex justify-center">
                      <Button onClick={handleGenerateReport}>Generate Report</Button>
                    </div>
                  )}
                  <ReportPanel
                    reportText={reportText}
                    generating={reportGenerating}
                    onGenerate={handleGenerateReport}
                    onDownload={handleDownloadReport}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-surface-700 mx-auto mb-3">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p className="text-sm text-surface-600">Select a file to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
