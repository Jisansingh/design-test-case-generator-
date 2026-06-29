export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-surface-800 text-surface-300',
    success: 'bg-accent-600/10 text-accent-400 border border-accent-600/20',
    danger: 'bg-red-600/10 text-red-400 border border-red-600/20',
    warning: 'bg-yellow-600/10 text-yellow-400 border border-yellow-600/20',
    info: 'bg-blue-600/10 text-blue-400 border border-blue-600/20',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
