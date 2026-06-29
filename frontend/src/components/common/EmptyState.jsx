export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="text-surface-600 mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-surface-400 mb-1.5">{title}</h3>
      {description && <p className="text-sm text-surface-600 max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  )
}
