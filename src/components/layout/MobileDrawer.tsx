import { useNavigate } from 'react-router-dom'
import { History, FileText, Mail, Settings, LogOut, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  isAdmin: boolean
}

const drawerItems = [
  { to: '/history', label: 'Historie', icon: History },
  { to: '/reports', label: 'Reporty', icon: FileText },
  { to: '/messages', label: 'Zprávy', icon: Mail },
  { to: '/settings', label: 'Nastavení', icon: Settings },
]

export function MobileDrawer({ open, onClose, isAdmin }: MobileDrawerProps) {
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()

  const handleNav = (to: string) => {
    navigate(to)
    onClose()
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch {
      toast.error('Nepodařilo se odhlásit')
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-card pb-safe-bottom shadow-xl animate-in slide-in-from-bottom">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-12 rounded-full bg-muted" />
        </div>

        {/* User info */}
        <div className="flex items-center justify-between px-6 py-3 border-b">
          <div>
            <p className="text-sm font-medium">{profile?.full_name ?? 'Uživatel'}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
            {isAdmin && (
              <span className="text-xs font-medium text-primary">Admin</span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav items */}
        <nav className="px-4 py-3 space-y-1">
          {drawerItems.map(item => (
            <button
              key={item.to}
              onClick={() => handleNav(item.to)}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              {item.label}
            </button>
          ))}

          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Odhlásit
          </button>
        </nav>

        <div className="h-4" />
      </div>
    </>
  )
}
