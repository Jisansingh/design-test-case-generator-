import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export async function generateCode(design, language = null, projectName = null) {
  const body = { design }
  if (language) body.language = language
  if (projectName) body.project_name = projectName
  const { data } = await api.post('/generate-code', body)
  return data
}

export async function generateTests(design, projectName = null) {
  const body = { design }
  if (projectName) body.project_name = projectName
  const { data } = await api.post('/generate-tests', body)
  return data
}

export async function executeTests(design, projectName = null) {
  const body = { design }
  if (projectName) body.project_name = projectName
  const { data } = await api.post('/execute-tests', body)
  return data
}

export async function generateReport(design, projectName = null) {
  const body = { design }
  if (projectName) body.project_name = projectName
  const { data } = await api.post('/generate-report', body)
  return data
}

export async function downloadReport(design, projectName = null) {
  const body = { design }
  if (projectName) body.project_name = projectName
  const response = await api.post('/download-report', body, { responseType: 'blob' })
  return response.data
}

export async function analyzeCrash() {
  const { data } = await api.post('/analyze-crash')
  return data
}

export async function analyzeUserCrash(code, language, projectName = null) {
  const body = { code, language }
  if (projectName) body.project_name = projectName
  const { data } = await api.post('/analyze-user-crash', body)
  return data
}

export async function analyzeCrashReport(backtrace, options = {}) {
  const body = { backtrace, ...options }
  const { data } = await api.post('/analyze-crash-report', body)
  return data
}

export async function getProjects() {
  const { data } = await api.get('/projects')
  return data
}

export async function getProject(name) {
  const { data } = await api.get(`/projects/${encodeURIComponent(name)}`)
  return data
}

export async function deleteProject(name) {
  const { data } = await api.delete(`/projects/${encodeURIComponent(name)}`)
  return data
}

export async function getProjectFiles(name) {
  const { data } = await api.get(`/projects/${encodeURIComponent(name)}/files`)
  return data
}

export async function getProjectTimeline(name) {
  const { data } = await api.get(`/projects/${encodeURIComponent(name)}/timeline`)
  return data
}

export async function getReports() {
  const { data } = await api.get('/reports')
  return data
}

export async function getReport(name) {
  const { data } = await api.get(`/reports/${encodeURIComponent(name)}`)
  return data
}

export async function deleteReport(name) {
  const { data } = await api.delete(`/reports/${encodeURIComponent(name)}`)
  return data
}

export default api
