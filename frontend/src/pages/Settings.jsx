import { useState } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'

export default function Settings() {
  const { settings, saveSettings } = useWorkspace()
  const [defaultLanguage, setDefaultLanguage] = useState(settings.default_language || 'react')
  const [preferredModel, setPreferredModel] = useState(settings.preferred_model || 'gpt-4')
  const [autoSave, setAutoSave] = useState(settings.auto_save !== false)
  const [crashAnalysis, setCrashAnalysis] = useState(settings.crash_analysis !== false)
  const [darkTheme, setDarkTheme] = useState(settings.dark_theme !== false)
  const [reportFormat, setReportFormat] = useState(settings.report_format || 'detailed')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    saveSettings({
      default_language: defaultLanguage,
      preferred_model: preferredModel,
      auto_save: autoSave,
      crash_analysis: crashAnalysis,
      dark_theme: darkTheme,
      report_format: reportFormat,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-100">Settings</h1>
          <p className="text-sm text-surface-500 mt-1">Configure your AI Testing Studio preferences</p>
        </div>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Workspace Defaults</h3>
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Default Language</label>
            <select value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value)}
              className="w-full max-w-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500/50"
            >
              <option value="react">React</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Preferred Model</label>
            <select value={preferredModel} onChange={e => setPreferredModel(e.target.value)}
              className="w-full max-w-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500/50"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
              <option value="local">Local (Ollama)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Features</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-surface-200">Auto-save Workspace</span>
              <p className="text-xs text-surface-500">Automatically save workspace state on changes</p>
            </div>
            <button
              onClick={() => setAutoSave(!autoSave)}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoSave ? 'bg-accent-500' : 'bg-surface-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoSave ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-surface-200">Crash Analysis</span>
              <p className="text-xs text-surface-500">Enable automatic crash log analysis</p>
            </div>
            <button
              onClick={() => setCrashAnalysis(!crashAnalysis)}
              className={`relative w-10 h-5 rounded-full transition-colors ${crashAnalysis ? 'bg-accent-500' : 'bg-surface-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${crashAnalysis ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-surface-200">Dark Theme</span>
              <p className="text-xs text-surface-500">Use dark theme across the application</p>
            </div>
            <button
              onClick={() => setDarkTheme(!darkTheme)}
              className={`relative w-10 h-5 rounded-full transition-colors ${darkTheme ? 'bg-accent-500' : 'bg-surface-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${darkTheme ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-4">Report Preferences</h3>
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">Report Format</label>
          <select value={reportFormat} onChange={e => setReportFormat(e.target.value)}
            className="w-full max-w-xs bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500/50"
          >
            <option value="detailed">Detailed</option>
            <option value="summary">Summary</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="primary" onClick={handleSave}>
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
        {saved && <span className="text-xs text-accent-400">Preferences saved to local storage</span>}
      </div>
    </div>
  )
}
