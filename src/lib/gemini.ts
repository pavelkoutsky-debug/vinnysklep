// Gemini AI – volání přes Supabase Edge Function (gemini-wine-info)
// API klíč je bezpečně uložen v Supabase Secrets, nikdy se nedostane do JS bundlu.
// Edge Function se volá přímo přes fetch s anon klíčem (ne přes Supabase SDK),
// aby se obešel problém s user session JWT, které Kong gateway odmítá.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function invokeEdgeFunction(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-wine-info`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const parsed = text.startsWith('{') ? (() => { try { return JSON.parse(text) } catch { return null } })() : null
    throw new Error(parsed?.error ?? `HTTP ${res.status}: ${text.slice(0, 100)}`)
  }
  return res.json()
}

export interface GeminiWineData {
  winery: string | null
  country_cs: string | null
  region_cs: string | null
  appellation: string | null
  grapes_cs: string[] | null
  color: 'red' | 'white' | 'rose' | 'orange' | 'sparkling' | 'dessert' | 'fortified' | null
  alcohol_percentage: number | null
  classification: string | null
  description_cs: string | null
  drink_from: number | null
  drink_until: number | null
  peak_start: number | null
  peak_end: number | null
  average_rating: number | null
  price_eur: number | null
  food_pairing_cs: string[] | null
  data_confidence: 'high' | 'medium' | 'low'
  image_search_hint: string | null
}

export async function lookupWineWithGemini(
  wineName: string,
  vintage: number
): Promise<GeminiWineData | null> {
  const result = await invokeEdgeFunction({ name: wineName, vintage })
  if (result.error) throw new Error(result.error as string)
  if (!result.data) return null

  try {
    const w = result.data as Record<string, unknown>
    // vintage může být buď objekt (při novém záznamu) nebo první prvek pole (z cache)
    const v = (w.vintage ?? null) as Record<string, unknown> | null

    return {
      winery: (w.winery as string) ?? null,
      country_cs: (w.country_cs as string) ?? null,
      region_cs: (w.region_cs as string) ?? null,
      appellation: (w.appellation as string) ?? null,
      grapes_cs: (w.grapes_cs as string[]) ?? null,
      color: (w.color as GeminiWineData['color']) ?? null,
      alcohol_percentage: (w.alcohol_percentage as number) ?? null,
      classification: (w.classification as string) ?? null,
      description_cs: (w.description_cs as string) ?? null,
      drink_from: (v?.drink_from as number) ?? null,
      drink_until: (v?.drink_until as number) ?? null,
      peak_start: (v?.peak_start as number) ?? null,
      peak_end: (v?.peak_end as number) ?? null,
      average_rating: (w.average_rating as number) ?? null,
      price_eur: (v?.price_eur as number) ?? null,
      food_pairing_cs: (w.food_pairing_cs as string[]) ?? null,
      data_confidence: (w.gemini_confidence as 'high' | 'medium' | 'low') ?? 'low',
      image_search_hint: null,
    }
  } catch (err) {
    console.error('Gemini wine lookup failed:', err)
    return null
  }
}

export async function loadWineProfile(
  wineId: string,
  vintageId: string | null,
  wineName: string,
  vintage: number,
  color: string
): Promise<boolean> {
  try {
    const result = await invokeEdgeFunction({ action: 'wine-profile', wineId, vintageId, wineName, vintage, color })
    return !!result.data
  } catch {
    return false
  }
}

export async function generateFoodPairing(
  wineName: string,
  vintage: number,
  color: string,
  region: string
): Promise<string> {
  try {
    const result = await invokeEdgeFunction({ action: 'food-pairing', wineName, vintage: String(vintage), color, region })
    return (result.text as string) ?? 'Informace o párování nejsou dostupné.'
  } catch {
    return 'Informace o párování nejsou dostupné.'
  }
}
