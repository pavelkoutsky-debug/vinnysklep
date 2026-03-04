#!/usr/bin/env node
// =====================================================
// Wine Test Agent – testuje kvalitu Gemini dat pro vína
//
// Spusť: npm run wine-test
//
// Rate limits (free tier Gemini 2.5 Flash):
//   5 RPM, ~20 RPD – skript se automaticky zastaví
//   při vyčerpání kvóty a uloží průběh.
//   Příští den pokračuje od místa kde skončil.
//
// Co dělá:
//   1. Prochází seznam slavných vín
//   2. Pro každé volá Gemini 2.5 Flash (BEZ Google Search
//      – šetří kvótu, testujeme znalosti z tréninku)
//   3. Hodnotí kvalitu vrácených dat
//   4. Ukládá průběžný stav do test-results/progress.json
//   5. Generuje výsledný report wine-test-report.md
// =====================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RESULTS_DIR = join(ROOT, 'test-results')
const PROGRESS_FILE = join(RESULTS_DIR, 'progress.json')

// ── Konfigurace ───────────────────────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) { console.error('❌ .env.local nenalezen'); process.exit(1) }
  const content = readFileSync(envPath, 'utf-8')
  const get = (key) => content.match(new RegExp(`^(?:VITE_)?${key}=(.+)`, 'm'))?.[1]?.trim() ?? ''
  return {
    geminiKey: get('GEMINI_API_KEY'),
    supabaseUrl: get('SUPABASE_URL'),
  }
}

// ── Gemini fetch (bez SDK, bez Google Search) ─────────────────
async function callGemini(apiKey, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Žádný googleSearch – testujeme znalosti modelu, šetříme RPD kvótu
      }),
    }
  )

  if (res.status === 429) throw Object.assign(new Error('Rate limit (429)'), { is429: true })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Seznam vín ────────────────────────────────────────────────
