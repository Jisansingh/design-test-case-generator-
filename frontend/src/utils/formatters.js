export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDuration(sec) {
  if (!sec) return '—'
  const n = parseFloat(sec)
  if (n < 1) return `${(n * 1000).toFixed(0)} ms`
  return `${n.toFixed(2)} s`
}

export function successRate(passed, total) {
  if (!total) return 0
  return Math.round((passed / total) * 100)
}

export function statusColor(status) {
  const map = {
    created: 'text-surface-400',
    code_generated: 'text-accent-400',
    tests_generated: 'text-accent-400',
    tests_executed: 'text-accent-400',
    report_generated: 'text-accent-400',
    report_deleted: 'text-red-400',
    crashed: 'text-red-400',
    ok: 'text-accent-400',
    completed: 'text-accent-400',
  }
  return map[status] || 'text-surface-400'
}

export function statusLabel(status) {
  const map = {
    created: 'Created',
    code_generated: 'Code Generated',
    tests_generated: 'Tests Generated',
    tests_executed: 'Tests Executed',
    report_generated: 'Report Generated',
    report_deleted: 'Report Deleted',
    crashed: 'Crashed',
    ok: 'OK',
    completed: 'Completed',
  }
  return map[status] || status || 'Unknown'
}

export function languageColor(lang) {
  const map = {
    cpp: 'text-blue-400', c: 'text-blue-400',
    python: 'text-yellow-400',
    javascript: 'text-yellow-400', js: 'text-yellow-400',
    react: 'text-cyan-400', jsx: 'text-cyan-400',
    java: 'text-orange-400',
  }
  return map[lang] || 'text-surface-400'
}
