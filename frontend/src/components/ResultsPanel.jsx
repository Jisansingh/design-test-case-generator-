import './ResultsPanel.css'

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
  isDownloading,
  onDownloadReport,
}) {
  if (phase === 'generating-code') {
    return (
      <section className="panel panel-right">
        <div className="placeholder">
          <div className="placeholder-icon"><span className="spinner-lg" /></div>
          <h2 className="placeholder-title">Generating Code...</h2>
          <p className="placeholder-text">The AI is writing React code based on your design description.</p>
        </div>
      </section>
    )
  }

  if (phase === 'generating-tests') {
    return (
      <section className="panel panel-right">
        <div className="results-content">
          {generatedCode && (
            <div className="code-section">
              <h2 className="results-section-title">Generated Code</h2>
              <pre className="code-block">{generatedCode.code}</pre>
            </div>
          )}
          <div className="placeholder-inline">
            <span className="spinner-lg" />
            <p className="placeholder-text">Generating test cases for the code...</p>
          </div>
        </div>
      </section>
    )
  }

  if (phase === 'executing-tests') {
    return (
      <section className="panel panel-right">
        <div className="results-content">
          {generatedCode && (
            <div className="code-section">
              <h2 className="results-section-title">Generated Code</h2>
              <pre className="code-block">{generatedCode.code}</pre>
            </div>
          )}
          {testResults && (
            <div className="tests-section">
              <h2 className="results-section-title">Generated Tests</h2>
              <TestCategory title="Functional Tests" tests={testResults.functional} />
              <TestCategory title="Edge Cases" tests={testResults.edge_cases} />
              <TestCategory title="Security Tests" tests={testResults.security} />
            </div>
          )}
          <div className="placeholder-inline">
            <span className="spinner-lg" />
            <p className="placeholder-text">Executing test cases...</p>
          </div>
        </div>
      </section>
    )
  }

  if (phase === 'generating-report') {
    return (
      <section className="panel panel-right">
        <div className="results-content">
          {generatedCode && (
            <div className="code-section">
              <h2 className="results-section-title">Generated Code</h2>
              <pre className="code-block">{generatedCode.code}</pre>
            </div>
          )}
          {testResults && (
            <div className="tests-section">
              <h2 className="results-section-title">Generated Tests</h2>
              <TestCategory title="Functional Tests" tests={testResults.functional} />
              <TestCategory title="Edge Cases" tests={testResults.edge_cases} />
              <TestCategory title="Security Tests" tests={testResults.security} />
            </div>
          )}
          {executionResults && (
            <>
              <h2 className="results-section-title">Execution Results</h2>
              <ExecutionSummary summary={executionResults.summary} />
              <TestCategory title="Functional Tests" tests={executionResults.functional} executed />
              <TestCategory title="Edge Cases" tests={executionResults.edge_cases} executed />
              <TestCategory title="Security Tests" tests={executionResults.security} executed />
            </>
          )}
          <div className="placeholder-inline">
            <span className="spinner-lg" />
            <p className="placeholder-text">Generating report...</p>
          </div>
        </div>
      </section>
    )
  }

  if (codeError) {
    return (
      <section className="panel panel-right">
        <div className="placeholder">
          <div className="placeholder-icon error-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="placeholder-title error-title">Code Generation Failed</h2>
          <p className="placeholder-text error-text">{codeError}</p>
        </div>
      </section>
    )
  }

  if (generatedCode) {
    return (
      <section className="panel panel-right">
        <div className="results-content">
          {generatedCode && (
            <div className="code-section">
              <h2 className="results-section-title">Generated Code</h2>
              <pre className="code-block">{generatedCode.code}</pre>
            </div>
          )}

          {testError && (
            <div className="error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Tests failed: {testError}</span>
            </div>
          )}

          {testResults && !executionResults && (
            <div className="tests-section">
              <h2 className="results-section-title">Generated Tests</h2>
              <TestCategory title="Functional Tests" tests={testResults.functional} />
              <TestCategory title="Edge Cases" tests={testResults.edge_cases} />
              <TestCategory title="Security Tests" tests={testResults.security} />
            </div>
          )}

          {execError && (
            <div className="error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Execution failed: {execError}</span>
            </div>
          )}

          {executionResults && (
            <>
              <h2 className="results-section-title">Execution Results</h2>
              <ExecutionSummary summary={executionResults.summary} />
              <TestCategory title="Functional Tests" tests={executionResults.functional} executed />
              <TestCategory title="Edge Cases" tests={executionResults.edge_cases} executed />
              <TestCategory title="Security Tests" tests={executionResults.security} executed />
            </>
          )}

          {reportError && (
            <div className="error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Report failed: {reportError}</span>
            </div>
          )}

          {reportText && (
            <div className="report-section">
              <h2 className="results-section-title">Generated Report</h2>
              <pre className="report-block">{reportText}</pre>
            </div>
          )}

          <div className="results-footer">
            <button
              className="btn btn-secondary"
              disabled={!reportText || isDownloading}
              onClick={onDownloadReport}
            >
              {isDownloading ? (
                <span className="btn-loading">
                  <span className="spinner" />
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
            {!reportText && <p className="results-hint">Report will be available once generated</p>}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel panel-right">
      <div className="placeholder">
        <div className="placeholder-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="9 2 9 8 15 8" />
            <line x1="12" y1="12" x2="12" y2="18" />
            <circle cx="12" cy="12" r="2" />
            <path d="M9 18h6" />
          </svg>
        </div>
        <h2 className="placeholder-title">No Test Cases Yet</h2>
        <p className="placeholder-text">
          Describe your design in the left panel and click <strong>Generate &amp; Run Tests</strong> to get started.
        </p>
      </div>
    </section>
  )
}

export default ResultsPanel
