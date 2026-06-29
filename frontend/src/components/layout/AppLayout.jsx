import { Sidebar } from './Sidebar'

export function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-surface-950 text-surface-200">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
