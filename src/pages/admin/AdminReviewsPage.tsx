import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MATURITY_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { SommelierReview, MaturityStatus } from '@/types/database'
import { toast } from 'sonner'
import { Plus, Award, Star } from 'lucide-react'

interface EnrichedReview extends SommelierReview {
  wine_name?: string
  wine_year?: number
}

interface ReviewForm {
  vintage_id: string
  wine_search: string
  tasting_date: string
  tasting_notes_cs: string
  sommelier_rating: string
  recommendation: string
  maturity_status: MaturityStatus | ''
  drink_from_override: string
  drink_until_override: string
  peak_start_override: string
  peak_end_override: string
}

const emptyForm: ReviewForm = {
  vintage_id: '',
  wine_search: '',
  tasting_date: new Date().toISOString().split('T')[0],
  tasting_notes_cs: '',
  sommelier_rating: '',
  recommendation: '',
  maturity_status: '',
  drink_from_override: '',
  drink_until_override: '',
  peak_start_override: '',
  peak_end_override: '',
}

export default function AdminReviewsPage() {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState<EnrichedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<ReviewForm>(emptyForm)
  const [vintageResults, setVintageResults] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadReviews() }, [])

  const loadReviews = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('sommelier_reviews')
        .select('*, vintage:vintages(year, wine:wines(name))')
        .order('created_at', { ascending: false })
      if (data) {
        setReviews(data.map((r: any) => ({
          ...r,
          wine_name: r.vintage?.wine?.name,
          wine_year: r.vintage?.year,
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  const searchVintages = async (query: string) => {
    if (query.length < 2) { setVintageResults([]); return }
    const { data } = await supabase
      .from('vintages')
      .select('id, year, wine:wines(name, winery)')
      .ilike('wine.name', `%${query}%`)
      .limit(8)
    setVintageResults(data ?? [])
  }

  const handleSave = async () => {
    if (!profile || !form.vintage_id || !form.tasting_notes_cs || !form.tasting_date) {
      toast.error('Vyplňte povinná pole (víno, datum, poznámky)')
      return
    }
    setSaving(true)
    try {
      const payload = {
        vintage_id: form.vintage_id,
        sommelier_id: profile.id,
        tasting_date: form.tasting_date,
        tasting_notes: form.tasting_notes_cs,
        tasting_notes_cs: form.tasting_notes_cs,
        sommelier_rating: form.sommelier_rating ? parseInt(form.sommelier_rating) : null,
        recommendation: form.recommendation || null,
        maturity_status: (form.maturity_status || null) as MaturityStatus | null,
        drink_from_override: form.drink_from_override ? parseInt(form.drink_from_override) : null,
        drink_until_override: form.drink_until_override ? parseInt(form.drink_until_override) : null,
        peak_start_override: form.peak_start_override ? parseInt(form.peak_start_override) : null,
        peak_end_override: form.peak_end_override ? parseInt(form.peak_end_override) : null,
        is_verified: true,
      }
      const { error } = await supabase.from('sommelier_reviews').upsert(payload, { onConflict: 'vintage_id' })
      if (error) throw error
      toast.success('Hodnocení uloženo')
      setDialogOpen(false)
      setForm(emptyForm)
      loadReviews()
    } catch (e: any) {
      toast.error(e.message ?? 'Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sommelier hodnocení</h1>
        <Button size="sm" onClick={() => { setForm(emptyForm); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" />Přidat
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : reviews.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground"><Award className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>Žádná hodnocení.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reviews.map(r => (
            <Card key={r.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{r.wine_name} {r.wine_year && `(${r.wine_year})`}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.tasting_notes_cs ?? r.tasting_notes}</p>
                    <div className="flex gap-1.5 mt-1">
                      {r.sommelier_rating && <Badge variant="outline" className="text-xs"><Star className="h-3 w-3 mr-0.5" />{r.sommelier_rating}/100</Badge>}
                      {r.maturity_status && <Badge variant="outline" className="text-xs">{MATURITY_LABELS[r.maturity_status]}</Badge>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">{formatDate(r.tasting_date)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nové sommelier hodnocení</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Hledat víno / ročník *</Label>
              <Input placeholder="Název vína..." value={form.wine_search} onChange={e => { setForm(f => ({ ...f, wine_search: e.target.value })); searchVintages(e.target.value) }} />
              {vintageResults.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {vintageResults.map((v: any) => (
                    <button key={v.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => { setForm(f => ({ ...f, vintage_id: v.id, wine_search: `${v.wine?.name} (${v.year})` })); setVintageResults([]) }}>
                      {v.wine?.name} ({v.year}) – {v.wine?.winery}
                    </button>
                  ))}
                </div>
              )}
              {form.vintage_id && <p className="text-xs text-green-600">✓ Vybráno</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Datum degustace *</Label>
                <Input type="date" value={form.tasting_date} onChange={e => setForm(f => ({ ...f, tasting_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Hodnocení (0–100)</Label>
                <Input type="number" min={0} max={100} placeholder="90" value={form.sommelier_rating} onChange={e => setForm(f => ({ ...f, sommelier_rating: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Degustační poznámky *</Label>
              <Textarea rows={4} placeholder="Popis vůně, chuti, celkový dojem..." value={form.tasting_notes_cs} onChange={e => setForm(f => ({ ...f, tasting_notes_cs: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Doporučení</Label>
              <Input placeholder="Doporučujeme podávat při 16–18 °C..." value={form.recommendation} onChange={e => setForm(f => ({ ...f, recommendation: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Stav zralosti (přepsání)</Label>
              <Select value={form.maturity_status} onValueChange={v => setForm(f => ({ ...f, maturity_status: v as MaturityStatus }))}>
                <SelectTrigger><SelectValue placeholder="Automaticky" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATURITY_LABELS) as MaturityStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{MATURITY_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Pít od</Label><Input type="number" placeholder={String(new Date().getFullYear())} value={form.drink_from_override} onChange={e => setForm(f => ({ ...f, drink_from_override: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Pít do</Label><Input type="number" placeholder={String(new Date().getFullYear() + 10)} value={form.drink_until_override} onChange={e => setForm(f => ({ ...f, drink_until_override: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Vrchol od</Label><Input type="number" value={form.peak_start_override} onChange={e => setForm(f => ({ ...f, peak_start_override: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Vrchol do</Label><Input type="number" value={form.peak_end_override} onChange={e => setForm(f => ({ ...f, peak_end_override: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Ukládám...' : 'Uložit hodnocení'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
