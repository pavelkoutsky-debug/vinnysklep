import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WINE_COLORS, MATURITY_LABELS } from '@/lib/constants'
import { formatCurrency, computeMaturityStatus } from '@/lib/utils'
import { lookupWineWithGemini } from '@/lib/gemini'
import { importRowSchema, type ImportRowData } from '@/lib/validations'
import type { CellarItem, WineColor } from '@/types/database'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText, Download, Package, Upload, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Parsování Excel souboru ────────────────────────────────────

function normalizeKey(key: string): string {
  return key.toLowerCase()
    .replace(/á/g, 'a').replace(/č/g, 'c').replace(/ď/g, 'd')
    .replace(/é/g, 'e').replace(/í/g, 'i').replace(/ň/g, 'n')
    .replace(/ó/g, 'o').replace(/ř/g, 'r').replace(/š/g, 's')
    .replace(/ť/g, 't').replace(/ú|ů/g, 'u').replace(/ý/g, 'y')
    .replace(/ž/g, 'z').replace(/[^a-z0-9]/g, '')
}

function parseImportFile(file: File): Promise<{ rows: ImportRowData[]; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

        const NAME_KEYS = ['nazevvina', 'nazevwina', 'nazev', 'vino', 'wine', 'name', 'winename']
        const VINTAGE_KEYS = ['rocnik', 'vintage', 'rok', 'year']
        const QTY_KEYS = ['pocetlahvi', 'pocet', 'quantity', 'qty', 'ks', 'lahve', 'lahvi', 'mnozstvi']
        const DATE_KEYS = ['datumnakupu', 'datum', 'date', 'purchasedate']
        const PRICE_KEYS = ['nakupnicena', 'cena', 'price', 'purchaseprice']

        const findVal = (row: Record<string, unknown>, keys: string[]) => {
          for (const [k, v] of Object.entries(row)) {
            if (keys.includes(normalizeKey(k))) return v
          }
          return null
        }

        const rows: ImportRowData[] = []
        const errors: string[] = []

        raw.forEach((row, i) => {
          const nameRaw = findVal(row, NAME_KEYS)
          const vintageRaw = findVal(row, VINTAGE_KEYS)
          const qtyRaw = findVal(row, QTY_KEYS)
          const dateRaw = findVal(row, DATE_KEYS)
          const priceRaw = findVal(row, PRICE_KEYS)

          const result = importRowSchema.safeParse({
            wine_name: nameRaw ? String(nameRaw).trim() : '',
            vintage: vintageRaw ? Number(vintageRaw) : null,
            quantity: qtyRaw ? Number(qtyRaw) : undefined,
            purchase_date: dateRaw ? String(dateRaw).trim() : null,
            purchase_price: priceRaw ? Number(priceRaw) : null,
          })

          if (!result.success) {
            const msg = result.error.errors.map(e => e.message).join(', ')
            errors.push(`Řádek ${i + 2}: ${msg}`)
          } else {
            rows.push(result.data)
          }
        })

        resolve({ rows, errors })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Import sekce ───────────────────────────────────────────────

function ImportSection({ profileId }: { profileId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportRowData[] | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Název vína', 'Ročník', 'Počet lahví', 'Datum nákupu', 'Nákupní cena'],
      ['Château Margaux', 2018, 3, '15.1.2023', 12000],
      ['Moët & Chandon Brut', '', 6, '', ''],
    ])
    ws['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Import')
    XLSX.writeFile(wb, 'import-vina-sablona.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    try {
      const { rows, errors } = await parseImportFile(file)
      setPreview(rows)
      setParseErrors(errors)
    } catch {
      toast.error('Nepodařilo se načíst soubor')
    }
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!preview || preview.length === 0) return
    setProgress({ current: 0, total: preview.length })
    let success = 0
    let failed = 0

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      setProgress({ current: i + 1, total: preview.length })
      try {
        const vintageYear = row.vintage ?? 0

        // 1. Gemini lookup
        const geminiData = await lookupWineWithGemini(row.wine_name, vintageYear)

        // 2. Wine upsert
        const { data: existingWine } = await supabase
          .from('wines').select('id').ilike('name', row.wine_name).maybeSingle()

        let wineId: string
        if (existingWine) {
          wineId = existingWine.id
        } else {
          const { data: newWine, error: wineErr } = await supabase.from('wines').insert({
            name: row.wine_name,
            color: geminiData?.color ?? 'red',
            country: geminiData?.country_cs ?? 'Neznámá',
            country_cs: geminiData?.country_cs ?? 'Neznámá',
            winery: geminiData?.winery ?? null,
            region_cs: geminiData?.region_cs ?? null,
            grapes_cs: geminiData?.grapes_cs ?? null,
            description_cs: geminiData?.description_cs ?? null,
            food_pairing_cs: geminiData?.food_pairing_cs ?? null,
            average_rating: geminiData?.average_rating ?? null,
            data_source: geminiData ? 'gemini' : 'manual',
            gemini_confidence: geminiData?.data_confidence ?? null,
            cache_expires_at: geminiData
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              : null,
          }).select('id').single()
          if (wineErr || !newWine) throw wineErr ?? new Error('Wine insert failed')
          wineId = newWine.id
        }

        // 3. Vintage upsert
        const { data: existingVintage } = await supabase
          .from('vintages').select('id').eq('wine_id', wineId).eq('year', vintageYear).maybeSingle()

        let vintageId: string
        if (existingVintage) {
          vintageId = existingVintage.id
        } else {
          const { data: newVintage, error: vErr } = await supabase.from('vintages').insert({
            wine_id: wineId,
            year: vintageYear,
            drink_from: geminiData?.drink_from ?? null,
            drink_until: geminiData?.drink_until ?? null,
            peak_start: geminiData?.peak_start ?? null,
            peak_end: geminiData?.peak_end ?? null,
            price_eur: geminiData?.price_eur ?? null,
          }).select('id').single()
          if (vErr || !newVintage) throw vErr ?? new Error('Vintage insert failed')
          vintageId = newVintage.id
        }

        // 4. CellarItem + movement
        const { data: cellarItem, error: cErr } = await supabase.from('cellar_items').insert({
          user_id: profileId,
          vintage_id: vintageId,
          quantity: row.quantity,
          purchase_price: row.purchase_price ?? null,
          purchase_currency: row.purchase_currency,
          purchase_date: row.purchase_date ?? null,
          added_by: profileId,
        }).select('id').single()
        if (cErr || !cellarItem) throw cErr ?? new Error('Cellar insert failed')

        await supabase.from('movements').insert({
          cellar_item_id: cellarItem.id,
          user_id: profileId,
          type: 'add',
          quantity: row.quantity,
          reason: 'import',
          date: row.purchase_date ?? new Date().toISOString().split('T')[0],
        })

        success++
      } catch (err) {
        console.error(`Import row ${i + 1} failed:`, err)
        failed++
      }
    }

    setProgress(null)
    setResult({ success, failed })
    setPreview(null)
    setParseErrors([])
    if (success > 0) toast.success(`Importováno ${success} vín do sklepa`)
    if (failed > 0) toast.error(`${failed} vín se nepodařilo importovat`)
  }

  const handleReset = () => {
    setPreview(null)
    setParseErrors([])
    setResult(null)
    setProgress(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-5 w-5 text-blue-600" />
          Import vín z Excelu
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!preview && !progress && !result && (
          <>
            <p className="text-sm text-muted-foreground">
              Nahrajte Excel soubor se seznamem vín. Systém data zpracuje přes Gemini AI
              a uloží vína do vašeho sklepa.
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Povinné sloupce: Název vína, Počet lahví</li>
              <li>Volitelné: Ročník (prázdné = NV), Datum nákupu, Nákupní cena</li>
              <li>Gemini AI automaticky doplní ostatní informace</li>
            </ul>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />Stáhnout šablonu
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Nahrát soubor
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </>
        )}

        {parseErrors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
            <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />Varování při parsování
            </div>
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-amber-700">{e}</p>
            ))}
          </div>
        )}

        {preview && preview.length > 0 && !progress && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Nalezeno {preview.length} vín k importu:
            </p>
            <div className="rounded-lg border overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Název vína</th>
                    <th className="text-center p-2 font-medium w-16">Ročník</th>
                    <th className="text-center p-2 font-medium w-12">Ks</th>
                    <th className="text-right p-2 font-medium w-20">Cena</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 truncate max-w-[180px]">{row.wine_name}</td>
                      <td className="p-2 text-center">
                        {row.vintage ? row.vintage : <Badge variant="outline" className="text-xs">NV</Badge>}
                      </td>
                      <td className="p-2 text-center">{row.quantity}</td>
                      <td className="p-2 text-right text-muted-foreground">
                        {row.purchase_price ? `${row.purchase_price} ${row.purchase_currency}` : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} className="flex-1">
                <Upload className="h-4 w-4 mr-2" />Importovat {preview.length} vín
              </Button>
              <Button variant="outline" size="icon" onClick={handleReset}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {progress && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Importuji víno {progress.current} / {progress.total}…
                </p>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Gemini AI zpracovává vína. Prosím čekejte, nezavírejte stránku.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className={`rounded-lg border p-3 ${result.failed === 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                {result.failed === 0
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : <AlertCircle className="h-5 w-5 text-amber-600" />}
                <div>
                  <p className="font-medium text-sm">
                    {result.success} vín úspěšně importováno
                    {result.failed > 0 && `, ${result.failed} selhalo`}
                  </p>
                  <p className="text-xs text-muted-foreground">Importovaná vína najdete ve svém sklepě.</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Upload className="h-4 w-4 mr-2" />Nový import
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)

  const fetchCellarData = async (): Promise<CellarItem[]> => {
    const { data, error } = await supabase
      .from('cellar_items')
      .select('*, vintage:vintages(*, wine:wines(*))')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CellarItem[]
  }

  const fetchMovements = async () => {
    const { data, error } = await supabase
      .from('movements')
      .select('*, cellar_item:cellar_items(vintage:vintages(year, wine:wines(name, winery)))')
      .eq('user_id', profile!.id)
      .order('date', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  // ── Export Excel ─────────────────────────────────────────────
  const handleExcelExport = async () => {
    setLoading('excel')
    try {
      const [items, movements] = await Promise.all([fetchCellarData(), fetchMovements()])

      const wb = XLSX.utils.book_new()

      // List 1: Sklep
      const cellarRows = items.map(item => {
        const wine = item.vintage?.wine
        const vintage = item.vintage
        const maturity = vintage ? computeMaturityStatus(vintage) : null
        return {
          'Víno': wine?.name ?? '',
          'Vinařství': wine?.winery ?? '',
          'Ročník': vintage?.year === 0 ? 'NV' : (vintage?.year ?? ''),
          'Barva': WINE_COLORS[wine?.color as WineColor] ?? '',
          'Země': wine?.country_cs ?? '',
          'Oblast': wine?.region_cs ?? '',
          'Množství (lahve)': item.quantity,
          'Cena/ks': item.purchase_price ?? '',
          'Měna': item.purchase_currency,
          'Celková hodnota': item.purchase_price ? item.purchase_price * item.quantity : '',
          'Umístění': item.location ?? '',
          'Zralost': maturity ? MATURITY_LABELS[maturity] : '',
          'Moje hodnocení': item.personal_rating ?? '',
          'Poznámka': item.notes ?? '',
          'Přidáno': item.created_at ? new Date(item.created_at).toLocaleDateString('cs-CZ') : '',
        }
      })
      const ws1 = XLSX.utils.json_to_sheet(cellarRows)
      ws1['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 15 },
        { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 14 },
        { wch: 15 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Sklep')

      // List 2: Historie pohybů
      const movementRows = movements.map((m: any) => ({
        'Datum': m.date,
        'Víno': m.cellar_item?.vintage?.wine?.name ?? '',
        'Vinařství': m.cellar_item?.vintage?.wine?.winery ?? '',
        'Ročník': m.cellar_item?.vintage?.year ?? '',
        'Typ': m.type === 'add' ? 'Přidáno' : 'Odebráno',
        'Množství': m.quantity,
        'Důvod': m.reason ?? '',
        'Hodnocení': m.consumption_rating ?? '',
        'K jídlu': m.food_paired ?? '',
        'Poznámka': m.notes ?? '',
      }))
      const ws2 = XLSX.utils.json_to_sheet(movementRows)
      ws2['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 10 },
        { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 30 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, 'Historie')

      // List 3: Souhrn
      const totalBottles = items.reduce((s, i) => s + i.quantity, 0)
      const totalValue = items.reduce((s, i) => i.purchase_price ? s + i.purchase_price * i.quantity : s, 0)
      const summaryRows = [
        { 'Metrika': 'Datum exportu', 'Hodnota': new Date().toLocaleDateString('cs-CZ') },
        { 'Metrika': 'Počet různých vín', 'Hodnota': items.length },
        { 'Metrika': 'Lahve celkem', 'Hodnota': totalBottles },
        { 'Metrika': 'Odhadovaná hodnota (CZK)', 'Hodnota': totalValue },
        { 'Metrika': 'Pohybů celkem', 'Hodnota': movements.length },
      ]
      const ws3 = XLSX.utils.json_to_sheet(summaryRows)
      ws3['!cols'] = [{ wch: 28 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, ws3, 'Souhrn')

      const fileName = `vinny-sklep-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success(`Exportováno: ${fileName}`)
    } catch (e) {
      console.error(e)
      toast.error('Chyba při exportu')
    } finally {
      setLoading(null)
    }
  }

  // ── Export PDF (tisk) ────────────────────────────────────────
  const handlePdfExport = async () => {
    setLoading('pdf')
    try {
      const items = await fetchCellarData()
      const totalBottles = items.reduce((s, i) => s + i.quantity, 0)
      const totalValue = items.reduce((s, i) => i.purchase_price ? s + i.purchase_price * i.quantity : s, 0)

      const rows = items.map(item => {
        const wine = item.vintage?.wine
        const vintage = item.vintage
        const maturity = vintage ? computeMaturityStatus(vintage) : null
        return `
          <tr>
            <td>${wine?.name ?? ''}</td>
            <td>${wine?.winery ?? ''}</td>
            <td>${vintage?.year ?? ''}</td>
            <td>${WINE_COLORS[wine?.color as WineColor] ?? ''}</td>
            <td>${wine?.country_cs ?? ''}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${item.purchase_price ? formatCurrency(item.purchase_price, item.purchase_currency) : '–'}</td>
            <td>${maturity ? MATURITY_LABELS[maturity] : '–'}</td>
            <td>${item.location ?? ''}</td>
          </tr>`
      }).join('')

      const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>Vinný Sklep – Export</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { color: #666; margin-bottom: 16px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #722F37; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .summary { margin-top: 20px; font-size: 10px; color: #444; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>🍷 Vinný Sklep – Inventář</h1>
  <div class="meta">Uživatel: ${profile?.email} &nbsp;|&nbsp; Export: ${new Date().toLocaleDateString('cs-CZ')} &nbsp;|&nbsp; Celkem: ${totalBottles} lahví</div>
  <table>
    <thead>
      <tr>
        <th>Víno</th><th>Vinařství</th><th>Ročník</th><th>Barva</th>
        <th>Země</th><th>Ks</th><th>Cena/ks</th><th>Zralost</th><th>Umístění</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    Lahve celkem: <b>${totalBottles}</b> &nbsp;|&nbsp;
    Odhadovaná hodnota: <b>${formatCurrency(totalValue)}</b>
  </div>
</body>
</html>`

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => win.print(), 500)
      }
      toast.success('Otevřeno pro tisk / uložení jako PDF')
    } catch (e) {
      console.error(e)
      toast.error('Chyba při generování PDF')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Reporty a export</h1>

      {/* Import vín z Excelu */}
      {profile && <ImportSection profileId={profile.id} />}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Excel export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Export do Excelu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Kompletní inventář sklepa ve formátu .xlsx se třemi listy:
              Sklep, Historie pohybů a Souhrn.
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Všechna vína s informacemi</li>
              <li>Historie přidání a odebrání</li>
              <li>Odhadovaná celková hodnota</li>
            </ul>
            <Button
              className="w-full"
              onClick={handleExcelExport}
              disabled={loading === 'excel'}
            >
              {loading === 'excel' ? (
                'Generuji...'
              ) : (
                <><Download className="h-4 w-4 mr-2" />Stáhnout Excel (.xlsx)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* PDF export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Tisk / Export PDF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Přehledná tabulka pro tisk nebo uložení jako PDF
              přes dialog prohlížeče.
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Optimalizováno pro tisk A4</li>
              <li>Obsahuje souhrn a hodnotu sklepa</li>
              <li>Uložte jako PDF přes Ctrl+P → PDF</li>
            </ul>
            <Button
              variant="outline"
              className="w-full"
              onClick={handlePdfExport}
              disabled={loading === 'pdf'}
            >
              {loading === 'pdf' ? (
                'Připravuji...'
              ) : (
                <><FileText className="h-4 w-4 mr-2" />Otevřít pro tisk</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="border-muted">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Co obsahuje export?</p>
              <p>Export obsahuje kompletní inventář vašeho sklepa včetně informací o vínech (vinařství, region, odrůdy), ročnících, množství, nákupních cenách, umístění a stavu zralosti. Historie zobrazuje všechny pohyby (přidání, odebrání) s hodnoceními.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
