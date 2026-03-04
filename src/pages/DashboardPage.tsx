import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wine, Package, TrendingUp, DollarSign, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, computeMaturityStatus } from '@/lib/utils'
import { MATURITY_LABELS, MATURITY_COLORS } from '@/lib/constants'
import type { CellarItem } from '@/types/database'

interface DashboardStats {
  totalBottles: number
  uniqueWines: number
  purchaseValue: number
  currentValue: number
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalBottles: 0, uniqueWines: 0, purchaseValue: 0, currentValue: 0
  })
  const [urgentWines, setUrgentWines] = useState<CellarItem[]>([])
  const [recentActivity, setRecentActivity] = useState<CellarItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!profile) return
      try {
        const { data: items } = await supabase
          .from('cellar_items')
          .select(`
            *,
            vintage:vintages(*, wine:wines(*)),
            sommelier_review:vintages(sommelier_reviews(*))
          `)
          .eq('user_id', profile.id)
          .gt('quantity', 0)
          .order('created_at', { ascending: false })

        if (!items) return

        // Statistiky
        const totalBottles = items.reduce((s, i) => s + i.quantity, 0)
        const uniqueWines = items.length
        const purchaseValue = items.reduce((s, i) =>
          s + (i.purchase_price ?? 0) * i.quantity, 0)

        setStats({ totalBottles, uniqueWines, purchaseValue, currentValue: purchaseValue * 1.15 })

        // Urgentní vína (drink_soon před ideal, pak can_drink)
        const statusPriority: Record<string, number> = { drink_soon: 0, ideal: 1, can_drink: 2 }
        const urgent = items
          .filter(item => {
            if (!item.vintage) return false
            const status = computeMaturityStatus(item.vintage as never)
            return status === 'ideal' || status === 'drink_soon'
          })
          .sort((a, b) => {
            const sa = computeMaturityStatus(a.vintage as never)
            const sb = computeMaturityStatus(b.vintage as never)
            return (statusPriority[sa] ?? 9) - (statusPriority[sb] ?? 9)
          })
          .slice(0, 6)

        setUrgentWines(urgent as CellarItem[])
        // items jsou seřazeny dle created_at DESC (z dotazu výše)
        setRecentActivity(items.slice(0, 5) as CellarItem[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const currency = profile?.preferred_currency ?? 'CZK'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Vítejte zpět, {profile?.full_name?.split(' ')[0] ?? 'příteli vína'}
          </p>
        </div>
        <Button asChild>
          <Link to="/cellar/add">
            <Plus className="mr-2 h-4 w-4" />
            Přidat víno
          </Link>
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Wine}
          label="Lahví celkem"
          value={loading ? '...' : stats.totalBottles.toLocaleString('cs-CZ')}
          iconColor="text-wine-700"
          iconBg="bg-wine-50"
        />
        <StatCard
          icon={Package}
          label="Různých vín"
          value={loading ? '...' : stats.uniqueWines.toLocaleString('cs-CZ')}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          icon={DollarSign}
          label="Nákupní cena"
          value={loading ? '...' : formatCurrency(stats.purchaseValue, currency)}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          icon={TrendingUp}
          label="Odhadovaná hodnota"
          value={loading ? '...' : formatCurrency(stats.currentValue, currency)}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Urgent wines */}
      {urgentWines.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Doporučujeme vypít</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {urgentWines.map(item => {
                const wine = (item.vintage as { wine?: { name?: string; country_cs?: string } } | undefined)?.wine
                const vintage = item.vintage as { year?: number; drink_from?: number; drink_until?: number } | undefined
                const status = vintage ? computeMaturityStatus(vintage as never) : 'can_drink'
                return (
                  <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-wine-50">
                        <Wine className="h-5 w-5 text-wine-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">{wine?.name ?? 'Neznámé víno'}</p>
                        <p className="text-xs text-muted-foreground">
                          {vintage?.year === 0 ? 'NV' : vintage?.year} · {wine?.country_cs} · {item.quantity} ks
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={MATURITY_COLORS[status]} variant="outline">
                        {MATURITY_LABELS[status]}
                      </Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/cellar/${item.id}`}>Detail</Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Poslední přidaná vína</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cellar">Zobrazit vše</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <Wine className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Zatím žádná vína ve sklepě</p>
              <Button asChild className="mt-3" size="sm">
                <Link to="/cellar/add">Přidat první víno</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(item => {
                const wine = (item.vintage as { wine?: { name?: string; color?: string; country_cs?: string } } | undefined)?.wine
                const vintage = item.vintage as { year?: number } | undefined
                return (
                  <Link
                    key={item.id}
                    to={`/cellar/${item.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-wine-50">
                      <Wine className="h-4 w-4 text-wine-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{wine?.name ?? 'Neznámé víno'}</p>
                      <p className="text-xs text-muted-foreground">
                        {vintage?.year === 0 ? 'NV' : vintage?.year} · {wine?.country_cs} · {item.quantity} ks
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, iconColor, iconBg
}: {
  icon: React.ElementType
  label: string
  value: string
  iconColor: string
  iconBg: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