const WINES_TO_TEST = [
  // Francie – Bordeaux
  { name: 'Château Pétrus', vintage: 2015 },
  { name: 'Château Margaux', vintage: 2018 },
  { name: 'Château Latour', vintage: 2016 },
  { name: 'Château Mouton Rothschild', vintage: 2019 },
  { name: 'Château Haut-Brion', vintage: 2017 },
  { name: 'Château Cheval Blanc', vintage: 2015 },
  { name: 'Château Ausone', vintage: 2016 },
  { name: 'Château Léoville-Las-Cases', vintage: 2019 },
  { name: 'Château Palmer', vintage: 2018 },
  { name: 'Château Pichon Baron', vintage: 2020 },
  // Francie – Burgundsko
  { name: 'Domaine de la Romanée-Conti', vintage: 2018 },
  { name: 'Leroy Chambertin', vintage: 2017 },
  { name: 'Armand Rousseau Chambertin', vintage: 2019 },
  { name: 'Coche-Dury Meursault', vintage: 2018 },
  { name: 'Raveneau Chablis Grand Cru', vintage: 2020 },
  // Francie – Rhône, Champagne, Loire
  { name: 'Chapoutier Hermitage Pavillon', vintage: 2017 },
  { name: 'Guigal Côte-Rôtie La Mouline', vintage: 2018 },
  { name: 'Krug Clos du Mesnil', vintage: 2008 },
  { name: 'Dom Pérignon', vintage: 2013 },
  { name: 'Didier Dagueneau Pouilly-Fumé', vintage: 2020 },
  // Itálie
  { name: 'Sassicaia', vintage: 2019 },
  { name: 'Ornellaia', vintage: 2018 },
  { name: 'Masseto', vintage: 2017 },
  { name: 'Barolo Monfortino Giacomo Conterno', vintage: 2015 },
  { name: 'Gaja Barbaresco', vintage: 2019 },
  { name: 'Brunello di Montalcino Biondi-Santi', vintage: 2016 },
  { name: 'Amarone della Valpolicella Quintarelli', vintage: 2015 },
  { name: 'Tignanello', vintage: 2020 },
  { name: 'Antinori Solaia', vintage: 2019 },
  { name: 'Barolo Cannubi Marchesi di Barolo', vintage: 2018 },
  // Španělsko
  { name: 'Vega Sicilia Único', vintage: 2012 },
  { name: 'Pingus', vintage: 2019 },
  { name: 'La Rioja Alta Gran Reserva 904', vintage: 2015 },
  { name: 'CVNE Imperial Gran Reserva', vintage: 2016 },
  { name: 'Priorat Clos Mogador', vintage: 2019 },
  // Německo a Rakousko
  { name: 'Egon Müller Scharzhofberger Riesling TBA', vintage: 2018 },
  { name: 'JJ Prüm Wehlener Sonnenuhr Riesling Spätlese', vintage: 2021 },
  { name: 'Keller Abtserde Riesling GG', vintage: 2020 },
  { name: 'Knoll Riesling Smaragd', vintage: 2021 },
  { name: 'Kracher Trockenbeerenauslese', vintage: 2019 },
  // USA
  { name: 'Opus One', vintage: 2019 },
  { name: 'Screaming Eagle Cabernet Sauvignon', vintage: 2018 },
  { name: 'Caymus Special Selection Cabernet', vintage: 2020 },
  { name: 'Ridge Monte Bello', vintage: 2018 },
  { name: 'Harlan Estate', vintage: 2017 },
  // Austrálie, NZ, Argentina, Chile
  { name: 'Penfolds Grange', vintage: 2018 },
  { name: 'Henschke Hill of Grace', vintage: 2017 },
  { name: 'Cloudy Bay Sauvignon Blanc', vintage: 2023 },
  { name: 'Catena Zapata Adrianna Vineyard', vintage: 2019 },
  { name: 'Almaviva', vintage: 2020 },
  // Portuglsko
  { name: 'Quinta do Crasto Reserva', vintage: 2019 },
  { name: 'Niepoort Redoma', vintage: 2020 },
  { name: 'Barca Velha', vintage: 2011 },
  // Česká republika a Morava
  { name: 'Château Bzenec Welschriesling', vintage: 2022 },
  { name: 'Volařík Welschriesling Výběr z hroznů', vintage: 2021 },
  { name: 'Nové Vinařství Pálava', vintage: 2022 },
  { name: 'Lahofer Moravské zemské víno', vintage: 2023 },
  { name: 'Sonberk Sauvignon', vintage: 2022 },
  // Slovensko
  { name: 'Elesko Cabernet Sauvignon', vintage: 2020 },
  { name: 'Karpatská Perla Frankovka', vintage: 2021 },
  // Jižní Afrika
  { name: 'Kanonkop Pinotage', vintage: 2019 },
  { name: 'Meerlust Rubicon', vintage: 2018 },
  // Dezertní, šumivá, fortifikovaná
  { name: "Château d'Yquem", vintage: 2015 },
  { name: 'Tokaji Aszú 6 Puttonyos Royal Tokaji', vintage: 2017 },
  { name: 'Taylor Fladgate Vintage Port', vintage: 2017 },
  { name: "Graham's Vintage Port", vintage: 2016 },
  { name: 'Jermann Vintage Tunina', vintage: 2021 },
  // Dostupná vína (střední třída)
  { name: 'Meiomi Pinot Noir', vintage: 2022 },
  { name: 'Santa Margherita Pinot Grigio', vintage: 2023 },
  { name: 'Kim Crawford Sauvignon Blanc', vintage: 2023 },
  { name: 'Concha y Toro Don Melchor', vintage: 2020 },
  { name: 'Louis Jadot Beaujolais-Villages', vintage: 2022 },
  { name: 'Antinori Santa Cristina', vintage: 2022 },
  { name: 'Marqués de Riscal Rioja Reserva', vintage: 2019 },
  { name: 'Torres Mas La Plana', vintage: 2018 },
  { name: "Planeta Nero d'Avola", vintage: 2021 },
  { name: 'Banfi Brunello di Montalcino', vintage: 2018 },
  // Rosé a šumivá
  { name: 'Whispering Angel Rosé', vintage: 2023 },
  { name: 'Miraval Rosé', vintage: 2023 },
  { name: 'Minuty Rosé', vintage: 2023 },
  { name: 'Veuve Clicquot Brut', vintage: 0 },
  { name: 'Moët & Chandon Imperial', vintage: 0 },
  { name: 'Bollinger Special Cuvée', vintage: 0 },
  { name: 'Roederer Cristal', vintage: 2015 },
  { name: 'Ruinart Blanc de Blancs', vintage: 0 },
  { name: 'Salon Le Mesnil Blanc de Blancs', vintage: 2013 },
  { name: 'Billecart-Salmon Rosé', vintage: 0 },
  // Ostatní
  { name: 'Yquem Blanc Sec', vintage: 2020 },
  { name: 'Condrieu Guigal', vintage: 2021 },
  { name: 'Grüner Veltliner Loimer', vintage: 2022 },
  { name: 'Gevrey-Chambertin Jadot', vintage: 2020 },
  { name: 'Nuits-Saint-Georges Chevillon', vintage: 2019 },
  { name: 'Barossa Valley Penfolds Bin 389', vintage: 2020 },
  { name: "Stags' Leap Wine Cellars Artemis", vintage: 2021 },
  { name: 'Jordan Cabernet Sauvignon', vintage: 2020 },
  { name: 'Silver Oak Cabernet Sauvignon', vintage: 2019 },
  { name: 'Duckhorn Merlot', vintage: 2021 },
]

