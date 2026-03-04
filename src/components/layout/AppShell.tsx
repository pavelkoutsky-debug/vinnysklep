import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  const { isAdmin } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar isAdmin={isAdmin} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="container mx-auto p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <div className="lg:hidden">
          <MobileNav isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  )
}
