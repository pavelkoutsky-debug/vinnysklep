// Supabase Edge Function: gemini-wine-info
// Nasazení: supabase functions deploy gemini-wine-info
//
// Akce:
//   wine-info (výchozí) – Gemini 2.5-flash + Google Search grounding, cache 30 dní
//   food-pairing        – krátké doporučení párování jídla (bez cache)
//   wine-profile        – on-demand enrichment: sensory profile, winery history, expert ratings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models`
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function callGemini(prompt: string, withSearch = false) {
  // Pořadí pokusů: grounding zapnout/vypnout × modely
  const searchVariants = withSearch ? [true, false] : [false]

  let lastError = ''
  for (const useSearch of searchVariants) {
    for (const model of GEMINI_MODELS) {
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: prompt }] }],
      }
      if (useSearch) body.tools = [{ google_search: {} }]

      const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const errText = await res.text()
          lastError = `${model}(search=${useSearch}): ${res.status} – ${errText.slice(0, 120)}`
          continue
        }
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text) return text
        lastError = `${model}(search=${useSearch}): prázdná odpověď`
      } catch (e) {
        lastError = `${model}(search=${useSearch}): ${e instanceof Error ? e.message : String(e)}`
      }
    }
  }
  throw new Error(`Gemini API error: ${lastError}`)
}

// ─── Image fetch & store helper ──────────────────────────────────────────────
async function fetchAndStoreWineImage(
  imageUrl: string,
  wineId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const imageRes = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VinnySklep/1.0)',
        'Accept': 'image/jpeg,image/png,image/webp,image/*',
      },
    })
    clearTimeout(timeout)

    if (!imageRes.ok) return null

    const contentType = imageRes.headers.get('content-type') ?? ''
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    const matchedType = validTypes.find(t => contentType.includes(t))
    if (!matchedType) return null

    const arrayBuffer = await imageRes.arrayBuffer()
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) return null  // >2MB
    if (arrayBuffer.byteLength < 1000) return null              // <1KB (error page)

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const ext = extMap[matchedType] ?? 'jpg'
    const filePath = `${wineId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('wine-images')
      .upload(filePath, arrayBuffer, {
        contentType: matchedType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('wine-images')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (err) {
    console.error('Image fetch/store error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

function extractJson(rawText: string): string {
  // Strip markdown code fences if present
  const stripped = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  // Find the outermost {...} object
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Gemini nevrátil JSON objekt')
  return stripped.slice(start, end + 1)
}

// ─── food-pairing action ──────────────────────────────────────────────────────
async function handleFoodPairing(body: Record<string, string>) {
  const { wineName, vintage, color, region } = body
  if (!wineName) return json({ error: 'Chybí wineName' }, 400)

  const prompt = `Jsi sommelier. Napiš stručné doporučení párování jídla k tomuto vínu.

Víno: ${wineName} ${vintage ?? ''}
Barva: ${color ?? ''}
Region: ${region ?? ''}

Odpověz česky, max 2 věty, konkrétní jídla. Bez markdown.`

  const text = await callGemini(prompt)
  return json({ text })
}

// ─── wine-info action (výchozí) ───────────────────────────────────────────────
async function handleWineInfo(body: Record<string, unknown>) {
  const { name, vintage } = body as { name: string; vintage: number }
  if (!name) return json({ error: 'Chybí name' }, 400)

  // NV wine: vintage = 0
  const isNV = !vintage || vintage === 0
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Zkontroluj cache (30 dní)
  const cacheQuery = supabase
    .from('wines')
    .select('*, vintages(*)')
    .ilike('name', `%${name}%`)
    .gt('cache_expires_at', new Date().toISOString())
    .limit(1)
    .single()

  const { data: cached } = await cacheQuery

  if (cached) {
    const vintageObj = isNV
      ? (Array.isArray(cached.vintages) ? cached.vintages.find((v: Record<string, unknown>) => v.year === 0) ?? cached.vintages[0] ?? null : cached.vintages ?? null)
      : (Array.isArray(cached.vintages)
          ? cached.vintages.find((v: Record<string, unknown>) => v.year === vintage) ?? cached.vintages[0] ?? null
          : cached.vintages ?? null)
    return json({ data: { ...cached, vintage: vintageObj }, cached: true })
  }

  // Zavolej Gemini s Google Search
  const currentYear = new Date().getFullYear()
  const vintageHint = isNV
    ? 'Toto je Non-Vintage (NV) víno bez konkrétního ročníku.'
    : `ročník ${vintage}`

  const prompt = `Najdi podrobné informace o víně: "${name}" ${vintageHint}.
