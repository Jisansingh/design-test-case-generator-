import { createContext, useContext, useState, useCallback } from 'react'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [reports, setReports] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ai-testing-studio-settings')) || {}
    } catch { return {} }
  })

  const saveSettings = useCallback((updates) => {
    setSettings(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('ai-testing-studio-settings', JSON.stringify(next))
      return next
    })
  }, [])

  const value = {
    projects, setProjects,
    reports, setReports,
    currentProject, setCurrentProject,
    settings, saveSettings,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
