import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MOVEMENT_REASONS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Movement, MovementReason } from '@/types/database'
import { Plus, Minus, Wine } from 'lucide-react'

interface EnrichedMovement extends Movement {
  wine_name?: string
  wine_year?: number
  winery?: string | null
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const [movements, setMovements] = useState<EnrichedMovement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadMovements()
  }, [profile])

  const loadMovements = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('movements')
        .select(`
          *,
          cellar_item:cellar_items(
            vintage:vintages(year, wine:wines(name, winery))
          )
        `)
        .eq('user_id', profile!.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) {
        const enriched: EnrichedMovement[] = data.map((m: any) => ({
          ...m,
          wine_name: m.cellar_item?.vintage?.wine?.name,
          wine_year: m.cellar_item?.vintage?.year,
          winery: m.cellar_item?.vintage?.wine?.winery,
        }))
        setMovements(enriched)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3">
        <h1 className="text-2xl font-bold">Historie</h1>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  // Seskupit podle data
  const grouped = movements.reduce((acc, m) => {
    const key = m.date
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, EnrichedMovement[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Historie</h1>

      {movements.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Wine className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Zatím žádné pohyby ve sklepě.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => (
            <div key={date}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {formatDate(date)}
              </p>
              <div className="space-y-2">
                {grouped[date].map(m => (
                  <Card key={m.id}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          m.type === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {m.type === 'add'
                            ? <Plus className="h-4 w-4" />
                            : <Minus className="h-4 w-4" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm leading-tight">
                                {m.wine_name ?? 'Neznámé víno'}
                                {m.wine_year && <span className="text-muted-foreground ml-1">({m.wine_year})</span>}
                              </p>
                              {m.winery && <p className="text-xs text-muted-foreground">{m.winery}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-semibold text-sm ${m.type === 'add' ? 'text-green-700' : 'text-red-700'}`}>
                                {m.type === 'add' ? '+' : '−'}{m.quantity}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {m.reason && (
                              <Badge variant="outline" className="text-xs">
                                {MOVEMENT_REASONS[m.reason as MovementReason] ?? m.reason}
                              </Badge>
                            )}
                            {m.consumption_rating && (
                              <Badge variant="outline" className="text-xs">
                                ★ {m.consumption_rating}/100
                              </Badge>
                            )}
                            {m.food_paired && (
                              <Badge variant="outline" className="text-xs">🍽 {m.food_paired}</Badge>
                            )}
                          </div>
                          {m.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
