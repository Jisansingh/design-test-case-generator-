export function Card({ children, className = '', padding = true, hover = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-900 border border-surface-700/50 rounded-xl ${
        padding ? 'p-5' : ''
      } ${hover ? 'hover:border-surface-600 cursor-pointer transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">{title}</h3>
      {action}
    </div>
  )
}
