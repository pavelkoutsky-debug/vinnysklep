import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { Profile } from '@/types/database'
import { Users, ChevronRight, Crown } from 'lucide-react'

interface UserWithStats extends Profile {
  bottle_count?: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (!profiles) return

      // Načíst počet lahví pro každého
      const { data: cellarData } = await supabase
        .from('cellar_items')
        .select('user_id, quantity')
        .gt('quantity', 0)

      const bottlesByUser = (cellarData ?? []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.user_id] = (acc[item.user_id] ?? 0) + item.quantity
        return acc
      }, {})

      setUsers(profiles.map(p => ({ ...p, bottle_count: bottlesByUser[p.id] ?? 0 })))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3">
        <h1 className="text-2xl font-bold">Uživatelé</h1>
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Uživatelé</h1>
        <Badge variant="outline">{users.length}/30</Badge>
      </div>

      {users.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>Žádní uživatelé.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <Card key={user.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                      {(user.full_name ?? user.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm truncate">{user.full_name ?? user.email}</p>
                        {user.role === 'admin' && <Crown className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium">{user.bottle_count} lahví</p>
                      <p className="text-xs text-muted-foreground">{formatDate(user.created_at)}</p>
                    </div>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/admin/users/${user.id}`}><ChevronRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