// ── Hodnocení výsledku ────────────────────────────────────────
function scoreWine(wine, data) {
  const checks = {
    has_winery: !!data.winery,
    has_country: !!data.country_cs,
    has_region: !!data.region_cs,
    has_grapes: Array.isArray(data.grapes_cs) && data.grapes_cs.length > 0,
    has_color: !!data.color,
    has_drink_window: wine.vintage > 0 ? (!!data.drink_from && !!data.drink_until) : true,
    has_rating: data.average_rating !== null && data.average_rating !== undefined,
    high_confidence: data.data_confidence === 'high',
    medium_plus: ['high', 'medium'].includes(data.data_confidence),
  }
  const score = Object.values(checks).filter(Boolean).length
  return { checks, score, maxScore: Object.keys(checks).length }
}

// ── Hlavní test ────────────────────────────────────────────────
async function runWineTest() {
  console.log('\n\x1b[35m══════════════════════════════════════════\x1b[0m')
  console.log('\x1b[35m  🍷 Wine Test Agent – Gemini Quality Test \x1b[0m')
  console.log('\x1b[35m══════════════════════════════════════════\x1b[0m\n')

  const { geminiKey } = loadEnv()
  if (!geminiKey) { console.error('❌ Chybí GEMINI_API_KEY v .env.local'); process.exit(1) }

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR)

  // Resume: načti dosavadní průběh pokud existuje
  let progress = { results: [], startedAt: new Date().toISOString() }
  if (existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
      console.log(`\x1b[33m📂 Pokračuji z předchozího běhu (${progress.results.length}/${WINES_TO_TEST.length} hotovo)\x1b[0m\n`)
    } catch { /* start fresh */ }
  }

  const done = new Set(progress.results.map(r => r.wine + r.vintage))
  const todo = WINES_TO_TEST.filter(w => !done.has(w.name + w.vintage))
  const total = WINES_TO_TEST.length

  console.log(`🍾 Zbývá otestovat: ${todo.length}/${total} vín`)
  console.log(`⚡ Model: gemini-2.5-flash (bez Google Search grounding)`)
  console.log(`⏱️  Rate limit: 1 req/12s (5 RPM), odhad: ~${Math.ceil(todo.length * 12 / 60)} minut\n`)

  let sessionDone = 0
  let quota429 = false

  for (const wine of todo) {
    const num = `[${String(progress.results.length + 1).padStart(3, '0')}/${total}]`
    const vintageStr = wine.vintage > 0 ? `ročník ${wine.vintage}` : 'NV'
    process.stdout.write(`${num} ${wine.name} (${vintageStr})... `)

    const prompt = `Napiš informace o víně: "${wine.name}"${wine.vintage > 0 ? ` ročník ${wine.vintage}` : ''}.
Vrať POUZE validní JSON bez markdown bloků:
{
  "winery": "vinařství nebo null",
  "country_cs": "země česky",
  "region_cs": "region česky",
  "grapes_cs": ["odrůdy česky"],
  "color": "red|white|rose|orange|sparkling|dessert|fortified",
  "drink_from": ${wine.vintage > 0 ? 'rok kdy začít pít (číslo)' : 'null'},
  "drink_until": ${wine.vintage > 0 ? 'rok do kdy pít (číslo)' : 'null'},
  "average_rating": hodnocení 0-5 nebo null,
  "data_confidence": "high|medium|low"
}`

    try {
      const rawText = await callGemini(geminiKey, prompt)
      const jsonText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const data = JSON.parse(jsonText)
      const { checks, score, maxScore } = scoreWine(wine, data)

      const quality = score >= maxScore * 0.8 ? '✅' : score >= maxScore * 0.5 ? '⚠️ ' : '❌'
      console.log(`${quality} ${score}/${maxScore} | ${data.data_confidence ?? '?'} | ${data.country_cs ?? '?'}`)

      progress.results.push({
        index: progress.results.length + 1,
        wine: wine.name,
        vintage: wine.vintage,
        data,
        score,
        maxScore,
        checks,
        status: score >= maxScore * 0.8 ? 'pass' : score >= maxScore * 0.5 ? 'partial' : 'fail',
      })
      sessionDone++

    } catch (err) {
      if (err.is429) {
        console.log('\n\x1b[31m⛔ Denní kvóta vyčerpána (429). Průběh uložen.\x1b[0m')
        console.log('\x1b[33m   Spusť zítra: npm run wine-test (pokračuje automaticky)\x1b[0m\n')
        quota429 = true
        break
      }
      console.log(`💥 Chyba: ${err.message?.slice(0, 60)}`)
      progress.results.push({
        index: progress.results.length + 1,
        wine: wine.name,
        vintage: wine.vintage,
        error: err.message,
        status: 'error',
      })
    }

    // Průběžné uložení po každém víně
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))

    // Rate limiting: 12s mezi požadavky (= 5 RPM)
    if (!quota429) await new Promise(r => setTimeout(r, 12000))
  }

  // ── Statistiky ────────────────────────────────────────────────
  const allResults = progress.results
  const successResults = allResults.filter(r => r.data)
  const passed = allResults.filter(r => r.status === 'pass').length
  const partial = allResults.filter(r => r.status === 'partial').length
  const failed = allResults.filter(r => r.status === 'fail').length
  const errors = allResults.filter(r => r.status === 'error').length
  const avgScore = successResults.length > 0
    ? successResults.reduce((s, r) => s + (r.score / r.maxScore), 0) / successResults.length
    : 0

  const byConfidence = { high: 0, medium: 0, low: 0 }
  for (const r of successResults) {
    const c = r.data?.data_confidence ?? 'low'
    if (c in byConfidence) byConfidence[c]++
  }

  const isComplete = allResults.length === total

  // ── Report ────────────────────────────────────────────────────
  const report = `# Wine Test Report – Gemini Quality Check
*Datum: ${new Date().toLocaleString('cs-CZ')}*
*Model: gemini-2.5-flash (bez Google Search grounding)*
*Stav: ${isComplete ? '✅ Kompletní' : `⏳ Průběžný (${allResults.length}/${total})`}*

## Souhrn

| Metrika | Hodnota |
|---------|---------|
| Testovaná vína | ${allResults.length} / ${total} |
| ✅ Prošlo (≥80%) | ${passed} |
| ⚠️ Částečně (50-79%) | ${partial} |
| ❌ Selhalo (<50%) | ${failed} |
| 💥 API chyby | ${errors} |
| **Průměrné skóre** | **${Math.round(avgScore * 100)}%** |
| **Úspěšnost** | **${successResults.length > 0 ? Math.round(passed / successResults.length * 100) : 0}%** |

## Distribuce spolehlivosti

| Úroveň | Počet | % |
|--------|-------|---|
| High | ${byConfidence.high} | ${successResults.length > 0 ? Math.round(byConfidence.high / successResults.length * 100) : 0}% |
| Medium | ${byConfidence.medium} | ${successResults.length > 0 ? Math.round(byConfidence.medium / successResults.length * 100) : 0}% |
| Low | ${byConfidence.low} | ${successResults.length > 0 ? Math.round(byConfidence.low / successResults.length * 100) : 0}% |

## Top výsledky (≥ 8/9 bodů)

${allResults.filter(r => r.status === 'pass').slice(0, 15)
  .map(r => `- ✅ **${r.wine}** (${r.vintage || 'NV'}) – ${r.score}/${r.maxScore}, ${r.data?.data_confidence}, ${r.data?.country_cs}`)
  .join('\n') || '_žádné_'}

## Problematické výsledky

${allResults.filter(r => r.status === 'fail' || r.status === 'error').slice(0, 10)
  .map(r => `- ❌ **${r.wine}** – ${r.error ? 'API chyba' : `${r.score}/${r.maxScore} bodů`}`)
  .join('\n') || '_žádné_'}

## Závěr

${isComplete
  ? (avgScore >= 0.8
    ? '✅ Gemini funguje spolehlivě. Projekt je připraven pro produkci.'
    : avgScore >= 0.6
    ? '⚠️ Gemini funguje dobře, ale pro méně slavná vína vrací neúplná data.'
    : '❌ Zvažte vylepšení promptu nebo fallback strategii.')
  : `⏳ Test není kompletní (${allResults.length}/${total}). Spusť zítra: \`npm run wine-test\``}

Detailní výsledky: \`test-results/progress.json\`
`

  writeFileSync(join(ROOT, 'wine-test-report.md'), report)

  console.log('\n\x1b[35m══════════════════════════════════════════\x1b[0m')
  console.log(`\n✅ Prošlo:    ${passed} | ⚠️  Částečně: ${partial} | ❌ Selhalo: ${failed} | 💥 Chyby: ${errors}`)
  console.log(`📊 Avg skóre: ${Math.round(avgScore * 100)}% | Otestováno: ${allResults.length}/${total}`)
  if (!isComplete) console.log(`\x1b[33m\n⏳ Kvóta: spusť zítra pro pokračování (${total - allResults.length} zbývá)\x1b[0m`)
  console.log(`\n\x1b[32m📄 Report: wine-test-report.md\x1b[0m\n`)
}

runWineTest()