Prohledej vinné weby, Decanter, Wine Spectator, Wine Advocate, Vivino, české wineové weby. Aktuální rok: ${currentYear}.
Vrať POUZE validní JSON bez markdown:
{
  "winery": "název vinařství nebo null",
  "country_cs": "země česky",
  "region_cs": "region česky nebo null",
  "appellation": "apelace nebo null",
  "grapes_cs": ["odrůdy česky"],
  "color": "red|white|rose|orange|sparkling|dessert|fortified",
  "alcohol_percentage": číslo nebo null,
  "classification": "klasifikace nebo null",
  "description_cs": "popis česky max 350 znaků",
  "drink_from": rok číslo nebo null,
  "drink_until": rok číslo nebo null,
  "peak_start": rok nebo null,
  "peak_end": rok nebo null,
  "average_rating": 0-5 nebo null,
  "price_eur": cena nebo null,
  "food_pairing_cs": ["jídla česky"],
  "data_confidence": "high|medium|low",
  "sensory_profile": {
    "aroma": "popis vůní česky",
    "taste": "popis chuti česky",
    "finish": "popis doznívání česky",
    "body": "light|medium|full",
    "tannins": "low|medium|high",
    "acidity": "low|medium|high"
  },
  "winery_history_cs": "2-3 věty o historii vinařství česky nebo null",
  "expert_rating_avg": číslo 0-100 nebo null,
  "expert_rating_text": "Decanter: 95, WS: 93, WA: 96 nebo null",
  "image_url": "přímý URL odkaz na fotografii lahve tohoto vína (Vivino, Wine.com, e-shop, web vinařství). Preferuj obrázek konkrétního ${vintageHint}. URL musí být přímý odkaz na obrázek (ne HTML stránku). Pokud nenajdeš, vrať null."
}`

  const rawText = await callGemini(prompt, true)
  const wineData = JSON.parse(extractJson(rawText))

  // Ulož do DB
  const cacheExpires = new Date()
  cacheExpires.setDate(cacheExpires.getDate() + 30)

  const winePayload = {
    name,
    winery: wineData.winery ?? null,
    country: wineData.country_cs ?? 'Neznámá',
    country_cs: wineData.country_cs,
    region_cs: wineData.region_cs,
    appellation: wineData.appellation,
    grapes_cs: wineData.grapes_cs,
    color: wineData.color ?? 'red',
    alcohol_percentage: wineData.alcohol_percentage,
    classification: wineData.classification,
    description_cs: wineData.description_cs,
    food_pairing_cs: wineData.food_pairing_cs,
    average_rating: wineData.average_rating,
    sensory_profile: wineData.sensory_profile ?? null,
    winery_history_cs: wineData.winery_history_cs ?? null,
    data_source: 'gemini',
    gemini_confidence: wineData.data_confidence,
    cache_expires_at: cacheExpires.toISOString(),
  }

  // SELECT → UPDATE nebo INSERT
  const { data: existingWine } = await supabase
    .from('wines')
    .select('id')
    .ilike('name', name)
    .eq('winery', winePayload.winery ?? '')
    .maybeSingle()

  let wine: Record<string, unknown>
  if (existingWine) {
    const { data: updated, error: updateErr } = await supabase
      .from('wines').update(winePayload).eq('id', existingWine.id).select().single()
    if (updateErr) throw updateErr
    wine = updated
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('wines').insert(winePayload).select().single()
    if (insertErr) throw insertErr
    wine = inserted
  }

  // Fetch and store wine image (fail-safe – nikdy neblokuje hlavní flow)
  const geminiImageUrl = typeof wineData.image_url === 'string' ? wineData.image_url : null
  if (geminiImageUrl && !wine.image_url) {
    const storedImageUrl = await fetchAndStoreWineImage(geminiImageUrl, wine.id as string, supabase)
    if (storedImageUrl) {
      await supabase.from('wines').update({ image_url: storedImageUrl }).eq('id', wine.id)
      wine.image_url = storedImageUrl
    }
  }

  const { data: vintageRow, error: vintageError } = await supabase
    .from('vintages')
    .upsert({
      wine_id: wine.id,
      year: isNV ? 0 : vintage,
      drink_from: wineData.drink_from ?? null,
      drink_until: wineData.drink_until ?? null,
      peak_start: wineData.peak_start ?? null,
      peak_end: wineData.peak_end ?? null,
      price_eur: wineData.price_eur ?? null,
      expert_rating_avg: wineData.expert_rating_avg ?? null,
      expert_rating_text: wineData.expert_rating_text ?? null,
    }, { onConflict: 'wine_id,year' })
    .select()
    .single()

  if (vintageError) throw vintageError

  return json({ data: { ...wine, vintage: vintageRow }, cached: false })
}

// ─── wine-profile action (on-demand enrichment) ───────────────────────────────
async function handleWineProfile(body: Record<string, unknown>) {
  const { wineId, vintageId, wineName, vintage, color } = body as {
    wineId: string
    vintageId: string
    wineName: string
    vintage: number
    color: string
  }
  if (!wineId || !wineName) return json({ error: 'Chybí wineId nebo wineName' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const currentYear = new Date().getFullYear()
  const isNV = !vintage || vintage === 0
  const vintageHint = isNV ? 'Non-Vintage (NV)' : `ročník ${vintage}`

  const prompt = `Najdi podrobné informace o víně: "${wineName}" ${vintageHint}.
