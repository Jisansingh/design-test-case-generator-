import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { AppLayout } from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Workspace from './pages/Workspace'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Reports from './pages/Reports'
import Repositories from './pages/Repositories'
import RepositoryExplorer from './pages/RepositoryExplorer'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <AppLayout>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="workspace" element={<Workspace />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:name" element={<ProjectDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="repositories" element={<Repositories />} />
            <Route path="repositories/:id/explore" element={<RepositoryExplorer />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </AppLayout>
      </WorkspaceProvider>
    </BrowserRouter>
  )
}
