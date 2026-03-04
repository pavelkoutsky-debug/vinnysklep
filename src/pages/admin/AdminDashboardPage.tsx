import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Wine, Package, MessageSquare, ArrowRight } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  totalWines: number
  totalBottles: number
  unreadMessages: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const [usersRes, winesRes, bottlesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('wines').select('id', { count: 'exact', head: true }),
        supabase.from('cellar_items').select('quantity').gt('quantity', 0),
      ])

      const totalBottles = (bottlesRes.data ?? []).reduce((s: number, i: any) => s + i.quantity, 0)

      setStats({
        totalUsers: usersRes.count ?? 0,
        totalWines: winesRes.count ?? 0,
        totalBottles,
        unreadMessages: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin – přehled</h1>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="h-4 w-4" /><span className="text-xs">Uživatelé</span></div>
              <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}<span className="text-sm font-normal text-muted-foreground">/30</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><Wine className="h-4 w-4" /><span className="text-xs">Katalog vín</span></div>
              <p className="text-2xl font-bold">{stats?.totalWines ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><Package className="h-4 w-4" /><span className="text-xs">Lahve (celkem)</span></div>
              <p className="text-2xl font-bold">{stats?.totalBottles ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><MessageSquare className="h-4 w-4" /><span className="text-xs">Zprávy</span></div>
              <p className="text-2xl font-bold">{stats?.unreadMessages ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Správa uživatelů</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Prohlížejte sklepy uživatelů, přidávejte vína, spravujte role.</p>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/users">Zobrazit uživatele <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sommelier hodnocení</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Přidávejte expertní hodnocení k ročníkům vín.</p>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/reviews">Správa hodnocení <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Katalog vín</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Prohlížejte a spravujte sdílenou databázi vín.</p>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/catalog">Katalog <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Zprávy uživatelům</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Posílejte doporučení, aktuality a systémové zprávy.</p>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/admin/messages">Zprávy <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
