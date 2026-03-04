import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { WINE_COLORS, WINE_COLOR_SWATCHES, MATURITY_LABELS } from '@/lib/constants'
import { formatCurrency, computeMaturityStatus } from '@/lib/utils'
import type { CellarItem, WineColor } from '@/types/database'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Wine, TrendingUp, Package, Star } from 'lucide-react'

interface Stats {
  totalBottles: number
  totalWines: number
  totalValue: number
  avgRating: number | null
  byColor: { name: string; value: number; color: string }[]
  byCountry: { name: string; count: number }[]
  byVintage: { year: number; count: number }[]
  byMaturity: { name: string; count: number; cssColor: string }[]
}

const RADIAN = Math.PI / 180
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
  if (percent < 0.05) return null
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function StatisticsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (!profile) return
    loadStats()
  }, [profile])

  const loadStats = async () => {
    setLoading(true)
    try {
      const { data: items } = await supabase
        .from('cellar_items')
        .select('*, vintage:vintages(*, wine:wines(*))')
        .eq('user_id', profile!.id)
        .gt('quantity', 0)

      if (!items || items.length === 0) {
        setStats({ totalBottles: 0, totalWines: 0, totalValue: 0, avgRating: null, byColor: [], byCountry: [], byVintage: [], byMaturity: [] })
        return
      }

      const cellarItems = items as CellarItem[]
      const totalBottles = cellarItems.reduce((s, i) => s + i.quantity, 0)
      const totalWines = cellarItems.length
      const totalValue = cellarItems.reduce((s, i) => i.purchase_price ? s + i.purchase_price * i.quantity : s, 0)
      const ratedItems = cellarItems.filter(i => i.personal_rating !== null)
      const avgRating = ratedItems.length > 0 ? ratedItems.reduce((s, i) => s + (i.personal_rating ?? 0), 0) / ratedItems.length : null

      const colorMap = new Map<string, { count: number; color: string }>()
      for (const item of cellarItems) {
        const color = item.vintage?.wine?.color ?? 'red'
        const existing = colorMap.get(color) ?? { count: 0, color: WINE_COLOR_SWATCHES[color as WineColor] ?? '#888' }
        colorMap.set(color, { count: existing.count + item.quantity, color: existing.color })
      }
      const byColor = Array.from(colorMap.entries()).map(([key, val]) => ({
        name: WINE_COLORS[key as WineColor] ?? key, value: val.count, color: val.color,
      })).sort((a, b) => b.value - a.value)

      const countryMap = new Map<string, number>()
      for (const item of cellarItems) {
        const country = item.vintage?.wine?.country_cs ?? item.vintage?.wine?.country ?? 'Neznámá'
        countryMap.set(country, (countryMap.get(country) ?? 0) + item.quantity)
      }
      const byCountry = Array.from(countryMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8)

      const vintageMap = new Map<number, number>()
      for (const item of cellarItems) {
        const year = item.vintage?.year ?? 0
        vintageMap.set(year, (vintageMap.get(year) ?? 0) + item.quantity)
      }
      // NV wines (year=0) go at the end with label "NV"
      const nvCount = vintageMap.get(0) ?? 0
      vintageMap.delete(0)
      const byVintage = [
        ...Array.from(vintageMap.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year),
        ...(nvCount > 0 ? [{ year: 0, count: nvCount }] : []),
      ]

      const maturityMap = new Map<string, number>()
      for (const item of cellarItems) {
        if (!item.vintage) continue
        const status = computeMaturityStatus(item.vintage)
        maturityMap.set(status, (maturityMap.get(status) ?? 0) + item.quantity)
      }
      const maturityColorMap: Record<string, string> = {
        too_young: '#22c55e', can_drink: '#84cc16', ideal: '#eab308', drink_soon: '#f97316', past_peak: '#ef4444',
      }
      const byMaturity = Array.from(maturityMap.entries()).map(([key, count]) => ({
        name: MATURITY_LABELS[key as keyof typeof MATURITY_LABELS] ?? key, count, cssColor: maturityColorMap[key] ?? '#888',
      }))

      setStats({ totalBottles, totalWines, totalValue, avgRating, byColor, byCountry, byVintage, byMaturity })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold">Statistiky</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Statistiky</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" /><span className="text-xs">Lahve celkem</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalBottles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wine className="h-4 w-4" /><span className="text-xs">Různých vín</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalWines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" /><span className="text-xs">Odh. hodnota</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Star className="h-4 w-4" /><span className="text-xs">Prům. hodnocení</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgRating !== null ? `${Math.round(stats.avgRating)}/100` : '–'}</p>
          </CardContent>
        </Card>
      </div>

      {stats.totalBottles === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Žádná vína ve sklepě. Přidejte první lahev!</CardContent></Card>
      ) : (
        <Tabs defaultValue="color">
          <TabsList>
            <TabsTrigger value="color">Barva</TabsTrigger>
            <TabsTrigger value="country">Země</TabsTrigger>
            <TabsTrigger value="vintage">Ročník</TabsTrigger>
            <TabsTrigger value="maturity">Zralost</TabsTrigger>
          </TabsList>

          <TabsContent value="color">
            <Card>
              <CardHeader><CardTitle className="text-base">Rozložení podle barvy</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-full md:w-64 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.byColor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={CustomLabel as never}>
                          {stats.byColor.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} lahví`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1">
                    {stats.byColor.map(item => (
                      <div key={item.name} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <Badge variant="outline">{item.value} lahví</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="country">
            <Card>
              <CardHeader><CardTitle className="text-base">Top země původu</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byCountry} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => [`${v} lahví`, 'Počet']} />
                      <Bar dataKey="count" fill="#722F37" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vintage">
            <Card>
              <CardHeader><CardTitle className="text-base">Lahve podle ročníku</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byVintage} margin={{ left: 0, right: 8, bottom: 16 }}>
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v: number) => v === 0 ? 'NV' : String(v)} />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(v) => [`${v} lahví`, 'Počet']} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maturity">
            <Card>
              <CardHeader><CardTitle className="text-base">Zralost vín ve sklepě</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {stats.byMaturity.sort((a, b) => b.count - a.count).map(item => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.count} lahví</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(item.count / stats.totalBottles) * 100}%`, background: item.cssColor }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
