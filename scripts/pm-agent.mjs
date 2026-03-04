#!/usr/bin/env node
// =====================================================
// PM Agent – Project Manager powered by Gemini 2.5 Flash
// Spusť: npm run pm
//
// Co dělá:
//   1. Přečte AGENTS.md (stav fází + backlog)
//   2. Prohledá src/pages/ a supabase/functions/
//   3. Pošle vše Gemini → dostane PM report
//   4. Uloží report do pm-report.md
//   5. Vytiskne doporučení na konzoli
// =====================================================

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Načtení API klíče z .env.local ────────────────────────────
function loadEnv() {
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌ .env.local nenalezen')
    process.exit(1)
  }
  const content = readFileSync(envPath, 'utf-8')
  // Podporuje GEMINI_API_KEY i legacy VITE_GEMINI_API_KEY
  const match = content.match(/^(?:VITE_)?GEMINI_API_KEY=(.+)/m)
  if (!match) {
    console.error('❌ GEMINI_API_KEY nenalezen v .env.local')
    process.exit(1)
  }
  return match[1].trim()
}

// ── Gemini fetch (bez SDK) ─────────────────────────────────────
async function geminiGenerate(apiKey, model, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${err.error?.message ?? res.statusText}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Retry helper ──────────────────────────────────────────────
async function withRetry(fn, retries = 3, delayMs = 10000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('quota')
      if (is429 && i < retries - 1) {
        const wait = delayMs * (i + 1)
        console.log(`\x1b[33m⏳ Rate limit – čekám ${wait / 1000}s (pokus ${i + 2}/${retries})...\x1b[0m`)
        await new Promise(r => setTimeout(r, wait))
      } else {
        throw err
      }
    }
  }
}

// ── Skenování souborů ─────────────────────────────────────────
function scanDirectory(dir, extensions = ['.tsx', '.ts']) {
  const results = []
  if (!existsSync(dir)) return results

  function walk(current) {
    const entries = readdirSync(current)
    for (const entry of entries) {
      const fullPath = join(current, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        const lines = readFileSync(fullPath, 'utf-8').split('\n').length
        results.push({ path: relative(ROOT, fullPath), lines, isStub: lines < 10 })
      }
    }
  }

  walk(dir)
  return results
}

function readFileIfExists(path) {
  const fullPath = join(ROOT, path)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : '(soubor neexistuje)'
}

function formatFileList(files) {
  return files
    .map(f => `  ${f.isStub ? '⚠️ STUB' : '✅'} ${f.path} (${f.lines} řádků)`)
    .join('\n')
}

// ── Hlavní PM logika ──────────────────────────────────────────
async function runPmAgent() {
  console.log('\n\x1b[34m══════════════════════════════════\x1b[0m')
  console.log('\x1b[34m  🎯 PM Agent – Vinný Sklep       \x1b[0m')
  console.log('\x1b[34m══════════════════════════════════\x1b[0m\n')

  const apiKey = loadEnv()

  // Sbírání kontextu
  console.log('📊 Sbírám data o projektu...')

  const pages = scanDirectory(join(ROOT, 'src/pages'))
  const hooks = scanDirectory(join(ROOT, 'src/hooks'))
  const features = scanDirectory(join(ROOT, 'src/components/features'))
  const functions = scanDirectory(join(ROOT, 'supabase/functions'), ['.ts', '.js'])

  const agentsMd = readFileIfExists('AGENTS.md')
  const claudeMd = readFileIfExists('CLAUDE.md')
  const wineTestReport = readFileIfExists('wine-test-report.md')
  const hasWineTest = wineTestReport !== '(soubor neexistuje)'

  // Spusť validate a zachyť výstup
  let validateOutput = '(validate neproběhl)'
  try {
    const { execSync } = await import('child_process')
    validateOutput = execSync('bash scripts/validate.sh 2>&1', { cwd: ROOT, encoding: 'utf-8', timeout: 60000 })
  } catch (e) {
    validateOutput = e.stdout ?? e.message ?? 'Chyba při validaci'
  }

  const prompt = `
Jsi senior project manager a QA lead pro webovou aplikaci "Vinný Sklep".
Proveď KOMPLETNÍ audit projektu – zkontroluj co je hotové, co chybí, co nefunguje.

## Specifikace projektu (CLAUDE.md)
${claudeMd}

## Vývojové fáze a backlog (AGENTS.md)
${agentsMd}

## Aktuální stav souborů

### Pages (src/pages/) – počet řádků = indikátor implementace
${formatFileList(pages)}

### Supabase Edge Functions (backend)
${formatFileList(functions)}

### Feature komponenty
${formatFileList(features)}

### Hooks
${formatFileList(hooks)}

## QA Validace (npm run validate)
\`\`\`
${validateOutput.slice(0, 2000)}
\`\`\`

${hasWineTest ? `## Výsledky Gemini Wine Testu (100 vín)\n${wineTestReport.slice(0, 3000)}` : '## Wine Test: DOSUD NESPUŠTĚN (spusť: npm run wine-test)'}

## Tvůj úkol – KOMPLETNÍ AUDIT

Zhodnoť projekt ze 4 pohledů:

### 1. COMPLETENESS (co je hotovo vs. spec)
- Projdi každou stránku a funkci ze spec
- Označ ✅ hotovo / ⚠️ částečné / ❌ chybí

### 2. KVALITA KÓDU A INTEGRACE
- TypeScript errors, build stav
- Gemini integrace – funguje? (viz wine test)
- Supabase integrace – RLS, auth, data

### 3. BLOKY A RIZIKA
- Co brání nasazení do produkce?
- Jaká jsou technická rizika?

### 4. PRIORITIZOVANÝ AKČNÍ PLÁN
- Top 5 úkolů pro dokončení MVP
- Seřazeno: co nasadit HNED / do týdne / do měsíce

Buď konkrétní a přísný. Formát: Markdown. Jazyk: Česky. Max 700 slov.
`

  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  let usedModel = ''

  console.log(`🤖 Gemini PM analyzuje projekt...\n`)

  try {
    let report = ''
    for (const model of MODELS) {
      try {
        report = await withRetry(() => geminiGenerate(apiKey, model, prompt))
        usedModel = model
        break
      } catch (e) {
        const msg = e.message ?? ''
        if (msg.includes('404') || msg.includes('no longer available') || msg.includes('not found')) {
          console.log(`\x1b[33m⚠️  ${model}: nedostupný, zkouším další...\x1b[0m`)
          continue
        }
        throw e
      }
    }

    if (!report) throw new Error('Žádný model neposkytl odpověď')

    const timestamp = new Date().toLocaleString('cs-CZ')
    const reportContent = `# PM Report – ${timestamp}\n\n_Model: ${usedModel}_\n\n${report}\n`
    writeFileSync(join(ROOT, 'pm-report.md'), reportContent, 'utf-8')

    console.log('\x1b[33m' + '─'.repeat(50) + '\x1b[0m')
    console.log(report)
    console.log('\x1b[33m' + '─'.repeat(50) + '\x1b[0m')
    console.log('\n\x1b[32m✅ Report uložen do pm-report.md\x1b[0m\n')

  } catch (error) {
    console.error('\x1b[31m❌ Chyba Gemini API:\x1b[0m', error.message)
    process.exit(1)
  }
}

runPmAgent()
