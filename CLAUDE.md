# Vinný Sklep – Instrukce pro Claude Code

## Projekt
Webová aplikace správy vinného sklepa pro max. 30 uživatelů.
Jednoduchý přístup: 1 admin (sommelier) + až 29 uživatelů.
**Aktuální verze: 0.8** – viz `docs/VERSION-0.8.md` a `docs/SPEC-0.8.md`.

## Tech stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + RLS)
- **AI**: Gemini 2.5 Flash + Google Search grounding (přes Edge Function)
- **Grafy**: Recharts
- **Routing**: react-router-dom v6
- **Formuláře**: react-hook-form + zod
- **Toasty**: sonner
- **Excel**: xlsx (SheetJS)

## Klíčové soubory
- `src/types/database.ts` – veškeré TypeScript typy (Wine, Vintage, CellarItem, Movement, SensoryProfile...)
- `src/lib/constants.ts` – WINE_COLORS, MATURITY_LABELS, MOVEMENT_REASONS, APP_LIMITS, COUNTRIES_CS
- `src/lib/utils.ts` – cn(), formatCurrency, computeMaturityStatus, computeMaturityProgress, pluralize
- `src/lib/supabase.ts` – Supabase client + Database type
- `src/lib/gemini.ts` – Gemini AI: lookupWineWithGemini, loadWineProfile, generateFoodPairing
- `src/lib/validations.ts` – Zod schémata (addWineSchema, removeWineSchema, importRowSchema...)
- `src/hooks/useAuth.tsx` – AuthContext (user, profile, isAdmin, signIn, signUp, signOut)
- `src/App.tsx` – routing (ProtectedRoute, AdminRoute, GuestRoute), lazy loading
- `supabase/migrations/` – 3 migrace (001 schema, 002 trigger fix, 003 NV + enhanced data)
- `supabase/functions/gemini-wine-info/index.ts` – Gemini Edge Function (3 akce)
- `supabase/functions/exchange-rates/index.ts` – ECB kurzy

## Konvence
- Jazyk UI: **česky** (všechny texty, labely, zprávy)
- Import path alias: `@/` → `./src/`
- Žádné placeholders ani TODO komentáře v kódu
- Strict TypeScript – žádné `any` bez nutnosti
- Nepoužívat `@radix-ui/react-badge` (neexistuje) – použít `src/components/ui/badge.tsx`
- Nepoužívat `@/components/ui/checkbox` (neexistuje) – použít nativní `<input type="checkbox">`
- Admin email: `pavel.koutsky@gmail.com` (definováno v `src/lib/constants.ts`)

## Struktura stránek
```
/               → DashboardPage (přehled, urgentní vína)
/cellar         → CellarPage (seznam vín, filtry, grid/list)
/cellar/add     → AddWinePage (Gemini AI vyhledávání + ruční přidání + NV checkbox)
/cellar/:id     → WineDetailPage (detail + sensory profil + odebrat/přidat/upravit)
/statistics     → StatisticsPage (Recharts: barva/země/ročník/zralost)
/history        → HistoryPage (timeline pohybů, posledních 200)
/reports        → ReportsPage (Excel import + Excel/PDF export)
/messages       → MessagesPage (inbox od admina)
/settings       → SettingsPage (profil, měna, zabezpečení)
/admin          → AdminDashboardPage (statistiky, quick links)
/admin/users    → AdminUsersPage (seznam uživatelů)
/admin/users/:userId/cellar → AdminUserCellarPage (prohlížení cizího sklepa)
/admin/catalog  → AdminCatalogPage (katalog vín)
/admin/reviews  → AdminReviewsPage (sommelier hodnocení CRUD)
/admin/messages → AdminMessagesPage (odesílání zpráv)
```

## Databázový model (zkráceno)
- `wines` – katalog (sdílený, s cache 30 dní, Gemini data, sensory_profile JSONB, winery_history_cs)
- `vintages` – ročníky vína (year=0 pro NV, drink_from/until, peak, expert_rating_avg/text)
- `cellar_items` – uživatelův sklep (quantity, location, purchase_price, personal_rating)
- `movements` – pohyby (add/remove, reason, consumption_rating, food_paired)
- `sommelier_reviews` – admin hodnocení (přepíše automatická maturity data, UNIQUE per vintage)
- `profiles` – uživatelé (role: user/admin, preferred_currency)
- `admin_messages` + `admin_message_reads` – zprávy + přečtení
- `exchange_rates` – směnné kurzy (ECB)
- `app_config` – key-value konfigurace
- `cellar_shares` – sdílení (backlog, DB existuje, UI ne)

## KRITICKÉ vývojové poznámky

