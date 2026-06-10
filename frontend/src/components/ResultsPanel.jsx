import { useState, useCallback } from 'react'
import './ResultsPanel.css'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }, [text])
  return (
    <button className="copy-btn" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function TestCategory({ title, tests, executed }) {
  if (!tests || tests.length === 0) return null

  return (
    <div className="test-category">
      <h3 className="test-category-title">{title}</h3>
      <ul className="test-list">
        {tests.map((item, index) => {
          const description = executed ? item.test_case : item
          const status = executed ? item.status : null
          return (
            <li
              key={index}
              className={`test-item${status ? ' test-item--' + status.toLowerCase() : ''}`}
            >
              {status && <span className="test-status">{status}</span>}
              <span>{description}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ExecutionSummary({ summary }) {
  if (!summary) return null
  const passedPct = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0

  return (
    <div className="exec-summary">
      <div className="exec-summary-stat">
        <span className="exec-summary-label">Total</span>
        <span className="exec-summary-value">{summary.total}</span>
      </div>
      <div className="exec-summary-divider" />
      <div className="exec-summary-stat">
        <span className="exec-summary-label">Passed</span>
        <span className="exec-summary-value exec-summary-value--pass">{summary.passed}</span>
      </div>
      <div className="exec-summary-divider" />
      <div className="exec-summary-stat">
        <span className="exec-summary-label">Failed</span>
        <span className="exec-summary-value exec-summary-value--fail">{summary.failed}</span>
      </div>
      <div className="exec-summary-bar">
        <div className="exec-summary-bar-fill" style={{ width: passedPct + '%' }} />
      </div>
    </div>
  )
}

function PipelineSteps({ generatedCode, testResults, executionResults, reportText }) {
  const steps = [
    { key: 'code', label: 'Code', done: !!generatedCode },
    { key: 'tests', label: 'Tests', done: !!testResults },
    { key: 'execute', label: 'Execute', done: !!executionResults },
    { key: 'report', label: 'Report', done: !!reportText },
  ]

  return (
    <div className="pipeline">
      {steps.map((step, i) => (
        <span key={step.key} className={`pipeline-step${step.done ? ' pipeline-step--done' : ''}`}>
          <span className="pipeline-step-icon">
            {step.done ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span className="pipeline-step-dot" />
            )}
          </span>
          <span className="pipeline-step-label">{step.label}</span>
          {i < steps.length - 1 && <span className="pipeline-connector" />}
        </span>
      ))}
    </div>
  )
}

function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? ' tab-btn--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function cleanCode(code) {
  if (!code) return ''
  return code
    .replace(/^```\w*\s*\n/gm, '')
    .replace(/\n```\s*$/gm, '')
    .trim()
}

function cleanReport(report) {
  if (!report) return ''
  return report
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (/^[=\-]{5,}$/.test(t)) return false
      if (/END OF REPORT/i.test(t)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ResultsPanel({
  generatedCode,
  testResults,
  executionResults,
  reportText,
  codeError,
  testError,
  execError,
  reportError,
  phase,
  designDescription,
  isDownloading,
  onDownloadReport,
}) {
  const [activeTab, setActiveTab] = useState('code')

  const tabs = []
  if (generatedCode) {
    tabs.push({ id: 'code', label: 'Code' })
    if (generatedCode.language === 'cpp' && generatedCode.gtest_code) {
      tabs.push({ id: 'gtest', label: 'GTest' })
    }
  }
  if (executionResults) tabs.push({ id: 'tests', label: 'Tests' })
  if (reportText) tabs.push({ id: 'report', label: 'Report' })

  if (tabs.length > 0 && !tabs.find((t) => t.id === activeTab)) {
    setActiveTab(tabs[0].id)
  }

  if (phase === 'generating-code') {
    return (
      <section className="results-area">
        <div className="loading-state">
          <span className="spinner-lg" />
          <h2 className="loading-title">Generating Code...</h2>
          <p className="loading-text">The AI is generating code based on your design description.</p>
        </div>
      </section>
    )
  }

  if (phase === 'generating-tests') {
    return (
      <section className="results-area">
        <div className="results-scroll">
          <div className="code-card">
            <div className="code-card-header">
              <span className="code-card-dot" style={{ backgroundColor: '#22c55e' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#eab308' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#ef4444' }} />
              <span className="code-card-label">generated-code.jsx</span>
            </div>
            <pre className="code-card-content">{cleanCode(generatedCode.code)}</pre>
          </div>
          <div className="loading-inline">
            <span className="spinner-sm" />
            <span>Generating test cases for the code...</span>
          </div>
        </div>
      </section>
    )
  }

  if (phase === 'executing-tests') {
    return (
      <section className="results-area">
        <div className="results-scroll">
          <div className="code-card">
            <div className="code-card-header">
              <span className="code-card-dot" style={{ backgroundColor: '#22c55e' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#eab308' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#ef4444' }} />
              <span className="code-card-label">generated-code.jsx</span>
            </div>
            <pre className="code-card-content">{cleanCode(generatedCode.code)}</pre>
          </div>
          <div className="tests-section">
            <h2 className="section-title">Generated Tests</h2>
            <TestCategory title="Functional Tests" tests={testResults.functional} />
            <TestCategory title="Edge Cases" tests={testResults.edge_cases} />
            <TestCategory title="Security Tests" tests={testResults.security} />
          </div>
          <div className="loading-inline">
            <span className="spinner-sm" />
            <span>Executing test cases...</span>
          </div>
        </div>
      </section>
    )
  }

  if (phase === 'generating-report') {
    return (
      <section className="results-area">
        <div className="results-scroll">
          <div className="code-card">
            <div className="code-card-header">
              <span className="code-card-dot" style={{ backgroundColor: '#22c55e' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#eab308' }} />
              <span className="code-card-dot" style={{ backgroundColor: '#ef4444' }} />
              <span className="code-card-label">generated-code.jsx</span>
            </div>
            <pre className="code-card-content">{cleanCode(generatedCode.code)}</pre>
          </div>
          <ExecutionSummary summary={executionResults.summary} />
          <div className="tests-section">
            <h2 className="section-title">Test Results</h2>
            <TestCategory title="Functional Tests" tests={executionResults.functional} executed />
            <TestCategory title="Edge Cases" tests={executionResults.edge_cases} executed />
            <TestCategory title="Security Tests" tests={executionResults.security} executed />
          </div>
          <div className="loading-inline">
            <span className="spinner-sm" />
            <span>Generating report...</span>
          </div>
        </div>
      </section>
    )
  }

  if (codeError && !generatedCode) {
    return (
      <section className="results-area">
        <div className="error-state">
          <div className="error-icon-large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="error-state-title">Code Generation Failed</h2>
          <p className="error-state-text">{codeError}</p>
        </div>
      </section>
    )
  }

  if (tabs.length > 0) {
    return (
      <section className="results-area">
        <PipelineSteps
          generatedCode={generatedCode}
          testResults={testResults}
          executionResults={executionResults}
          reportText={reportText}
        />

        <div className="prompt-card">
          <span className="prompt-card-label">Prompt</span>
          <p className="prompt-card-text">{designDescription}</p>
        </div>

        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'code' && (
          <div className="tab-pane">
            <div className="code-card code-card--full">
              <div className="code-card-header">
                <span className="code-card-dot" style={{ backgroundColor: '#22c55e' }} />
                <span className="code-card-dot" style={{ backgroundColor: '#eab308' }} />
                <span className="code-card-dot" style={{ backgroundColor: '#ef4444' }} />
                <span className="code-card-label">generated-code</span>
                <span style={{ flex: 1 }} />
                <CopyButton text={cleanCode(generatedCode.code)} />
              </div>
              <pre className="code-card-content">{cleanCode(generatedCode.code)}</pre>
            </div>
          </div>
        )}

        {activeTab === 'gtest' && (
          <div className="tab-pane">
            <div className="code-card code-card--full">
              <div className="code-card-header">
                <span className="code-card-dot" style={{ backgroundColor: '#22c55e' }} />
                <span className="code-card-dot" style={{ backgroundColor: '#eab308' }} />
                <span className="code-card-dot" style={{ backgroundColor: '#ef4444' }} />
                <span className="code-card-label">gtest-code</span>
                <span style={{ flex: 1 }} />
                <CopyButton text={cleanCode(generatedCode.gtest_code)} />
              </div>
              <pre className="code-card-content">{cleanCode(generatedCode.gtest_code)}</pre>
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="results-scroll">
            <ExecutionSummary summary={executionResults.summary} />

            {testError && (
              <div className="error-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Tests failed: {testError}</span>
              </div>
            )}

            {execError && (
              <div className="error-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Execution failed: {execError}</span>
              </div>
            )}

            <div className="tests-section">
              <TestCategory title="Functional Tests" tests={executionResults.functional} executed />
              <TestCategory title="Edge Cases" tests={executionResults.edge_cases} executed />
              <TestCategory title="Security Tests" tests={executionResults.security} executed />
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="tab-pane">
            {reportError && (
              <div className="error-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Report failed: {reportError}</span>
              </div>
            )}

            <div className="report-card report-card--full">
              <pre className="report-content">{cleanReport(reportText)}</pre>
            </div>

            <button
              className="download-btn"
              disabled={isDownloading}
              onClick={onDownloadReport}
            >
              {isDownloading ? (
                <span className="download-btn-loading">
                  <span className="spinner-sm" />
                  Downloading...
                </span>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Report
                </>
              )}
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="results-area">
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <h2 className="empty-state-title">Generate Code & Tests</h2>
        <p className="empty-state-text">
          Describe your design in the input below and press <strong>Enter</strong> to generate code, tests, and a report.
        </p>
      </div>
    </section>
  )
}

export default ResultsPanel
