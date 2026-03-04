import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WINE_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { CellarItem, WineColor, Profile } from '@/types/database'
import { ArrowLeft, Wine, MapPin } from 'lucide-react'

export default function AdminUserCellarPage() {
  const { userId } = useParams<{ userId: string }>()
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const [items, setItems] = useState<CellarItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadData()
  }, [userId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [profileRes, itemsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('cellar_items').select('*, vintage:vintages(*, wine:wines(*))').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      if (profileRes.data) setUserProfile(profileRes.data as Profile)
      if (itemsRes.data) setItems(itemsRes.data as CellarItem[])
    } finally {
      setLoading(false)
    }
  }

  const totalBottles = items.reduce((s, i) => s + i.quantity, 0)
  const totalValue = items.reduce((s, i) => i.purchase_price ? s + i.purchase_price * i.quantity : s, 0)

  if (loading) {
    return <div className="p-4 md:p-6 space-y-3"><div className="h-8 w-48 bg-muted rounded animate-pulse" />{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/users"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-bold">{userProfile?.full_name ?? userProfile?.email}</h1>
          <p className="text-sm text-muted-foreground">{userProfile?.email} · {totalBottles} lahví · {formatCurrency(totalValue)}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground"><Wine className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>Sklep je prázdný.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const wine = item.vintage?.wine
            const vintage = item.vintage
            if (!wine) return null
            return (
              <Card key={item.id}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Wine className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{wine.name}</p>
                          {wine.winery && <p className="text-xs text-muted-foreground">{wine.winery}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold">{item.quantity}×</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {vintage?.year && <Badge variant="outline" className="text-xs">{vintage.year}</Badge>}
                        <Badge className="text-xs">{WINE_COLORS[wine.color as WineColor]}</Badge>
                        {item.location && <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-0.5" />{item.location}</Badge>}
                        {item.purchase_price && <Badge variant="outline" className="text-xs">{formatCurrency(item.purchase_price, item.purchase_currency)}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
