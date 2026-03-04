import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wine, PlusCircle, BarChart3, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { MobileDrawer } from './MobileDrawer'

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = [
    { to: isAdmin ? '/admin' : '/', label: 'Domů', icon: LayoutDashboard },
    { to: '/cellar', label: 'Sklep', icon: Wine },
    { to: '/cellar/add', label: 'Přidat', icon: PlusCircle },
    { to: '/statistics', label: 'Statistiky', icon: BarChart3 },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t bg-card shadow-lg">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/' || item.to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Více */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>Více</span>
        </button>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} isAdmin={isAdmin} />
    </>
  )
}
