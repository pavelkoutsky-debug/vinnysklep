import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Wine, Plus, Search, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatCurrency, computeMaturityStatus } from '@/lib/utils'
import { MATURITY_LABELS, MATURITY_COLORS, WINE_COLORS } from '@/lib/constants'
import type { CellarItem } from '@/types/database'

type ViewMode = 'grid' | 'list'
type SortKey = 'name' | 'vintage' | 'price' | 'maturity' | 'quantity'

export default function CellarPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<CellarItem[]>([])
  const [filtered, setFiltered] = useState<CellarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('grid')

  const search = searchParams.get('q') ?? ''
  const colorFilter = searchParams.get('color') ?? 'all'
  const sort = (searchParams.get('sort') ?? 'name') as SortKey

  const setSearch = (val: string) => setSearchParams(p => { val ? p.set('q', val) : p.delete('q'); return p }, { replace: true })
  const setColorFilter = (val: string) => setSearchParams(p => { val !== 'all' ? p.set('color', val) : p.delete('color'); return p }, { replace: true })
  const setSort = (val: SortKey) => setSearchParams(p => { val !== 'name' ? p.set('sort', val) : p.delete('sort'); return p }, { replace: true })

  useEffect(() => {
    if (!profile) return
    supabase
      .from('cellar_items')
      .select('*, vintage:vintages(*, wine:wines(*))')
      .eq('user_id', profile.id)
      .gt('quantity', 0)
      .then(({ data }) => {
        setItems((data ?? []) as CellarItem[])
        setLoading(false)
      })
  }, [profile])

  useEffect(() => {
    let result = [...items]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(item => {
        const wine = (item.vintage as { wine?: { name?: string; winery?: string; region_cs?: string; country_cs?: string } } | undefined)?.wine
        return (
          wine?.name?.toLowerCase().includes(q) ||
          wine?.winery?.toLowerCase().includes(q) ||
          wine?.region_cs?.toLowerCase().includes(q) ||
          wine?.country_cs?.toLowerCase().includes(q)
        )
      })
    }

    if (colorFilter !== 'all') {
      result = result.filter(item => {
        const wine = (item.vintage as { wine?: { color?: string } } | undefined)?.wine
        return wine?.color === colorFilter
      })
    }

    result.sort((a, b) => {
      const aWine = (a.vintage as { wine?: { name?: string }; year?: number } | undefined)
      const bWine = (b.vintage as { wine?: { name?: string }; year?: number } | undefined)
      switch (sort) {
        case 'name':
          return (aWine?.wine?.name ?? '').localeCompare(bWine?.wine?.name ?? '', 'cs')
        case 'vintage':
          return (bWine?.year ?? 0) - (aWine?.year ?? 0)
        case 'price':
          return (b.purchase_price ?? 0) - (a.purchase_price ?? 0)
        case 'quantity':
          return b.quantity - a.quantity
        default:
          return 0
      }
    })

    setFiltered(result)
  }, [items, search, colorFilter, sort])

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Můj sklep</h1>
          <p className="text-muted-foreground">
            {loading ? '...' : `${items.reduce((s, i) => s + i.quantity, 0)} lahví · ${items.length} vín`}
          </p>
        </div>
        <Button asChild>
          <Link to="/cellar/add"><Plus className="mr-2 h-4 w-4" />Přidat víno</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hledat víno, vinařství, region..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Barva" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny barvy</SelectItem>
            {Object.entries(WINE_COLORS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Název</SelectItem>
            <SelectItem value="vintage">Ročník</SelectItem>
            <SelectItem value="price">Cena</SelectItem>
            <SelectItem value="quantity">Počet</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden sm:flex gap-1">
          <Button
            variant={view === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setView('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Wine grid/list */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Wine className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="font-medium">{search ? 'Žádné výsledky' : 'Sklep je prázdný'}</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Zkuste jiný vyhledávací výraz' : 'Začněte přidáním prvního vína'}
          </p>
          {!search && (
            <Button asChild className="mt-4">
              <Link to="/cellar/add">Přidat víno</Link>
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => <WineCard key={item.id} item={item} currency={profile?.preferred_currency ?? 'CZK'} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => <WineListRow key={item.id} item={item} currency={profile?.preferred_currency ?? 'CZK'} />)}
        </div>
      )}
    </div>
  )
}

function WineCard({ item, currency }: { item: CellarItem; currency: string }) {
  const wine = (item.vintage as { wine?: { name?: string; color?: string; country_cs?: string; winery?: string; image_url?: string; average_rating?: number } } | undefined)?.wine
  const vintage = item.vintage as { year?: number; drink_from?: number; drink_until?: number; peak_start?: number; peak_end?: number } | undefined
  const status = vintage ? computeMaturityStatus(vintage as never) : 'can_drink'

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Link to={`/cellar/${item.id}`}>
        {/* Wine image or placeholder */}
        <div className="flex h-32 items-center justify-center bg-gradient-to-br from-wine-50 to-wine-100">
          {wine?.image_url ? (
            <img src={wine.image_url} alt={wine.name} className="h-full w-full object-contain p-2" />
          ) : (
            <Wine className="h-12 w-12 text-wine-300" />
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{wine?.name ?? 'Neznámé víno'}</p>
              <p className="text-xs text-muted-foreground truncate">{wine?.winery ?? wine?.country_cs}</p>
            </div>
            <Badge variant="outline" className={`flex-shrink-0 text-xs ${MATURITY_COLORS[status]}`}>
              {MATURITY_LABELS[status]}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{vintage?.year === 0 ? 'NV' : vintage?.year}</span>
            <div className="flex items-center gap-2">
              {item.purchase_price && (
                <span className="text-muted-foreground">{formatCurrency(item.purchase_price, currency)}</span>
              )}
              <Badge variant="secondary">{item.quantity} ks</Badge>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

function WineListRow({ item, currency }: { item: CellarItem; currency: string }) {
  const wine = (item.vintage as { wine?: { name?: string; color?: string; country_cs?: string; winery?: string } } | undefined)?.wine
  const vintage = item.vintage as { year?: number; drink_from?: number; drink_until?: number; peak_start?: number; peak_end?: number } | undefined
  const status = vintage ? computeMaturityStatus(vintage as never) : 'can_drink'

  return (
    <Link to={`/cellar/${item.id}`} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent transition-colors">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-wine-50">
        <Wine className="h-5 w-5 text-wine-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium">{wine?.name}</p>
        <p className="text-xs text-muted-foreground">{vintage?.year === 0 ? 'NV' : vintage?.year} · {wine?.country_cs}</p>
      </div>
      <Badge variant="outline" className={`hidden sm:flex text-xs ${MATURITY_COLORS[status]}`}>
        {MATURITY_LABELS[status]}
      </Badge>
      {item.purchase_price && (
        <span className="hidden md:block text-sm text-muted-foreground">{formatCurrency(item.purchase_price, currency)}</span>
      )}
      <Badge variant="secondary">{item.quantity} ks</Badge>
    </Link>
  )
}
