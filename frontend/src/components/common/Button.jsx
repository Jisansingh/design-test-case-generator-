export function Button({ children, variant = 'primary', size = 'sm', disabled, onClick, className = '', loading }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent-500/30 disabled:opacity-40 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-accent-600 hover:bg-accent-500 text-white shadow-sm',
    secondary: 'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700',
    ghost: 'bg-transparent hover:bg-surface-800 text-surface-300',
    danger: 'bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20',
  }

  const sizes = {
    xs: 'px-2.5 py-1 text-xs',
    sm: 'px-3.5 py-1.5 text-sm',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
