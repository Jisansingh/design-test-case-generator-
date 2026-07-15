import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjects, getReports } from '../api'
import { Card, CardHeader } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Spinner } from '../components/common/Spinner'
import { Button } from '../components/common/Button'
import { formatDate, statusLabel } from '../utils/formatters'

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, tests: 0, passed: 0, reports: 0 })

  useEffect(() => {
    Promise.all([getProjects(), getReports()]).then(([pRes, rRes]) => {
      const pList = pRes.success ? (pRes.data || []) : []
      const rList = rRes.success ? (rRes.data || []) : []
      setProjects(pList)
      setReports(rList)
      setStats({
        total: pList.length,
        tests: pList.reduce((s, p) => s + (p.generated_tests || 0), 0),
        passed: pList.reduce((s, p) => s + (p.passed || 0), 0),
        reports: rList.length,
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>

  const recentProjects = projects.slice(-4).reverse()
  const recentReports = reports.slice(-4).reverse()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-surface-100">Welcome to AI Testing Studio</h1>
        <p className="text-sm text-surface-500 mt-1">Generate, execute, and analyze software tests with AI.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Projects', value: stats.total, color: 'text-accent-400' },
          { label: 'Tests Generated', value: stats.tests, color: 'text-blue-400' },
          { label: 'Tests Passed', value: stats.passed, color: 'text-green-400' },
          { label: 'Reports', value: stats.reports, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold">{s.label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Recent Projects" action={
            <Button variant="ghost" size="xs" onClick={() => navigate('/projects')}>View All</Button>
          } />
          {recentProjects.length === 0 ? (
            <p className="text-sm text-surface-600 py-4 text-center">No projects yet</p>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((p, i) => (
                <div key={p.project_name || p.created_at || i} onClick={() => navigate(`/projects/${encodeURIComponent(p.project_name)}`)} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-900/50 hover:bg-surface-800 cursor-pointer transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">{p.project_name}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{formatDate(p.created_at)}</p>
                  </div>
                  <Badge variant={p.status === 'report_generated' ? 'success' : 'default'}>{statusLabel(p.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Reports" action={
            <Button variant="ghost" size="xs" onClick={() => navigate('/reports')}>View All</Button>
          } />
          {recentReports.length === 0 ? (
            <p className="text-sm text-surface-600 py-4 text-center">No reports yet</p>
          ) : (
            <div className="space-y-2">
              {recentReports.map((r, i) => (
                <div key={r.project_name || i} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-900/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-200 truncate">{r.project_name}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{formatDate(r.generated_at)}</p>
                  </div>
                  <Badge variant="success">Report</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