Prohledej Decanter, Wine Spectator, Wine Advocate, Vivino, české vinné weby. Aktuální rok: ${currentYear}.
Barva vína: ${color ?? 'neznámá'}.
Vrať POUZE validní JSON bez markdown:
{
  "sensory_profile": {
    "aroma": "popis vůní česky",
    "taste": "popis chuti česky",
    "finish": "popis doznívání česky",
    "body": "light|medium|full",
    "tannins": "low|medium|high",
    "acidity": "low|medium|high"
  },
  "winery_history_cs": "2-3 věty o historii vinařství česky nebo null",
  "expert_rating_avg": číslo 0-100 nebo null,
  "expert_rating_text": "Decanter: 95, WS: 93, WA: 96 nebo null"
}`

  const rawText = await callGemini(prompt, true)
  const profileData = JSON.parse(extractJson(rawText))

  // Update wines table
  const { error: wineErr } = await supabase
    .from('wines')
    .update({
      sensory_profile: profileData.sensory_profile ?? null,
      winery_history_cs: profileData.winery_history_cs ?? null,
    })
    .eq('id', wineId)

  if (wineErr) throw wineErr

  // Update vintages table (if vintageId provided)
  if (vintageId) {
    const { error: vintageErr } = await supabase
      .from('vintages')
      .update({
        expert_rating_avg: profileData.expert_rating_avg ?? null,
        expert_rating_text: profileData.expert_rating_text ?? null,
      })
      .eq('id', vintageId)

    if (vintageErr) throw vintageErr
  }

  return json({ data: profileData })
}

// ─── Router ───────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    if (body.action === 'food-pairing') return await handleFoodPairing(body)
    if (body.action === 'wine-profile') return await handleWineProfile(body)
    return await handleWineInfo(body)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Neznámá chyba'
    return json({ error: message }, 500)
  }
})
