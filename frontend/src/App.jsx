import { useRef } from 'react'
import ResultsPanel from './components/ResultsPanel'
import useAppState from './useAppState'
import './App.css'

function App() {
  const textareaRef = useRef(null)
  const state = useAppState()

  const {
    isGenerating, designDescription, setDesignDescription,
    generatedCode, testResults, executionResults, reportText,
    codeError, testError, execError, reportError, phase,
    isDownloading, handleGenerate, handleDownloadReport,
    crashResult, crashReport, crashError, isCrashAnalyzing,
    handleCrashAnalysis,
  } = state

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!designDescription.trim() || isGenerating) return
    handleGenerate(designDescription)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="header-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      <div className="app-centered">
        <main className="app-main">
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
            designDescription={designDescription}
            isDownloading={isDownloading}
            onDownloadReport={handleDownloadReport}
            crashResult={crashResult}
            crashReport={crashReport}
            crashError={crashError}
            isCrashAnalyzing={isCrashAnalyzing}
          />
        </main>

        <footer className="app-footer">
          <form className="prompt-form" onSubmit={handleSubmit}>
            <div className="prompt-input-wrapper">
              <textarea
                ref={textareaRef}
                className="prompt-textarea"
                placeholder="Describe the design or feature you want to test..."
                rows={1}
                value={designDescription}
                onChange={(e) => setDesignDescription(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="submit"
                className="prompt-btn"
                disabled={isGenerating || !designDescription.trim()}
              >
                {isGenerating ? (
                  <span className="prompt-btn-loading">
                    <span className="spinner-sm" />
                  </span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="prompt-hint">Press Enter to send, Shift+Enter for a new line</p>
          </form>
          <button
            className="crash-btn"
            onClick={() => handleCrashAnalysis()}
            disabled={isCrashAnalyzing}
          >
            {isCrashAnalyzing ? (
              <span className="prompt-btn-loading">
                <span className="spinner-sm" />
                <span>Analyzing...</span>
              </span>
            ) : (
              'Run Crash Analysis'
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default App
