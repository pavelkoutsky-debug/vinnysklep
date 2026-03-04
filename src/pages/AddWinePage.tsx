import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Wine, AlertCircle, CheckCircle2, ScanBarcode } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { lookupWineWithGemini, type GeminiWineData } from '@/lib/gemini'
import { addWineSchema, type AddWineFormData } from '@/lib/validations'
import { WINE_COLORS } from '@/lib/constants'
import type { WineColor } from '@/types/database'

type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found'

interface WineResult {
  name: string
  vintage: number
  data: GeminiWineData
}

export default function AddWinePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchName, setSearchName] = useState('')
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [foundWine, setFoundWine] = useState<WineResult | null>(null)
  const [selectedVintage, setSelectedVintage] = useState<number>(new Date().getFullYear() - 2)
  const [isNV, setIsNV] = useState(false)
  const [saving, setSaving] = useState(false)

  const currentYear = new Date().getFullYear()
  const vintageYears = Array.from({ length: 50 }, (_, i) => currentYear - i)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<AddWineFormData>({
    resolver: zodResolver(addWineSchema),
    defaultValues: {
      quantity: 1,
      purchase_currency: (profile?.preferred_currency as 'CZK' | 'EUR' | 'USD') ?? 'CZK',
      is_nv: false,
      vintage: currentYear - 2,
    },
  })

  const handleSearch = async () => {
    if (!searchName.trim()) return
    setLookupStatus('searching')
    setFoundWine(null)

    try {
      const vintageForSearch = isNV ? 0 : selectedVintage
      const data = await lookupWineWithGemini(searchName, vintageForSearch)
      if (data) {
        const vintageForSearch = isNV ? 0 : selectedVintage
        setFoundWine({ name: searchName, vintage: vintageForSearch, data })
        setLookupStatus('found')
        setValue('wine_name', searchName)
        setValue('is_nv', isNV)
        if (!isNV) setValue('vintage', selectedVintage)
        toast.success(`Víno nalezeno! Spolehlivost: ${data.data_confidence === 'high' ? 'vysoká' : data.data_confidence === 'medium' ? 'střední' : 'nízká'}`)
      } else {
        setLookupStatus('not_found')
      }
    } catch (err) {
      setLookupStatus('not_found')
      const detail = err instanceof Error ? err.message : String(err)
      toast.error(`Vyhledávání selhalo: ${detail}`)
    }
  }

  const onSubmit = async (formData: AddWineFormData) => {
    if (!profile) return
    setSaving(true)

    try {
      const wineData = foundWine?.data
      const vintageYear = formData.is_nv ? 0 : (formData.vintage ?? 0)

      // 1. Uložit nebo najít víno v katalogu
      let wineId: string

      const { data: existingWine } = await supabase
        .from('wines')
        .select('id')
        .ilike('name', formData.wine_name)
        .single()

      if (existingWine) {
        wineId = existingWine.id
      } else {
        const colorValue = (wineData?.color as WineColor) ?? (formData.color as WineColor) ?? 'red'
        const countryValue = wineData?.country_cs ?? formData.country_cs ?? 'Neznámá'

        const { data: newWine, error } = await supabase
          .from('wines')
          .insert({
            name: formData.wine_name,
            color: colorValue,
            country: countryValue,
            country_cs: countryValue,
            winery: wineData?.winery ?? null,
            region_cs: wineData?.region_cs ?? null,
            grapes_cs: wineData?.grapes_cs ?? null,
            description_cs: wineData?.description_cs ?? null,
            food_pairing_cs: wineData?.food_pairing_cs ?? null,
            average_rating: wineData?.average_rating ?? null,
            data_source: wineData ? 'gemini' : 'manual',
            gemini_confidence: wineData?.data_confidence ?? null,
            cache_expires_at: wineData
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          })
          .select('id')
          .single()

        if (error || !newWine) throw error ?? new Error('Nepodařilo se uložit víno')
        wineId = newWine.id
      }

      // 2. Uložit ročník
      const { data: existingVintage } = await supabase
        .from('vintages')
        .select('id')
        .eq('wine_id', wineId)
        .eq('year', vintageYear)
        .single()

      let vintageId: string

      if (existingVintage) {
        vintageId = existingVintage.id
      } else {
        const { data: newVintage, error } = await supabase
          .from('vintages')
          .insert({
            wine_id: wineId,
            year: vintageYear,
            drink_from: wineData?.drink_from ?? null,
            drink_until: wineData?.drink_until ?? null,
            peak_start: wineData?.peak_start ?? null,
            peak_end: wineData?.peak_end ?? null,
            price_eur: wineData?.price_eur ?? null,
          })
          .select('id')
          .single()

        if (error || !newVintage) throw error ?? new Error('Nepodařilo se uložit ročník')
        vintageId = newVintage.id
      }

      // 3. Přidat do sklepa
      const { data: cellarItem, error: cellarError } = await supabase
        .from('cellar_items')
        .insert({
          user_id: profile.id,
          vintage_id: vintageId,
          quantity: formData.quantity,
          purchase_price: formData.purchase_price ?? null,
          purchase_currency: formData.purchase_currency,
          purchase_date: formData.purchase_date ?? null,
          location: formData.location ?? null,
          notes: formData.notes ?? null,
          added_by: profile.id,
        })
        .select('id')
        .single()

      if (cellarError || !cellarItem) throw cellarError ?? new Error('Nepodařilo se získat ID záznamu sklepa')

      // 4. Zaznamenat pohyb
      await supabase.from('movements').insert({
        cellar_item_id: cellarItem.id,
        user_id: profile.id,
        type: 'add',
        quantity: formData.quantity,
        reason: 'purchase',
        date: formData.purchase_date ?? new Date().toISOString().split('T')[0],
      })

      toast.success(`${formData.wine_name} ${formData.is_nv ? 'NV' : (formData.vintage ?? '')} přidáno do sklepa!`)
      navigate('/cellar')
    } catch (err) {
      console.error(err)
      toast.error('Nepodařilo se přidat víno. Zkuste to znovu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Přidat víno</h1>
        <p className="text-muted-foreground">Zadejte název vína a my doplníme zbytek</p>
      </div>

      {/* Step 1: Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            Vyhledejte víno
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Château Margaux, Barolo, Riesling..."
                className="pl-9"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            {isNV ? (
              <div className="flex h-10 w-28 items-center justify-center rounded-md border bg-muted text-sm font-medium">
                NV
              </div>
            ) : (
              <Select value={String(selectedVintage)} onValueChange={v => setSelectedVintage(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vintageYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nv-search"
              checked={isNV}
              onChange={e => {
                const nv = e.target.checked
                setIsNV(nv)
                setValue('is_nv', nv)
              }}
              className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer"
            />
            <label htmlFor="nv-search" className="text-sm text-muted-foreground cursor-pointer select-none">
              Bez ročníku (NV – Non-Vintage, např. Champagne)
            </label>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={lookupStatus === 'searching' || !searchName.trim()} className="flex-1">
              {lookupStatus === 'searching' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Hledám...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" />Vyhledat s Gemini AI</>
              )}
            </Button>
            <Button variant="outline" size="icon" title="Skenovat čárový kód (brzy)">
              <ScanBarcode className="h-4 w-4" />
            </Button>
          </div>

          {/* Search result */}
          {lookupStatus === 'found' && foundWine && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{foundWine.name} {foundWine.vintage === 0 ? 'NV' : foundWine.vintage}</p>
                  <p className="text-sm text-muted-foreground">
                    {foundWine.data.winery && `${foundWine.data.winery} · `}
                    {foundWine.data.country_cs}{foundWine.data.region_cs && `, ${foundWine.data.region_cs}`}
                    {foundWine.data.color && ` · ${WINE_COLORS[foundWine.data.color as keyof typeof WINE_COLORS] ?? foundWine.data.color}`}
                  </p>
                  {foundWine.data.grapes_cs && (
                    <p className="text-xs text-muted-foreground mt-1">{foundWine.data.grapes_cs.join(', ')}</p>
                  )}
                  {foundWine.data.description_cs && (
                    <p className="mt-2 text-sm italic text-muted-foreground line-clamp-2">{foundWine.data.description_cs}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {foundWine.data.drink_from && foundWine.data.drink_until && (
                      <Badge variant="outline" className="text-xs">
                        Pít {foundWine.data.drink_from}–{foundWine.data.drink_until}
                      </Badge>
                    )}
                    {foundWine.data.average_rating && (
                      <Badge variant="outline" className="text-xs">
                        ⭐ {foundWine.data.average_rating.toFixed(1)}/5
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${foundWine.data.data_confidence === 'high' ? 'text-green-700 border-green-300' : foundWine.data.data_confidence === 'medium' ? 'text-yellow-700 border-yellow-300' : 'text-red-700 border-red-300'}`}
                    >
                      Spolehlivost: {foundWine.data.data_confidence === 'high' ? 'vysoká' : foundWine.data.data_confidence === 'medium' ? 'střední' : 'nízká'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {lookupStatus === 'not_found' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Víno nenalezeno. Doplňte základní údaje ručně v sekci níže.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Cellar details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            Údaje do sklepa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wine_name">Název vína *</Label>
                <Input id="wine_name" {...register('wine_name')} placeholder="Château Margaux" />
                {errors.wine_name && <p className="text-xs text-destructive">{errors.wine_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vintage">Ročník {isNV ? '' : '*'}</Label>
                {isNV ? (
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                    NV – Non-Vintage
                  </div>
                ) : (
                  <Input
                    id="vintage"
                    type="number"
                    {...register('vintage', { valueAsNumber: true })}
                    placeholder="2020"
                  />
                )}
                {errors.vintage && <p className="text-xs text-destructive">{errors.vintage.message}</p>}
              </div>
            </div>

            {/* Manuální pole – zobrazit pouze když Gemini víno nenašlo */}
            {lookupStatus === 'not_found' && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-dashed p-4">
                <div className="space-y-2">
                  <Label>Barva vína *</Label>
                  <Select onValueChange={v => setValue('color', v as AddWineFormData['color'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte barvu" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WINE_COLORS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Země původu *</Label>
                  <Input placeholder="Francie, Itálie..." {...register('country_cs')} />
                  {errors.country_cs && <p className="text-xs text-destructive">{errors.country_cs.message}</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Počet lahví *</Label>
                <Input id="quantity" type="number" min={1} {...register('quantity', { valueAsNumber: true })} />
                {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Nákupní cena</Label>
                <Input type="number" placeholder="0" {...register('purchase_price', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Měna</Label>
                <Select
                  defaultValue={profile?.preferred_currency ?? 'CZK'}
                  onValueChange={v => setValue('purchase_currency', v as 'CZK' | 'EUR' | 'USD')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CZK">CZK</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum nákupu</Label>
                <Input type="date" {...register('purchase_date')} />
              </div>
              <div className="space-y-2">
                <Label>Pozice ve sklepě</Label>
                <Input placeholder="Regál A, police 2" {...register('location')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Poznámky</Label>
              <Input placeholder="Volitelná poznámka..." {...register('notes')} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ukládám...</> : <><Wine className="mr-2 h-4 w-4" />Přidat do sklepa</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/cellar')}>
                Zrušit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
