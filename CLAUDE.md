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

## Dokumentace
- `docs/VERSION-0.8.md` – kompletní technická dokumentace (architektura, DB, API, soubory)
- `docs/SPEC-0.8.md` – funkční specifikace (user stories, funkce per stránka)
