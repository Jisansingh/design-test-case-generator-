import { useState, useEffect, useCallback, useRef } from 'react'
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

export default function RepositoryExplorer() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [repo, setRepo] = useState(null)
  const [tree, setTree] = useState(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [error, setError] = useState(null)
  const [testCases, setTestCases] = useState(null)
  const [testGenerating, setTestGenerating] = useState(false)
  const fetchIdRef = useRef(0)

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

  const handleGenerateTests = useCallback(async () => {
    if (!selectedFile) return
    setTestGenerating(true)
    setTestCases(null)
    setError(null)
    try {
      const res = await api.generateRepositoryTests(id, selectedFile)
      if (res.success) setTestCases(res.data.test_cases)
      else setError(res.error?.message || 'Test generation failed')
    } catch (e) {
      setError(e.message)
    } finally {
      setTestGenerating(false)
    }
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
          <FileTree
            tree={tree}
            selectedPath={selectedFile}
            onSelect={handleSelect}
            loading={treeLoading}
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
                {isSourceFile(selectedFile) ? (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleGenerateTests}
                    loading={testGenerating}
                    disabled={testGenerating}
                  >
                    Generate Tests
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
              <TestResultsPanel
                testCases={testCases}
                generating={testGenerating}
                onGenerate={handleGenerateTests}
              />
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
