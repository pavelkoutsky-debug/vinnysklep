import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { WINE_COLORS } from '@/lib/constants'
import type { Wine, WineColor } from '@/types/database'
import { Search, Wine as WineIcon, Database } from 'lucide-react'

export default function AdminCatalogPage() {
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadWines()
  }, [])

  const loadWines = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('wines')
        .select('*')
        .order('name')
        .limit(100)
      if (data) setWines(data as Wine[])
    } finally {
      setLoading(false)
    }
  }

  const filtered = wines.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.winery ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const dataSourceBadge: Record<string, string> = {
    gemini: 'bg-purple-50 text-purple-700',
    vinnyshop: 'bg-green-50 text-green-700',
    manual: 'bg-gray-50 text-gray-700',
    ai: 'bg-blue-50 text-blue-700',
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Katalog vín</h1>
        <Badge variant="outline" className="flex items-center gap-1"><Database className="h-3 w-3" />{wines.length} vín</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Hledat v katalogu..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground"><WineIcon className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>Žádná vína nenalezena.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(wine => (
            <Card key={wine.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{wine.name}</p>
                    {wine.winery && <p className="text-xs text-muted-foreground">{wine.winery}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge className="text-xs">{WINE_COLORS[wine.color as WineColor]}</Badge>
                      <Badge variant="outline" className="text-xs">{wine.country_cs}</Badge>
                      {wine.data_source && (
                        <Badge variant="outline" className={`text-xs ${dataSourceBadge[wine.data_source] ?? ''}`}>
                          {wine.data_source}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {wine.average_rating && (
                    <span className="text-sm font-medium flex-shrink-0">★ {wine.average_rating.toFixed(1)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
