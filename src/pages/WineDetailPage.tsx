import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { MaturityBar } from '@/components/features/MaturityBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { WINE_COLORS, MOVEMENT_REASONS } from '@/lib/constants'
import { formatCurrency, formatDate, formatRating } from '@/lib/utils'
import { generateFoodPairing, loadWineProfile } from '@/lib/gemini'
import type { CellarItem, SensoryProfile, SommelierReview, MovementReason } from '@/types/database'
import { toast } from 'sonner'
import {
  ArrowLeft, Minus, Plus, MapPin, Star, Wine,
  ShoppingBag, ExternalLink, Award, Info, Pencil, Sparkles, Loader2,
  RefreshCw, BookOpen, BarChart3
} from 'lucide-react'

// ── Pomocné komponenty ─────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b last:border-b-0">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

// ── Dialog: Odebrat ────────────────────────────────────────────

interface RemoveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cellarItemId: string
  currentQuantity: number
  wineName: string
  onSuccess: () => void
}

function RemoveDialog({ open, onOpenChange, cellarItemId, currentQuantity, wineName, onSuccess }: RemoveDialogProps) {
  const { profile } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState<MovementReason>('consumed')
  const [rating, setRating] = useState('')
  const [foodPaired, setFoodPaired] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { error: movErr } = await supabase.from('movements').insert({
        cellar_item_id: cellarItemId,
        user_id: profile.id,
        type: 'remove',
        quantity,
        reason,
        date: new Date().toISOString().split('T')[0],
        notes: notes || null,
        consumption_rating: rating ? parseInt(rating) : null,
        food_paired: foodPaired || null,
      })
      if (movErr) throw movErr

      const newQty = currentQuantity - quantity
      const { error: updErr } = await supabase
        .from('cellar_items')
        .update({ quantity: newQty })
        .eq('id', cellarItemId)
      if (updErr) throw updErr

      toast.success(`${quantity} × ${wineName} odebráno ze sklepa`)
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error('Chyba při odebrání')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Odebrat ze sklepa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Počet lahví</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.min(currentQuantity, q + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Důvod</Label>
              <Select value={reason} onValueChange={v => setReason(v as MovementReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOVEMENT_REASONS) as MovementReason[])
                    .filter(r => !['purchase', 'gift_received', 'import'].includes(r))
                    .map(r => (
                      <SelectItem key={r} value={r}>{MOVEMENT_REASONS[r]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {reason === 'consumed' && (
            <>
              <div className="space-y-1">
                <Label>Hodnocení (0–100)</Label>
                <Input
                  type="number" min={0} max={100} placeholder="85"
                  value={rating} onChange={e => setRating(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>K jídlu</Label>
                <Input placeholder="Hovězí steak, sýry..." value={foodPaired} onChange={e => setFoodPaired(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Poznámka</Label>
            <Textarea placeholder="Volitelná poznámka..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button variant="destructive" onClick={handleRemove} disabled={loading}>
            {loading ? 'Odebírám...' : `Odebrat ${quantity} lahev${quantity > 1 ? 'í' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog: Přidat lahve ───────────────────────────────────────

interface AddBottleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cellarItemId: string
  currentQuantity: number
  wineName: string
  preferredCurrency: string
  onSuccess: () => void
}

function AddBottleDialog({ open, onOpenChange, cellarItemId, currentQuantity, wineName, preferredCurrency, onSuccess }: AddBottleDialogProps) {
  const { profile } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState<MovementReason>('purchase')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<'CZK' | 'EUR' | 'USD'>(preferredCurrency as 'CZK' | 'EUR' | 'USD')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { error: movErr } = await supabase.from('movements').insert({
        cellar_item_id: cellarItemId,
        user_id: profile.id,
        type: 'add',
        quantity,
        reason,
        date: new Date().toISOString().split('T')[0],
        notes: notes || null,
      })
      if (movErr) throw movErr

      const updateData: Record<string, unknown> = { quantity: currentQuantity + quantity }
      if (price) {
        updateData.purchase_price = parseFloat(price)
        updateData.purchase_currency = currency
      }

      const { error: updErr } = await supabase
        .from('cellar_items')
        .update(updateData)
        .eq('id', cellarItemId)
      if (updErr) throw updErr

      toast.success(`${quantity} × ${wineName} přidáno do sklepa`)
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error('Chyba při přidávání')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přidat do sklepa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Počet lahví</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Důvod</Label>
              <Select value={reason} onValueChange={v => setReason(v as MovementReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOVEMENT_REASONS) as MovementReason[])
                    .filter(r => ['purchase', 'gift_received', 'import', 'other'].includes(r))
                    .map(r => (
                      <SelectItem key={r} value={r}>{MOVEMENT_REASONS[r]}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cena za lahev</Label>
              <Input
                type="number" min={0} placeholder="0"
                value={price} onChange={e => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Měna</Label>
              <Select value={currency} onValueChange={v => setCurrency(v as 'CZK' | 'EUR' | 'USD')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CZK">CZK</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Poznámka</Label>
            <Textarea placeholder="Volitelná poznámka..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? 'Přidávám...' : `Přidat ${quantity} lahev${quantity > 1 ? 'í' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog: Editace záznamu ────────────────────────────────────

interface EditRecordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CellarItem
  onSuccess: () => void
}

function EditRecordDialog({ open, onOpenChange, item, onSuccess }: EditRecordDialogProps) {
  const [purchasePrice, setPurchasePrice] = useState(item.purchase_price?.toString() ?? '')
  const [purchaseCurrency, setPurchaseCurrency] = useState<'CZK' | 'EUR' | 'USD'>(
    (item.purchase_currency as 'CZK' | 'EUR' | 'USD') ?? 'CZK'
  )
  const [purchaseDate, setPurchaseDate] = useState(item.purchase_date ?? '')
  const [location, setLocation] = useState(item.location ?? '')
  const [personalRating, setPersonalRating] = useState(item.personal_rating?.toString() ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('cellar_items')
        .update({
          purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
          purchase_currency: purchaseCurrency,
          purchase_date: purchaseDate || null,
          location: location || null,
          personal_rating: personalRating ? parseInt(personalRating) : null,
          notes: notes || null,
        })
        .eq('id', item.id)

      if (error) throw error
      toast.success('Záznam uložen')
      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast.error('Chyba při ukládání')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit záznam</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cena za lahev</Label>
              <Input
                type="number" min={0} placeholder="0"
                value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Měna</Label>
              <Select value={purchaseCurrency} onValueChange={v => setPurchaseCurrency(v as 'CZK' | 'EUR' | 'USD')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CZK">CZK</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Datum nákupu</Label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moje hodnocení (0–100)</Label>
              <Input
                type="number" min={0} max={100} placeholder="85"
                value={personalRating} onChange={e => setPersonalRating(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Umístění ve sklepě</Label>
            <Input placeholder="Regál A, police 2..." value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Osobní poznámka</Label>
            <Textarea placeholder="Volitelná poznámka..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Ukládám...' : 'Uložit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Senzorický profil ──────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  low: 'Nízká', medium: 'Střední', high: 'Vysoká',
  light: 'Lehké', full: 'Plné',
}
const LEVEL_WIDTH: Record<string, string> = {
  low: '33%', medium: '66%', high: '100%',
  light: '33%', full: '100%',
}

function SensoryBar({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{LEVEL_LABELS[value] ?? value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-wine-600 transition-all" style={{ width: LEVEL_WIDTH[value] ?? '50%' }} />
      </div>
    </div>
  )
}

function SensoryProfileCard({ profile }: { profile: SensoryProfile }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />Senzorický profil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SensoryBar label="Tělo" value={profile.body} />
          <SensoryBar label="Taniny" value={profile.tannins} />
          <SensoryBar label="Kyselost" value={profile.acidity} />
        </div>
        <div className="space-y-2 text-sm">
          {profile.aroma && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aroma</span>
              <p className="mt-0.5 leading-relaxed">{profile.aroma}</p>
            </div>
          )}
          {profile.taste && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chuť</span>
              <p className="mt-0.5 leading-relaxed">{profile.taste}</p>
            </div>
          )}
          {profile.finish && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doznívání</span>
              <p className="mt-0.5 leading-relaxed">{profile.finish}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Hlavní stránka ─────────────────────────────────────────────

export default function WineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [item, setItem] = useState<CellarItem | null>(null)
  const [sommelierReview, setSommelierReview] = useState<SommelierReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [aiPairingLoading, setAiPairingLoading] = useState(false)
  const [aiPairing, setAiPairing] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const fetchData = async () => {
    if (!id || !profile) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cellar_items')
        .select(`
          *,
          vintage:vintages(
            *,
            wine:wines(*)
          )
        `)
        .eq('id', id)
        .eq('user_id', profile.id)
        .single()

      if (error || !data) {
        toast.error('Víno nenalezeno')
        navigate('/cellar')
        return
      }
      setItem(data as CellarItem)

      // Načíst sommelier review – maybeSingle() (může neexistovat)
      const { data: review } = await supabase
        .from('sommelier_reviews')
        .select('*')
        .eq('vintage_id', data.vintage_id)
        .maybeSingle()
      setSommelierReview(review)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id, profile])

  const handleAiPairing = async () => {
    if (!item?.vintage?.wine) return
    const wine = item.vintage.wine
    setAiPairingLoading(true)
    try {
      const pairing = await generateFoodPairing(
        wine.name,
        item.vintage.year,
        wine.color,
        wine.region_cs ?? wine.region ?? ''
      )
      setAiPairing(pairing)
      toast.success('AI párování vygenerováno')
    } catch {
      toast.error('Nepodařilo se vygenerovat párování')
    } finally {
      setAiPairingLoading(false)
    }
  }

  const handleRefreshProfile = async () => {
    if (!item?.vintage?.wine) return
    const wine = item.vintage.wine
    setProfileLoading(true)
    try {
      const ok = await loadWineProfile(
        wine.id,
        item.vintage_id,
        wine.name,
        item.vintage.year,
        wine.color
      )
      if (ok) {
        await fetchData()
        toast.success('AI data obnovena')
      } else {
        toast.error('Nepodařilo se obnovit AI data')
      }
    } finally {
      setProfileLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!item) return null

  const wine = item.vintage?.wine
  const vintage = item.vintage
  if (!wine || !vintage) return null

  const wineColorLabel = WINE_COLORS[wine.color]
  const foodPairingArray = sommelierReview?.food_pairing_override_cs ?? wine.food_pairing_cs ?? wine.food_pairing
  const sensoryProfile = wine.sensory_profile as SensoryProfile | null
  const hasEnrichedData = !!(sensoryProfile || wine.winery_history_cs || vintage.expert_rating_avg)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      {/* Zpět */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/cellar"><ArrowLeft className="h-4 w-4 mr-1" />Zpět do sklepa</Link>
      </Button>

      {/* Hlavička – fotka + základní info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="w-20 h-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              {wine.image_url ? (
                <img src={wine.image_url} alt={wine.name} className="w-full h-full object-contain" />
              ) : (
                <Wine className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold leading-tight">{wine.name}</h1>
                  {wine.winery && <p className="text-muted-foreground text-sm mt-0.5">{wine.winery}</p>}
                </div>
                <Badge variant="outline" className="flex-shrink-0">{vintage.year === 0 ? 'NV' : vintage.year}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge className="text-xs">{wineColorLabel}</Badge>
                {wine.country_cs && <Badge variant="outline" className="text-xs">{wine.country_cs}</Badge>}
                {wine.region_cs && <Badge variant="outline" className="text-xs">{wine.region_cs}</Badge>}
                {wine.classification && <Badge variant="outline" className="text-xs">{wine.classification}</Badge>}
              </div>
              {wine.average_rating && (
                <div className="flex items-center gap-1 mt-2">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{formatRating(wine.average_rating)}</span>
                  {wine.ratings_count && (
                    <span className="text-xs text-muted-foreground">({wine.ratings_count} hodnocení)</span>
                  )}
                </div>
              )}
              {(vintage.expert_rating_avg || vintage.expert_rating_text) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {vintage.expert_rating_avg && (
                    <Badge variant="secondary" className="text-xs font-semibold">
                      <Award className="h-3 w-3 mr-1" />{Math.round(vintage.expert_rating_avg)}/100
                    </Badge>
                  )}
                  {vintage.expert_rating_text && (
                    <span className="text-xs text-muted-foreground">{vintage.expert_rating_text}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Počet lahví + akce */}
          <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">Ve sklepě</p>
              <p className="text-2xl font-bold">{item.quantity} <span className="text-sm font-normal text-muted-foreground">lahví</span></p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setRemoveOpen(true)}
                disabled={item.quantity === 0}
              >
                <Minus className="h-4 w-4 mr-1" />Odebrat
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Přidat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zralost (skrytá pro NV) */}
      {vintage.year !== 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zralost</CardTitle>
          </CardHeader>
          <CardContent>
            <MaturityBar vintage={vintage} sommelierReview={sommelierReview} />
          </CardContent>
        </Card>
      )}

      {/* Sommelier hodnocení */}
      {sommelierReview && (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-600" />
              Hodnocení sommeliera
              {sommelierReview.is_verified && (
                <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">Ověřeno</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sommelierReview.sommelier_rating && (
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-lg">{sommelierReview.sommelier_rating}/100</span>
              </div>
            )}
            <p className="text-sm leading-relaxed">
              {sommelierReview.tasting_notes_cs ?? sommelierReview.tasting_notes}
            </p>
            {sommelierReview.recommendation && (
              <p className="text-sm italic text-muted-foreground border-l-2 border-yellow-400 pl-3">
                {sommelierReview.recommendation}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Degustace: {formatDate(sommelierReview.tasting_date)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Senzorický profil */}
      {sensoryProfile && <SensoryProfileCard profile={sensoryProfile} />}

      {/* Historie vinařství */}
      {wine.winery_history_cs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />Historie vinařství
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{wine.winery_history_cs}</p>
          </CardContent>
        </Card>
      )}

      {/* Informace o víně */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />Informace o víně
            </CardTitle>
            {!hasEnrichedData && (
              <Button
                variant="ghost" size="sm" className="h-7 px-2 text-xs"
                onClick={handleRefreshProfile}
                disabled={profileLoading}
              >
                {profileLoading
                  ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Načítám...</>
                  : <><RefreshCw className="h-3 w-3 mr-1" />Obnovit AI data</>}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Vinařství" value={wine.winery_cs ?? wine.winery} />
          <InfoRow label="Země" value={wine.country_cs} />
          <InfoRow label="Oblast" value={wine.region_cs ?? wine.region} />
          <InfoRow label="Apelace" value={wine.appellation} />
          <InfoRow label="Odrůdy" value={wine.grapes_cs?.join(', ') ?? wine.grapes?.join(', ')} />
          <InfoRow label="Barva" value={wineColorLabel} />
          <InfoRow label="Alkohol" value={wine.alcohol_percentage ? `${wine.alcohol_percentage} %` : null} />
          <InfoRow label="Klasifikace" value={wine.classification} />
          {wine.description_cs && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">Popis</p>
              <p className="text-sm leading-relaxed">{wine.description_cs}</p>
            </div>
          )}
          {/* Párování s jídlem */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Párování s jídlem</p>
              <Button
                variant="ghost" size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleAiPairing}
                disabled={aiPairingLoading}
              >
                {aiPairingLoading
                  ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generuji...</>
                  : <><Sparkles className="h-3 w-3 mr-1" />AI návrh</>}
              </Button>
            </div>
            {aiPairing ? (
              <p className="text-sm leading-relaxed">{aiPairing}</p>
            ) : foodPairingArray && foodPairingArray.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {foodPairingArray.map(f => (
                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Žádné párování. Klikněte na AI návrh.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informace o nákupu */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />Můj záznam
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Upravit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow
            label="Zakoupeno"
            value={item.purchase_date ? formatDate(item.purchase_date) : null}
          />
          <InfoRow
            label="Cena"
            value={item.purchase_price
              ? formatCurrency(item.purchase_price, item.purchase_currency)
              : null}
          />
          <InfoRow
            label="Umístění"
            value={item.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{item.location}
              </span>
            ) : null}
          />
          <InfoRow
            label="Moje hodnocení"
            value={item.personal_rating ? `${item.personal_rating}/100` : null}
          />
          <InfoRow label="Přidáno" value={formatDate(item.created_at)} />
          {item.notes && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">Osobní poznámka</p>
              <p className="text-sm">{item.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Externí odkazy */}
      {(wine.vivino_url || wine.vinnyshop_url) && (
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-2">
            {wine.vivino_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={wine.vivino_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />Vivino
                </a>
              </Button>
            )}
            {wine.vinnyshop_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={wine.vinnyshop_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />VinnyShop.cz
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogy */}
      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        cellarItemId={item.id}
        currentQuantity={item.quantity}
        wineName={wine.name}
        onSuccess={fetchData}
      />

      <AddBottleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cellarItemId={item.id}
        currentQuantity={item.quantity}
        wineName={wine.name}
        preferredCurrency={profile?.preferred_currency ?? 'CZK'}
        onSuccess={fetchData}
      />

      <EditRecordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={item}
        onSuccess={fetchData}
      />
    </div>
  )
}
