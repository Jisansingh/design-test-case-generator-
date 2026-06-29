import { useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { Card } from '../components/common/Card'
import { Spinner, InlineSpinner } from '../components/common/Spinner'
import { formatDate, formatDuration, successRate, statusLabel, languageColor } from '../utils/formatters'
import * as api from '../api'

const STORAGE_KEY = 'ai-studio-workspace-draft'

export default function Workspace() {
  const [design, setDesign] = useState('')
  const [projectName, setProjectName] = useState('')
  const [language, setLanguage] = useState('')
  const [activeTab, setActiveTab] = useState('code')
  const [running, setRunning] = useState(null)
  const [error, setError] = useState(null)

  const [generatedCode, setGeneratedCode] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [executionResults, setExecutionResults] = useState(null)
  const [reportText, setReportText] = useState(null)
  const [crashResult, setCrashResult] = useState(null)
  const [crashReport, setCrashReport] = useState(null)

  const [timeline, setTimeline] = useState([])
  const [logs, setLogs] = useState([])
  const [activeBottomTab, setActiveBottomTab] = useState('timeline')

  const [projectStats, setProjectStats] = useState(null)
  const [projectFiles, setProjectFiles] = useState([])

  const textareaRef = useRef(null)
  const initialized = useRef(false)

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }])
  }, [])

  const deriveName = useCallback((d) => {
    return d.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 60).replace(/^[._]+|[._]+$/g, '') || 'untitled'
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setDesign(saved)
    }
  }, [])

  useEffect(() => {
    if (initialized.current) {
      localStorage.setItem(STORAGE_KEY, design)
    }
  }, [design])

  const handleGenerateCode = async () => {
    if (!design.trim()) return
    setRunning('code')
    setError(null)
    const pn = projectName || deriveName(design)
    try {
      addLog('Generating code...', 'info')
      const res = await api.generateCode(design, language || null, pn)
      setGeneratedCode(res)
      setProjectName(pn)
      addLog(`Code generated (${res.language})`, 'success')
      setActiveTab('code')

      const meta = await api.getProject(pn)
      if (meta.success) setProjectStats(meta.data)
      const files = await api.getProjectFiles(pn)
      if (files.success) setProjectFiles(files.data)
      const tl = await api.getProjectTimeline(pn)
      if (tl.success) setTimeline(tl.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      addLog(`Code generation failed: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const handleGenerateTests = async () => {
    if (!design.trim()) return
    setRunning('tests')
    setError(null)
    const pn = projectName || deriveName(design)
    try {
      addLog('Generating test cases...', 'info')
      const res = await api.generateTests(design, pn)
      setTestResults(res)
      addLog('Test cases generated', 'success')
      setActiveTab('tests')

      const meta = await api.getProject(pn)
      if (meta.success) setProjectStats(meta.data)
      const files = await api.getProjectFiles(pn)
      if (files.success) setProjectFiles(files.data)
      const tl = await api.getProjectTimeline(pn)
      if (tl.success) setTimeline(tl.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      addLog(`Test generation failed: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const handleExecuteTests = async () => {
    if (!design.trim()) return
    setRunning('execute')
    setError(null)
    const pn = projectName || deriveName(design)
    try {
      addLog('Executing test cases...', 'info')
      const res = await api.executeTests(design, pn)
      setExecutionResults(res)
      addLog(`Tests executed: ${res.summary.passed}/${res.summary.total} passed`, 'success')
      setActiveTab('execution')

      const meta = await api.getProject(pn)
      if (meta.success) setProjectStats(meta.data)
      const tl = await api.getProjectTimeline(pn)
      if (tl.success) setTimeline(tl.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      addLog(`Execution failed: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const handleGenerateReport = async () => {
    if (!design.trim()) return
    setRunning('report')
    setError(null)
    const pn = projectName || deriveName(design)
    try {
      addLog('Generating report...', 'info')
      const res = await api.generateReport(design, pn)
      setReportText(res.report)
      addLog('Report generated', 'success')
      setActiveTab('report')

      const meta = await api.getProject(pn)
      if (meta.success) setProjectStats(meta.data)
      const tl = await api.getProjectTimeline(pn)
      if (tl.success) setTimeline(tl.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      addLog(`Report generation failed: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const handleDownloadReport = async () => {
    const pn = projectName || deriveName(design)
    try {
      addLog('Downloading report...', 'info')
      const blob = await api.downloadReport(design, pn)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'report.txt'
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addLog('Report downloaded', 'success')
    } catch (e) {
      addLog(`Download failed: ${e.message}`, 'error')
    }
  }

  const handleCrashAnalysis = async () => {
    if (!generatedCode?.code) {
      setError('Generate code first before running crash analysis.')
      return
    }
    setRunning('crash')
    setError(null)
    const pn = projectName || deriveName(design)
    try {
      addLog('Running crash analysis...', 'info')
      const simRes = await api.analyzeUserCrash(generatedCode.code, generatedCode.language, pn)
      setCrashResult(simRes)

      const btFrames = simRes.backtrace || []
      if (btFrames.length > 0) {
        const btStrs = btFrames.map(f => `#${f.frame} ${f.function}`)
        const reportRes = await api.analyzeCrashReport(btStrs, {
          code: generatedCode.code,
          signal: simRes.signal,
          stderr: simRes.stderr,
          backtrace_frames: btFrames,
        })
        setCrashReport(reportRes)
        addLog(`AI analysis: ${reportRes.crash_location}`, 'success')
      } else {
        setCrashReport({
          crash_location: 'No crash detected',
          root_cause: simRes.stderr || 'Program executed without crashing.',
          severity: 'none',
          suggested_fix: 'No fix needed.',
        })
        addLog('No crash detected — skipping AI analysis', 'info')
      }
      setActiveTab('crash')

      const tl = await api.getProjectTimeline(pn)
      if (tl.success) setTimeline(tl.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      addLog(`Crash analysis failed: ${e.message}`, 'error')
    } finally {
      setRunning(null)
    }
  }

  const tabs = [
    { id: 'code', label: 'Code', disabled: !generatedCode },
    { id: 'tests', label: 'Test Cases', disabled: !testResults },
    { id: 'execution', label: 'Execution', disabled: !executionResults },
    { id: 'crash', label: 'Crash Analysis', disabled: !crashReport },
    { id: 'report', label: 'Reports', disabled: !reportText },
  ]

  const bottomTabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'logs', label: 'Logs' },
  ]

  const actionButtons = [
    { label: 'Generate Code', onClick: handleGenerateCode, loading: running === 'code', variant: 'primary' },
    { label: 'Generate Tests', onClick: handleGenerateTests, loading: running === 'tests', variant: 'secondary' },
    { label: 'Execute Tests', onClick: handleExecuteTests, loading: running === 'execute', variant: 'secondary' },
    { label: 'Generate Report', onClick: handleGenerateReport, loading: running === 'report', variant: 'secondary' },
    { label: 'Analyze Crash', onClick: handleCrashAnalysis, loading: running === 'crash', variant: 'danger' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Project name..."
              className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-accent-500/50"
            />
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200 focus:outline-none focus:border-accent-500/50"
            >
              <option value="">Auto-detect</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
              <option value="react">React</option>
            </select>
          </div>

          <div className="relative flex-1 min-h-0">
            <textarea
              ref={textareaRef}
              value={design}
              onChange={e => setDesign(e.target.value)}
              placeholder={`Describe the software you want to test...

Example: Build a banking API with deposit, withdraw, and balance check functionality`}
              className="w-full h-full bg-surface-900 border border-surface-700 rounded-xl p-4 text-sm text-surface-200 placeholder-surface-600 resize-none focus:outline-none focus:border-accent-500/50 font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {actionButtons.map(b => (
              <Button key={b.label} variant={b.variant} loading={b.loading} onClick={b.onClick} disabled={!design.trim()}>
                {b.label}
              </Button>
            ))}
            {reportText && (
              <Button variant="secondary" onClick={handleDownloadReport}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download Report
              </Button>
            )}
          </div>

          {error && (
            <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-1 bg-surface-900 rounded-lg p-1 self-start">
            {tabs.filter(t => !t.disabled).length > 0 ? tabs.filter(t => !t.disabled).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.id ? 'bg-surface-800 text-surface-200' : 'text-surface-500 hover:text-surface-300'
                }`}
              >
                {tab.label}
              </button>
            )) : (
              <span className="px-3 py-1.5 text-xs text-surface-600">Generate code to see results</span>
            )}
          </div>

          <div className="flex-1 min-h-0 rounded-xl border border-surface-800 overflow-hidden bg-surface-950">
            {activeTab === 'code' && generatedCode && (
              <Editor
                height="100%"
                defaultLanguage={generatedCode.language === 'react' ? 'javascript' : generatedCode.language}
                value={generatedCode.code}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 12 } }}
              />
            )}
            {activeTab === 'tests' && testResults && (
              <div className="p-4 overflow-y-auto h-full space-y-4">
                {['functional', 'edge_cases', 'security'].map(cat => (
                  <div key={cat}>
                    <h4 className="text-xs font-semibold text-accent-400 uppercase tracking-wider mb-2">{cat.replace('_', ' ')}</h4>
                    <div className="space-y-1.5">
                      {testResults[cat]?.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-surface-300 bg-surface-900/50 rounded-lg px-3 py-2">
                          <span className="text-accent-500 mt-0.5">•</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {generatedCode?.gtest_code && (
                  <div>
                    <h4 className="text-xs font-semibold text-accent-400 uppercase tracking-wider mb-2">Google Test</h4>
                    <div className="h-48 rounded-lg overflow-hidden border border-surface-800">
                      <Editor height="100%" defaultLanguage="cpp" value={generatedCode.gtest_code} theme="vs-dark" options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'execution' && executionResults && (
              <div className="p-4 overflow-y-auto h-full space-y-4">
                <div className="flex gap-4">
                  {[
                    { label: 'Total', value: executionResults.summary.total, color: 'text-surface-200' },
                    { label: 'Passed', value: executionResults.summary.passed, color: 'text-accent-400' },
                    { label: 'Failed', value: executionResults.summary.failed, color: 'text-red-400' },
                    { label: 'Rate', value: `${successRate(executionResults.summary.passed, executionResults.summary.total)}%`, color: 'text-accent-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-surface-900 rounded-lg px-4 py-3 flex-1 text-center">
                      <p className="text-xs text-surface-500 uppercase tracking-wider">{s.label}</p>
                      <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {['functional', 'edge_cases', 'security'].map(cat => (
                  executionResults[cat]?.length > 0 && (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold text-accent-400 uppercase tracking-wider mb-2">{cat.replace('_', ' ')}</h4>
                      <div className="space-y-1">
                        {executionResults[cat].map((t, i) => (
                          <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                            t.status === 'PASS' ? 'bg-accent-600/5 text-accent-300' : 'bg-red-600/5 text-red-300'
                          }`}>
                            <Badge variant={t.status === 'PASS' ? 'success' : 'danger'}>{t.status}</Badge>
                            <span className="flex-1">{t.test_case}</span>
                            <span className="text-xs text-surface-500">{t.remarks}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            {activeTab === 'crash' && crashReport && (
              <div className="p-4 overflow-y-auto h-full space-y-4">
                {crashResult && (
                  <div className="flex items-center gap-4">
                    <Badge variant={crashResult.crashed ? 'danger' : 'success'}>
                      {crashResult.crashed ? `CRASHED (signal ${crashResult.signal})` : 'OK'}
                    </Badge>
                    {crashResult.crashed === false && crashResult.stdout && (
                      <span className="text-xs text-surface-500">Output: {crashResult.stdout.slice(0, 80)}</span>
                    )}
                  </div>
                )}
                {crashResult?.backtrace?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Backtrace</h4>
                    <div className="bg-surface-900 rounded-lg p-3 font-mono text-xs space-y-1">
                      {crashResult.backtrace.map((f, i) => (
                        <div key={i} className="text-surface-300">
                          <span className="text-accent-500">#{f.frame}</span>{' '}
                          <span>{f.function}</span>
                          {f.file && <span className="text-surface-600"> at {f.file}:{f.line}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-3">
                  {[
                    { label: 'Crash Location', value: crashReport.crash_location, mono: true },
                    { label: 'Root Cause', value: crashReport.root_cause },
                    { label: 'Severity', value: crashReport.severity, badge: crashReport.severity === 'critical' ? 'danger' : 'warning' },
                    { label: 'Suggested Fix', value: crashReport.suggested_fix },
                  ].map(f => (
                    <div key={f.label} className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-surface-500 uppercase tracking-wider mb-1">{f.label}</p>
                      {f.badge ? (
                        <Badge variant={f.badge}>{f.value}</Badge>
                      ) : (
                        <p className={`text-sm ${f.mono ? 'font-mono text-accent-400' : 'text-surface-200'}`}>{f.value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'report' && reportText && (
              <div className="p-4 overflow-y-auto h-full">
                <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap">{reportText}</pre>
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            <div className="flex gap-1 mb-1">
              {bottomTabs.map(t => (
                <button key={t.id} onClick={() => setActiveBottomTab(t.id)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    activeBottomTab === t.id ? 'bg-surface-800 text-surface-300' : 'text-surface-600 hover:text-surface-400'
                  }`}
                >{t.label}</button>
              ))}
            </div>
            <div className="bg-surface-950 border border-surface-800 rounded-lg h-24 overflow-y-auto p-3">
              {activeBottomTab === 'timeline' ? (
                timeline.length === 0 ? (
                  <p className="text-xs text-surface-600">No timeline entries yet</p>
                ) : (
                  <div className="relative space-y-1">
                    {timeline.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.status === 'completed' ? 'bg-accent-500' : 'bg-surface-600'}`} />
                        <span className="text-surface-400 w-20 flex-shrink-0">{e.timestamp ? formatDate(e.timestamp) : ''}</span>
                        <span className={`${e.status === 'completed' ? 'text-surface-200' : 'text-surface-500'}`}>{e.step}</span>
                        {e.duration && <span className="text-surface-600">{e.duration}</span>}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                logs.length === 0 ? (
                  <p className="text-xs text-surface-600">No log entries</p>
                ) : (
                  <div className="space-y-0.5 font-mono text-xs">
                    {logs.map((l, i) => (
                      <div key={i} className={`${
                        l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-accent-400' : 'text-surface-400'
                      }`}>
                        <span className="text-surface-600">[{l.time}]</span> {l.msg}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {projectStats && (
          <div className="w-64 flex-shrink-0 border-l border-surface-800 p-4 overflow-y-auto space-y-4">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Project Stats</h3>
            {[
              { label: 'Name', value: projectStats.project_name },
              { label: 'Language', value: projectStats.language || 'auto' },
              { label: 'Status', value: statusLabel(projectStats.status) },
              { label: 'Generated', value: formatDate(projectStats.created_at) },
              { label: 'Updated', value: formatDate(projectStats.updated_at) },
              { label: 'Generation', value: formatDuration(projectStats.generation_time) },
              { label: 'Compilation', value: formatDuration(projectStats.compilation_time) },
              { label: 'Execution', value: formatDuration(projectStats.execution_time) },
              { label: 'Report Gen', value: formatDuration(projectStats.report_generation_time) },
              { label: 'Tests', value: projectStats.generated_tests },
              { label: 'Passed', value: projectStats.passed },
              { label: 'Failed', value: projectStats.failed },
              { label: 'Pass Rate', value: `${projectStats.success_rate || 0}%` },
            ].map(s => (
              <div key={s.label} className="flex justify-between items-center">
                <span className="text-xs text-surface-500">{s.label}</span>
                <span className="text-xs text-surface-200 font-medium">{s.value}</span>
              </div>
            ))}
            {projectFiles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 mt-4">Files</h4>
                <div className="space-y-1">
                  {projectFiles.map(f => (
                    <div key={f.name} className="flex justify-between items-center text-xs">
                      <span className="text-surface-400 truncate">{f.name}</span>
                      <span className="text-surface-600">{(f.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
