import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wine, PlusCircle, BarChart3, History,
  FileText, Mail, Settings, Users, BookOpen, Star, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

const userNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cellar', label: 'Můj sklep', icon: Wine },
  { to: '/cellar/add', label: 'Přidat víno', icon: PlusCircle },
  { to: '/statistics', label: 'Statistiky', icon: BarChart3 },
  { to: '/history', label: 'Historie', icon: History },
  { to: '/reports', label: 'Reporty', icon: FileText },
  { to: '/messages', label: 'Zprávy', icon: Mail },
  { to: '/settings', label: 'Nastavení', icon: Settings },
]

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Uživatelé', icon: Users },
  { to: '/admin/catalog', label: 'Katalog vín', icon: BookOpen },
  { to: '/admin/reviews', label: 'Expertní hodnocení', icon: Star },
  { to: '/admin/messages', label: 'Zprávy', icon: Mail },
  { to: '/statistics', label: 'Statistiky', icon: BarChart3 },
  { to: '/settings', label: 'Nastavení', icon: Settings },
]

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : userNav

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch {
      toast.error('Nepodařilo se odhlásit')
    }
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Wine className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Vinný Sklep</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">Admin panel</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/' || item.to === '/admin'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="border-t p-3">
        <div className="mb-2 px-3 py-1">
          <p className="text-sm font-medium truncate">{profile?.full_name ?? 'Uživatel'}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Odhlásit
        </Button>
      </div>
    </div>
  )
}
