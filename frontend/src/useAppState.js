import { useState } from 'react'

function useAppState() {
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

  return {
    isGenerating, setIsGenerating,
    generatedCode, setGeneratedCode,
    testResults, setTestResults,
    executionResults, setExecutionResults,
    reportText, setReportText,
    codeError, setCodeError,
    testError, setTestError,
    execError, setExecError,
    reportError, setReportError,
    phase, setPhase,
    designDescription, setDesignDescription,
    isDownloading, setIsDownloading,
    handleGenerate,
    handleDownloadReport,
  }
}

export default useAppState