### Edge Functions volání
**NIKDY nepoužívat `supabase.functions.invoke()`** – automaticky posílá user session JWT
jako Bearer token, který Supabase Kong gateway odmítá (401 Invalid JWT).
**Řešení**: Přímý `fetch()` s anon klíčem. Viz `src/lib/gemini.ts` → `invokeEdgeFunction()`.

### Edge Function `await`
V Edge Function routeru MUSÍ být `return await handler()`, ne `return handler()`.
Bez `await` async chyby z handlerů obejdou try/catch a Supabase vrátí plain text "Internal Server Error".

### Edge Function upsert pattern
Pro wines: nelze použít `onConflict: 'name'` (chybí unique constraint na name samotné).
Použít SELECT → UPDATE/INSERT pattern (viz handleWineInfo).
Pro vintages: `onConflict: 'wine_id,year'` funguje.

### Gemini modely
Aktuálně: `gemini-2.5-flash` (primární) + `gemini-2.5-flash-lite` (fallback).
`gemini-2.0-flash` a `gemini-2.0-flash-lite` jsou deprecated.
Google Search grounding: `tools: [{ google_search: {} }]` (snake_case, NE camelCase).

### NV vína
Sentinel: `vintages.year = 0`. Frontend: `year === 0 ? 'NV' : year`.
MaturityBar skrytá pro NV. DB CHECK: `year = 0 OR (year >= 1900 AND year <= 2200)`.

### shadcn/ui komponenty
- `badge.tsx` je CUSTOM (ne Radix) – `src/components/ui/badge.tsx`
- `checkbox` NEEXISTUJE – použít nativní `<input type="checkbox">`
- Všechny ostatní komponenty jsou standardní Radix wrappery

### TypeScript strict
- `noUnusedLocals: true` – žádné unused importy (error 6133)
- `noUnusedParameters: true`
- Build: `tsc -b && vite build`

### SQL
- `unaccent()` potřebuje IMMUTABLE wrapper `immutable_unaccent()` pro GENERATED sloupce
- `is_admin()` funkce je SECURITY DEFINER – používaná ve všech RLS policies

## Multi-agent vývojový workflow
Viz `AGENTS.md` pro detail rolí a procesu.

## QA příkazy
```bash
npm run validate    # TypeScript check + build + stub detekce
npm run pm          # PM agent: kontrola pokroku vs. spec
npm run wine-test   # 97-wine quality test (Gemini)
npm run qa          # Plný QA + PM report
```

## GitHub repository
- **Repo**: `https://github.com/pavelkoutsky-debug/vinnysklep`
- **Branch**: `main` (jediný branch, veškerý vývoj)
- **Viditelnost**: private

## Verzování a dokumentace

### POVINNÝ workflow při každé změně
1. **Implementuj změnu** (kód, DB migrace, Edge Functions...)
2. **Aktualizuj `CHANGELOG.md`** – přidej záznam s popisem změn, dotčenými soubory
3. **Aktualizuj `docs/VERSION-0.8.md`** (nebo novější) – pokud se mění architektura, DB, API, soubory
4. **Aktualizuj `docs/SPEC-0.8.md`** (nebo novější) – pokud se mění funkční chování
5. **Aktualizuj tuto sekci CLAUDE.md** – pokud se mění konvence, klíčové soubory, gotchas
6. **Commitni** s verzovaným tagem (minor: nová funkce, patch: bugfix)
7. **Git tag** pro milníky: `v0.8.1`, `v0.9.0`, atd.
8. **Pushni na GitHub**: `git push origin main --tags`

### Verzování
- **MAJOR** (1.0, 2.0): breaking changes, kompletní přepis
- **MINOR** (0.9, 0.10): nová funkce, nová stránka, nový Edge Function endpoint
- **PATCH** (0.8.1, 0.8.2): bugfix, oprava, drobná úprava UI

### Soubory dokumentace
- `CHANGELOG.md` – chronologický přehled všech změn (primární zdroj pravdy)
- `docs/VERSION-0.8.md` – technická dokumentace v0.8 (architektura, DB, API, soubory)
- `docs/SPEC-0.8.md` – funkční specifikace v0.8 (user stories, funkce per stránka)

### Git tagy a GitHub
- `v0.8` – stabilní záloha (baseline)
- Pro návrat: `git checkout v0.8`
- Pro porovnání: `git diff v0.8..HEAD`
- Pro zobrazení tagů na GitHub: repo → Releases / Tags
- **Po každém commitu vždy pushni na GitHub**

### Co NESMÍ být na GitHubu (.gitignore)
- `.env.local` – Supabase URL, anon key, Gemini API key
- `node_modules/`, `dist/` – build artefakty
- `.claude/` – Claude Code interní soubory
- `.idx/` – Firebase Studio konfigurace
- `test-results/`, `pm-report.md`, `wine-test-report.md` – generované reporty
