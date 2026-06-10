import { useState } from 'react'

const LANG_RULES = [
  { keyword: 'c\\+\\+', lang: 'cpp' },
  { keyword: 'cpp', lang: 'cpp' },
  { keyword: 'c', lang: 'c' },
  { keyword: 'python', lang: 'python' },
  { keyword: 'react', lang: 'react' },
  { keyword: 'javascript', lang: 'javascript' },
  { keyword: 'js', lang: 'javascript' },
]

const LANG_PREFIXES = [
  '\\bwritten\\s+in\\s+',
  '\\busing\\s+',
  '\\bwith\\s+',
  '\\bin\\s+',
]

function parsePrompt(text) {
  for (const { keyword, lang } of LANG_RULES) {
    for (const prefix of LANG_PREFIXES) {
      const re = new RegExp(prefix + keyword + '(?!\\w)', 'i')
      if (re.test(text)) {
        const design = text.replace(re, '').replace(/\s+/g, ' ').trim()
        return { design, language: lang }
      }
    }
  }
  return { design: text, language: null }
}

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
  const [crashResult, setCrashResult] = useState(null)
  const [crashReport, setCrashReport] = useState(null)
  const [crashError, setCrashError] = useState(null)
  const [isCrashAnalyzing, setIsCrashAnalyzing] = useState(false)

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

    const { design, language } = parsePrompt(desc)

    setPhase('generating-code')
    try {
      const body = language ? { design, language } : { design }
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleCrashAnalysis = async () => {
    if (!generatedCode || !generatedCode.code) {
      setCrashError("No generated code to analyze. Please generate code first.")
      return
    }
    setIsCrashAnalyzing(true)
    setCrashResult(null)
    setCrashReport(null)
    setCrashError(null)
    try {
      const simRes = await fetch('/api/analyze-user-crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: generatedCode.code,
          language: generatedCode.language,
        }),
      })
      if (!simRes.ok) {
        const errData = await simRes.json().catch(() => null)
        throw new Error(errData?.detail || `Crash analysis failed with status ${simRes.status}`)
      }
      const simData = await simRes.json()
      setCrashResult(simData)

      const backtraceFrames = simData.backtrace || []
      const backtraceStrings = backtraceFrames.map((f) => `#${f.frame} ${f.function}`)
      const reportRes = await fetch('/api/analyze-crash-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backtrace: backtraceStrings,
          code: generatedCode.code,
          signal: simData.signal,
          stderr: simData.stderr,
          backtrace_frames: backtraceFrames,
        }),
      })
      if (!reportRes.ok) {
        const errData = await reportRes.json().catch(() => null)
        throw new Error(errData?.detail || `Crash report generation failed with status ${reportRes.status}`)
      }
      const reportData = await reportRes.json()
      setCrashReport(reportData)
    } catch (err) {
      setCrashError(err.message)
    } finally {
      setIsCrashAnalyzing(false)
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
    crashResult, setCrashResult,
    crashReport, setCrashReport,
    crashError, setCrashError,
    isCrashAnalyzing, setIsCrashAnalyzing,
    handleGenerate,
    handleDownloadReport,
    handleCrashAnalysis,
  }
}

export default useAppState
