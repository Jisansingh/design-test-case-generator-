import { useState } from 'react'
import GeneratePanel from './components/GeneratePanel'
import ResultsPanel from './components/ResultsPanel'

function App() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [executionResults, setExecutionResults] = useState(null)
  const [reportText, setReportText] = useState(null)
  const [codeError, setCodeError] = useState(null)
  const [testError, setTestError] = useState(null)
  const [execError, setExecError] = useState(null)
  const [reportError, setReportError] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [designDescription, setDesignDescription] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleGenerate = async (desc) => {
    setDesignDescription(desc)
    setIsGenerating(true)
    setGeneratedCode(null)
    setTestResults(null)
    setExecutionResults(null)
    setReportText(null)
    setCodeError(null)
    setTestError(null)
    setExecError(null)
    setReportError(null)

    setPhase('generating-code')
    try {
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: desc }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Code generation failed with status ${res.status}`)
      }
      setGeneratedCode(await res.json())
    } catch (err) {
      setCodeError(err.message)
      setIsGenerating(false)
      setPhase('done')
      return
    }

    setPhase('generating-tests')
    try {
      const res = await fetch('/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: desc }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Test generation failed with status ${res.status}`)
      }
      setTestResults(await res.json())
    } catch (err) {
      setTestError(err.message)
      setIsGenerating(false)
      setPhase('done')
      return
    }

    setPhase('executing-tests')
    try {
      const res = await fetch('/api/execute-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: desc }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Test execution failed with status ${res.status}`)
      }
      setExecutionResults(await res.json())
    } catch (err) {
      setExecError(err.message)
      setIsGenerating(false)
      setPhase('done')
      return
    }

    setPhase('generating-report')
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: desc }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Report generation failed with status ${res.status}`)
      }
      const data = await res.json()
      setReportText(data.report)
    } catch (err) {
      setReportError(err.message)
    } finally {
      setIsGenerating(false)
      setPhase('done')
    }
  }

  const handleDownloadReport = async () => {
    setIsDownloading(true)
    try {
      const res = await fetch('/api/download-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design: designDescription }),
      })
      if (!res.ok) throw new Error('Download failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'report.txt'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="header-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 7 4" />
              <polyline points="17 4 20 4 20 7" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <polyline points="20 17 20 20 17 20" />
              <polyline points="4 17 4 20 7 20" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
          </span>
          <h1>AI Test Generator</h1>
        </div>
      </header>
      <main className="app-main">
        <GeneratePanel
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />
        <ResultsPanel
          generatedCode={generatedCode}
          testResults={testResults}
          executionResults={executionResults}
          reportText={reportText}
          codeError={codeError}
          testError={testError}
          execError={execError}
          reportError={reportError}
          phase={phase}
          isDownloading={isDownloading}
          onDownloadReport={handleDownloadReport}
        />
      </main>
    </div>
  )
}

export default App
