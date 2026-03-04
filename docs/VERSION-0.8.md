# Vinný Sklep – Technická dokumentace v0.8

> Datum: 2026-03-04
> Stav: Produkční základ – vše funkční, backlog features nerealizovány

---

## 1. Přehled architektury

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  React 18 + TypeScript + Vite + Tailwind CSS     │
│  shadcn/ui (Radix) + Recharts + react-hook-form  │
│  react-router-dom v6 (SPA, lazy loading)         │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────┐
│              SUPABASE CLOUD                      │
│  ┌──────────────────────────────────┐            │
│  │  Kong Gateway (JWT validation)    │            │
│  │  → apikey + Authorization header  │            │
│  └──────┬──────────────┬────────────┘            │
│         │              │                          │
│  ┌──────▼─────┐  ┌─────▼──────────┐             │
│  │ REST API    │  │ Edge Functions  │             │
│  │ (PostgREST) │  │ (Deno runtime)  │             │
│  └──────┬─────┘  └─────┬──────────┘             │
│         │              │                          │
│  ┌──────▼──────────────▼────────────┐            │
│  │       PostgreSQL (+ RLS)          │            │
│  │  Extensions: unaccent, pg_trgm    │            │
│  └──────────────────────────────────┘            │
│                                                   │
│  Auth: Supabase Auth (email/password)             │
└─────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│            EXTERNAL APIs                         │
│  Gemini 2.5 Flash (Google AI)                    │
│  + Google Search grounding                       │
│  ECB (směnné kurzy – XML daily rates)            │
└─────────────────────────────────────────────────┘
```

### Tech stack

| Vrstva | Technologie | Verze |
|--------|-------------|-------|
| Runtime | Node.js + Vite | 5.4.2 |
| UI Framework | React | 18.3.1 |
| Jazyk | TypeScript (strict) | 5.5.3 |
| Styling | Tailwind CSS + tailwindcss-animate | 3.4.11 |
| UI Components | shadcn/ui (Radix primitives) | mix |
| Routing | react-router-dom | 6.26.2 |
| Formuláře | react-hook-form + zod | 7.53.0 / 3.23.8 |
| Grafy | Recharts | 2.13.0 |
| Toasty | sonner | 1.5.0 |
| Excel | xlsx (SheetJS) | 0.18.5 |
| Datum | date-fns | 3.6.0 |
| Ikony | lucide-react | 0.441.0 |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) | 2.45.0 |
| AI | Gemini 2.5 Flash + Google Search grounding | v1beta |
| Barcode (připraveno) | @zxing/browser | 0.1.5 |

---

## 2. Struktura souborů

```
/home/user/test/
├── index.html                          # SPA vstupní bod (lang=cs)
├── package.json                        # Závislosti + skripty
├── vite.config.ts                      # Vite: plugin-react, @/ alias, manualChunks
├── tailwind.config.ts                  # Tailwind: wine/gold barvy, animate, Inter font
├── postcss.config.js                   # tailwindcss + autoprefixer
├── tsconfig.json                       # Root (references app + node)
├── tsconfig.app.json                   # Strict, ES2020, @/* path alias
├── tsconfig.node.json                  # Node/Vite config
├── CLAUDE.md                           # Instrukce pro Claude Code
├── AGENTS.md                           # Multi-agent workflow definice
├── .env.local                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, GEMINI_API_KEY
├── .gitignore
│
├── docs/
│   ├── VERSION-0.8.md                  # Tento soubor
│   └── SPEC-0.8.md                     # Funkční specifikace
│
├── scripts/
│   ├── validate.sh                     # QA: tsc --noEmit + build + stub detekce
│   ├── pm-agent.mjs                    # PM Agent: Gemini analýza projektu
│   └── wine-test.mjs                   # Wine data quality test (97 vín)
│
├── supabase/
│   ├── config.toml                     # Supabase lokální konfig
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      # Kompletní DB schema (409 řádků)
│   │   ├── 002_fix_user_trigger.sql    # Oprava trigger handle_new_user
│   │   └── 003_nv_and_enhanced_data.sql # NV support + sensory/expert columns
│   └── functions/
│       ├── gemini-wine-info/
│       │   └── index.ts                # Gemini Edge Function (309 řádků)
│       └── exchange-rates/
│           └── index.ts                # ECB kurzy Edge Function (83 řádků)
│
├── src/
│   ├── main.tsx                        # React 18 createRoot, StrictMode
│   ├── App.tsx                         # Router, route guards, lazy loading (124 řádků)
│   ├── index.css                       # Globální CSS + shadcn CSS proměnné
│   ├── vite-env.d.ts                   # Vite env type declarations
│   │
│   ├── types/
│   │   └── database.ts                 # Všechny TypeScript interface (175 řádků)
│   │
│   ├── lib/
│   │   ├── constants.ts                # Konstanty: barvy, maturity labels, limity (93 řádků)
│   │   ├── utils.ts                    # Utility: cn, format, maturity logic (140 řádků)
│   │   ├── supabase.ts                 # Supabase klient + Database typ (42 řádků)
│   │   ├── gemini.ts                   # Gemini AI klient – přímý fetch (114 řádků)
│   │   └── validations.ts             # Zod schéma pro formuláře (125 řádků)
│   │
│   ├── hooks/
│   │   └── useAuth.tsx                 # AuthContext + AuthProvider (125 řádků)
│   │
│   ├── components/
│   │   ├── features/
│   │   │   └── MaturityBar.tsx         # Vizuální ukazatel zralosti (84 řádků)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Layout wrapper: Sidebar + Outlet (31 řádků)
│   │   │   ├── Sidebar.tsx             # Desktop navigace (107 řádků)
│   │   │   ├── MobileNav.tsx           # Mobilní spodní tab bar (52 řádků)
│   │   │   └── MobileDrawer.tsx        # Mobilní bottom sheet (95 řádků)
│   │   └── ui/                         # shadcn/ui komponenty
│   │       ├── badge.tsx               # Custom Badge (32 řádků)
│   │       ├── button.tsx              # Button s variantami (52 řádků)
│   │       ├── card.tsx                # Card kompozice (50 řádků)
│   │       ├── dialog.tsx              # Radix Dialog (87 řádků)
│   │       ├── input.tsx               # Input field (23 řádků)
│   │       ├── label.tsx               # Radix Label (23 řádků)
│   │       ├── select.tsx              # Radix Select (140 řádků)
│   │       ├── separator.tsx           # Radix Separator (23 řádků)
│   │       ├── tabs.tsx                # Radix Tabs (52 řádků)
│   │       └── textarea.tsx            # Textarea (20 řádků)
│   │
│   └── pages/
│       ├── LoginPage.tsx               # Login formulář (90 řádků)
│       ├── RegisterPage.tsx            # Registrace + 30-user limit (110 řádků)
│       ├── ResetPasswordPage.tsx       # Reset hesla: 3 stavy (172 řádků)
│       ├── DashboardPage.tsx           # Přehled + urgentní vína (250 řádků)
│       ├── CellarPage.tsx              # Seznam vín, filtry, řazení (253 řádků)
│       ├── AddWinePage.tsx             # Gemini AI vyhledávání + přidání (438 řádků)
│       ├── WineDetailPage.tsx          # Kompletní detail vína (877 řádků)
│       ├── StatisticsPage.tsx          # Recharts grafy (275 řádků)
│       ├── HistoryPage.tsx             # Timeline pohybů (154 řádků)
│       ├── ReportsPage.tsx             # Excel/PDF export + import (641 řádků)
│       ├── MessagesPage.tsx            # Inbox zpráv od admina (137 řádků)
│       ├── SettingsPage.tsx            # Nastavení profilu (130 řádků)
│       └── admin/
│           ├── AdminDashboardPage.tsx   # Admin statistiky (122 řádků)
│           ├── AdminUsersPage.tsx       # Správa uživatelů (103 řádků)
│           ├── AdminUserCellarPage.tsx  # Prohlížení cizího sklepa (95 řádků)
│           ├── AdminCatalogPage.tsx     # Katalog vín (91 řádků)
│           ├── AdminReviewsPage.tsx     # Sommelier hodnocení CRUD (224 řádků)
│           └── AdminMessagesPage.tsx    # Odesílání zpráv (99 řádků)
```

---

## 3. Databázový model

### 3.1 ER diagram (zjednodušený)

```
profiles (1) ──< cellar_items (N) >── vintages (1) >── wines (1)
    │                  │
    │                  └──< movements (N)
    │
    ├──< admin_messages (N)
    ├──< sommelier_reviews (N) >── vintages
    ├──< cellar_shares (N)
    └──< admin_actions_log (N)

exchange_rates (standalone)
app_config (standalone, key-value)
admin_message_reads (M:N join)
```

### 3.2 Tabulky – detailní popis

#### `profiles`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | FK → auth.users(id) ON DELETE CASCADE |
| email | TEXT UNIQUE | ne | Email uživatele |
| full_name | TEXT | ano | Celé jméno |
| role | TEXT | ne | 'user' / 'admin' (CHECK constraint) |
| preferred_currency | TEXT | ne | Výchozí: 'CZK' |
| notifications_enabled | BOOLEAN | ne | Výchozí: true |
| created_at | TIMESTAMPTZ | ne | Auto |
| updated_at | TIMESTAMPTZ | ne | Auto |

**RLS**: vlastní data + admin vidí vše.
**Trigger**: `on_auth_user_created` → automaticky vytvoří profil, admin role pro `pavel.koutsky@gmail.com`.

#### `wines`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | gen_random_uuid() |
| name | TEXT | ne | Název vína |
| name_cs | TEXT | ano | Český název |
| winery | TEXT | ano | Vinařství |
| winery_cs | TEXT | ano | Vinařství česky |
| country | TEXT | ne | Země (ISO styl) |
| country_cs | TEXT | ne | Země česky |
| region / region_cs | TEXT | ano | Region |
| appellation | TEXT | ano | Apelace (AOC, DOC...) |
| grapes / grapes_cs | TEXT[] | ano | Odrůdy |
| color | TEXT | ne | CHECK: red/white/rose/orange/sparkling/dessert/fortified |
| alcohol_percentage | DECIMAL(4,2) | ano | % alkoholu |
| classification | TEXT | ano | Grand Cru, Reserva... |
| description / description_cs | TEXT | ano | Popis |
| food_pairing / food_pairing_cs | TEXT[] | ano | Párování jídla |
| vinnyshop_url | TEXT | ano | Link na VinnyShop.cz |
| vivino_id / vivino_url | TEXT | ano | Vivino reference |
| image_url | TEXT | ano | URL obrázku |
| average_rating | DECIMAL(3,2) | ano | 0.00–5.00 |
| ratings_count | INTEGER | ano | Počet hodnocení |
| data_source | TEXT | ano | 'vinnyshop'/'gemini'/'manual'/'ai' |
| gemini_confidence | TEXT | ano | 'high'/'medium'/'low' |
| cache_expires_at | TIMESTAMPTZ | ano | Expirace Gemini cache (30 dní) |
| barcode | TEXT | ano | EAN čárový kód |
| sensory_profile | JSONB | ano | `{aroma, taste, finish, body, tannins, acidity}` |
| winery_history_cs | TEXT | ano | Historie vinařství česky |
| name_normalized | TEXT GENERATED | ne | Automaticky: lower+unaccent+regex |
| created_at / updated_at | TIMESTAMPTZ | ne | Auto |

**UNIQUE**: (name, winery)
**Indexy**: GIN trigram na name + name_normalized, btree na country, color, cache_expires_at
**RLS**: čtení pro autentizované, insert pro autentizované, update jen admin

#### `vintages`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | gen_random_uuid() |
| wine_id | UUID FK | ne | → wines(id) ON DELETE CASCADE |
| year | INTEGER | ne | CHECK: year=0 OR (1900–2200); 0 = NV |
| drink_from / drink_until | INTEGER | ano | Doporučené pití (rok) |
| peak_start / peak_end | INTEGER | ano | Vrchol zralosti (rok) |
| price_eur | DECIMAL(10,2) | ano | Orientační cena EUR |
| rating | DECIMAL(3,2) | ano | 0.00–5.00 |
| notes / notes_cs | TEXT | ano | Poznámky |
| expert_rating_avg | DECIMAL(4,1) | ano | Průměr expertních hodnocení 0–100 |
| expert_rating_text | TEXT | ano | "Decanter: 95, WS: 93" |
| created_at / updated_at | TIMESTAMPTZ | ne | Auto |

**UNIQUE**: (wine_id, year)
**NV sentinel**: year = 0 pro Non-Vintage vína (Champagne NV apod.)

#### `cellar_items`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | gen_random_uuid() |
| user_id | UUID FK | ne | → profiles(id) ON DELETE CASCADE |
| vintage_id | UUID FK | ne | → vintages(id) |
| quantity | INTEGER | ne | CHECK ≥ 0 |
| location | TEXT | ano | Umístění ve sklepě |
| purchase_date | DATE | ano | Datum nákupu |
| purchase_price | DECIMAL(10,2) | ano | Nákupní cena |
| purchase_currency | TEXT | ne | CHECK: CZK/EUR/USD |
| notes | TEXT | ano | Osobní poznámky |
| personal_rating | INTEGER | ano | 0–100 |
| position_row / position_col | INTEGER | ano | Pozice v mapě (nepoužito) |
| position_label | TEXT | ano | Popis pozice (nepoužito) |
| added_by | UUID FK | ano | → profiles(id) |
| created_at / updated_at | TIMESTAMPTZ | ne | Auto |

**RLS**: vlastní data + admin

#### `movements`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | gen_random_uuid() |
| cellar_item_id | UUID FK | ne | → cellar_items(id) ON DELETE CASCADE |
| user_id | UUID FK | ne | → profiles(id) |
| type | TEXT | ne | 'add' / 'remove' |
| quantity | INTEGER | ne | CHECK > 0 |
| reason | TEXT | ano | purchase/gift_received/consumed/gift_given/sold/broken/import/other |
| date | DATE | ne | Výchozí: CURRENT_DATE |
| notes | TEXT | ano | Poznámky k pohybu |
| consumption_rating | INTEGER | ano | 0–100 (při konzumaci) |
| food_paired | TEXT | ano | S jakým jídlem párováno |
| created_at | TIMESTAMPTZ | ne | Auto |

**RLS**: vlastní data + admin

#### `sommelier_reviews`
| Sloupec | Typ | Nullable | Popis |
|---------|-----|----------|-------|
| id | UUID PK | ne | gen_random_uuid() |
| vintage_id | UUID FK UNIQUE | ne | → vintages(id), max 1 review/vintage |
| sommelier_id | UUID FK | ne | → profiles(id) |
| drink_from/until_override | INTEGER | ano | Přepis automatických dat |
| peak_start/end_override | INTEGER | ano | Přepis peak dat |
| maturity_status | TEXT | ano | Ruční override statusu |
| tasting_date | DATE | ne | Datum degustace |
| tasting_notes / tasting_notes_cs | TEXT | ne/ano | Degustační poznámky |
| sommelier_rating | INTEGER | ano | 0–100 |
| recommendation | TEXT | ano | Doporučení |
| food_pairing_override / _cs | TEXT[] | ano | Přepis food pairing |
| is_verified | BOOLEAN | ne | Výchozí: true |
| created_at / updated_at | TIMESTAMPTZ | ne | Auto |

**RLS**: čtení pro všechny, zápis jen admin

#### `admin_messages` + `admin_message_reads`
Zprávy od admina uživatelům. `recipient_id = NULL` → broadcast všem.
Join tabulka `admin_message_reads` pro sledování přečtení.

#### `exchange_rates`
Směnné kurzy. UNIQUE(base_currency, target_currency). Veřejné čtení, admin zápis.
Výchozí seed: EUR↔CZK, USD↔CZK, EUR↔USD.

#### `app_config`
Key-value JSONB. Klíče: max_users, max_image_size_mb, supported_currencies, default_currency, wine_cache_days, initial_admin_email.

#### `admin_actions_log`
Audit trail admin akcí. Typy: add_wine, remove_wine, edit_wine, view_cellar, promote_to_admin, send_message, sommelier_review.

#### `cellar_shares`
Sdílení sklepa přes token. **Backlog – není implementováno v UI.**

### 3.3 Migrace

| Číslo | Soubor | Obsah |
|-------|--------|-------|
| 001 | `001_initial_schema.sql` | Kompletní schema: 13 tabulek, RLS, trigger, indexy, seed |
| 002 | `002_fix_user_trigger.sql` | Oprava ON CONFLICT + exception handling v trigger |
| 003 | `003_nv_and_enhanced_data.sql` | NV support (year=0), sensory_profile JSONB, winery_history, expert ratings |

### 3.4 PostgreSQL Extensions

- **`unaccent`** – normalizace diakritiky (č→c, é→e)
- **`pg_trgm`** – fuzzy vyhledávání (trigram GIN index)
- **`immutable_unaccent()`** – IMMUTABLE wrapper pro GENERATED sloupec

### 3.5 Helper funkce

- **`is_admin()`** – vrací BOOLEAN, použita ve všech RLS policies
- **`handle_new_user()`** – trigger AFTER INSERT na auth.users, vytvoří profil

---

## 4. Edge Functions (Supabase)

### 4.1 `gemini-wine-info` (~370 řádků)

**Runtime**: Deno v2
**URL**: `https://fupzdgtncwmrdglmrwue.supabase.co/functions/v1/gemini-wine-info`
**Auth**: Bearer token (anon key) + apikey header
**Secrets**: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### Akce

| Akce | Trigger | Popis |
|------|---------|-------|
| `wine-info` (výchozí) | `{ name, vintage }` | Vyhledání vína + cache 30 dní |
| `food-pairing` | `{ action:'food-pairing', wineName, vintage, color, region }` | Párování jídla (2 věty česky) |
| `wine-profile` | `{ action:'wine-profile', wineId, vintageId, wineName, vintage, color }` | On-demand enrichment: sensory, winery history, expert ratings |

#### Gemini volání

- **Modely** (fallback pořadí): `gemini-2.5-flash` → `gemini-2.5-flash-lite`
- **Google Search grounding**: povoleno pro wine-info a wine-profile
- **Fallback strategie**: s groundingem → bez groundingu → další model
- **JSON extrakce**: `extractJson()` – strip markdown fences, najdi `{...}`

#### wine-info flow

```
1. Zkontroluj DB cache (cache_expires_at > now)
   → Ano: vrať cached data
   → Ne: pokračuj
2. Zavolej Gemini s Google Search (strukturovaný prompt, včetně image_url)
3. Parsuj JSON odpověď
4. Ulož do DB:
   a. wines: SELECT → UPDATE (existující) nebo INSERT (nový)
   b. Fetch & store image: stáhni fotku lahve → upload do Storage → update wines.image_url
   c. vintages: UPSERT (onConflict: wine_id,year)
5. Vrať { data: {...wine, vintage: vintageRow}, cached: false }
```

#### Image fetching (`fetchAndStoreWineImage`)
- Stáhne obrázek z URL nalezeného Gemini (8s timeout)
- Validuje content-type (JPEG/PNG/WebP) a velikost (1KB–2MB)
- Uploadne do Supabase Storage bucket `wine-images` jako `{wine_id}.{ext}`
- Vrátí public URL; při jakékoliv chybě vrátí null (fail-safe)
- Obrázek se stáhne jen pokud víno ještě nemá image_url

#### Supabase Storage

| Bucket | Viditelnost | Limit | MIME types | RLS |
|--------|-------------|-------|------------|-----|
| `wine-images` | public | 2 MiB | JPEG, PNG, WebP | read: public, write: service_role |

**Migrace**: `004_wine_images_storage.sql`
**Naming**: `{wine_id}.{ext}` (upsert – jedno foto na víno)

### 4.2 `exchange-rates` (83 řádků)

**URL**: `https://fupzdgtncwmrdglmrwue.supabase.co/functions/v1/exchange-rates`
**Zdroj**: ECB XML daily rates
**Měny**: CZK, USD, GBP, CHF vs EUR (všechny páry)
**Plánované spouštění**: cron denně v 6:00 UTC (nastaveno v Supabase Dashboard)

---

## 5. Frontend – Routování a autorizace

### 5.1 Route guards

| Guard | Logika | Redirect |
|-------|--------|----------|
| `ProtectedRoute` | `user` musí existovat | → `/login` |
| `AdminRoute` | `profile.role === 'admin'` | → `/` |
| `GuestRoute` | `user` NESMÍ existovat | → `/` |

### 5.2 Kompletní route tabulka

| Cesta | Guard | Komponenta | Lazy? |
|-------|-------|-----------|-------|
| `/login` | GuestRoute | LoginPage | Ne |
| `/register` | GuestRoute | RegisterPage | Ne |
| `/reset-password` | – | ResetPasswordPage | Ne |
| `/` | ProtectedRoute | DashboardPage | Ano |
| `/cellar` | ProtectedRoute | CellarPage | Ano |
| `/cellar/add` | ProtectedRoute | AddWinePage | Ano |
| `/cellar/:id` | ProtectedRoute | WineDetailPage | Ano |
| `/statistics` | ProtectedRoute | StatisticsPage | Ano |
| `/history` | ProtectedRoute | HistoryPage | Ano |
| `/reports` | ProtectedRoute | ReportsPage | Ano |
| `/messages` | ProtectedRoute | MessagesPage | Ano |
| `/settings` | ProtectedRoute | SettingsPage | Ano |
| `/admin` | AdminRoute | AdminDashboardPage | Ano |
| `/admin/users` | AdminRoute | AdminUsersPage | Ano |
| `/admin/users/:userId/cellar` | AdminRoute | AdminUserCellarPage | Ano |
| `/admin/catalog` | AdminRoute | AdminCatalogPage | Ano |
| `/admin/reviews` | AdminRoute | AdminReviewsPage | Ano |
| `/admin/messages` | AdminRoute | AdminMessagesPage | Ano |
| `*` | – | Navigate → `/` | – |

Všechny chráněné stránky jsou uvnitř `AppShell` (Sidebar + MobileNav).

---

## 6. React stránky – detailní popis

### 6.1 LoginPage (90 ř.)
- react-hook-form + loginSchema (email + password)
- `signIn()` z useAuth → navigate `/`
- Wine-red gradient pozadí

### 6.2 RegisterPage (110 ř.)
- registerSchema: jméno, email, heslo (min 8, uppercase, číslo), potvrzení
- `signUp()` → kontrola 30-user limitu → admin role pro admin email
- Po úspěchu → `/login`

### 6.3 ResetPasswordPage (172 ř.)
- 3 stavy: zadání emailu → recovery (nové heslo) → hotovo
- Detekce `PASSWORD_RECOVERY` eventu z Supabase Auth
- `updateUser({ password })` pro nastavení nového hesla

### 6.4 DashboardPage (250 ř.)
- 4 stat karty: lahve, unikátní vína, nákupní hodnota, odhadovaná hodnota
- "Doporučujeme vypít": vína se statusem ideal/drink_soon, seřazená podle urgence
- "Poslední přidaná": 5 nejnovějších cellar_items
- Supabase query: cellar_items + vintages + wines + sommelier_reviews join

### 6.5 CellarPage (253 ř.)
- Vyhledávání: název/vinařství/region/země (client-side filter)
- Filter: barva vína (select)
- Řazení: název/ročník/cena/počet
- View toggle: grid (WineCard) vs. list (WineListRow)
- URL query params: `?q=`, `?color=`, `?sort=`
- NV vína zobrazena jako "NV" místo čísla

### 6.6 AddWinePage (438 ř.)
- **Krok 1**: Gemini AI vyhledávání
  - Input: název vína + ročník (nebo "NV" checkbox)
  - `lookupWineWithGemini(name, vintage)`
  - Stavy: idle → loading → found/not_found
  - Nalezeno: zobrazení nalezených dat (barva, vinařství, země, popis, confidence badge)
  - Nenalezeno: manuální formulář (barva, země povinné)
- **Krok 2**: Skladové údaje
  - Počet lahví, nákupní cena, měna, datum, umístění, poznámky
- **DB flow**: wine lookup/insert → vintage lookup/insert → cellar_item insert → movement insert (type='add', reason='purchase')

### 6.7 WineDetailPage (877 ř.) – NEJVĚTŠÍ soubor
- Interní komponenty: InfoRow, RemoveDialog, AddBottleDialog, EditRecordDialog, SensoryBar, SensoryProfileCard
- **Hlavní karta**: název, vinařství, ročník/NV, barva badge, confidence badge, apelace, odrůdy, alkohol, klasifikace
- **MaturityBar**: vizuální progress bar zralosti (skrytá pro NV)
- **Sommelier review karta**: žluté ohraničení, rating, degustační poznámky, doporučení
- **Senzorický profil**: vizuální bary (body/tannins/acidity) + textové popisy (aroma/taste/finish)
- **Expert hodnocení**: badge s průměrem + detail text
- **Historie vinařství**: textový blok
- **Food pairing**: Gemini AI generování nebo zobrazení existujících dat
- **Tlačítko "Obnovit AI data"**: `loadWineProfile()` – on-demand enrichment
- **Akce**: Odebrat lahve, Přidat lahve, Upravit záznam
- **Externí odkazy**: Vivino, VinnyShop.cz
- **RemoveDialog**: reason select, rating 0-100, food paired, notes
- **AddBottleDialog**: počet, reason, cena, měna, notes
- **EditRecordDialog**: nákupní cena/datum, umístění, osobní hodnocení, notes

### 6.8 StatisticsPage (275 ř.)
- 4 summary karty: lahve, vína, odhadovaná hodnota, průměrný rating
- **Tab Barva**: PieChart s custom labely (% na řezu, wine color swatches)
- **Tab Země**: Horizontální BarChart, top 8 zemí
- **Tab Ročník**: BarChart podle roku, NV jako "NV" na ose
- **Tab Zralost**: custom progress bars per maturity status

### 6.9 HistoryPage (154 ř.)
- Posledních 200 pohybů, joined s názvy vín
- Seskupeno podle data (sestupně), timeline layout
- Zobrazení: +/- ikona, název vína + rok, reason badge, rating, food paired, notes

### 6.10 ReportsPage (641 ř.)
- **Import sekce** (ImportSection):
  - File input pro Excel
  - Flexibilní detekce sloupců (CZ + EN názvy, normalizované)
  - Preview tabulka před importem
  - Progress bar během importu (sekvenční Gemini volání)
  - Výsledkové shrnutí (úspěch/chyby)
  - Stažení šablony
- **Export Excel**: 3 listy (Sklep, Historie, Souhrn) přes xlsx
- **Export PDF**: generuje HTML, otevře print dialog v novém tabu

### 6.11 MessagesPage (137 ř.)
- Inbox zpráv od admina (admin_messages + admin_message_reads join)
- Badge nepřečtených, rozbalení kliknutím, automatické označení jako přečtené
- Barevné štítky podle typu: news=blue, event=purple, recommendation=yellow, system=gray

### 6.12 SettingsPage (130 ř.)
- Profil: full_name, preferred_currency
- Zabezpečení: odeslání reset emailu
- Info: role, datum registrace

### 6.13 Admin stránky

| Stránka | Funkce |
|---------|--------|
| AdminDashboardPage | Statistiky: users (x/30), catalog count, total bottles; quick links |
| AdminUsersPage | Seznam profilů s počtem lahví, datum registrace, admin ikona |
| AdminUserCellarPage | Read-only zobrazení cizího sklepa |
| AdminCatalogPage | Procházení sdíleného katalogu (100 vín, client-side search) |
| AdminReviewsPage | CRUD sommelier hodnocení: degustace, rating, maturity override, drink window |
| AdminMessagesPage | Odesílání zpráv: recipient (broadcast/konkrétní), typ, předmět, obsah |

---

## 7. Hooks

### `useAuth` (useAuth.tsx, 125 ř.)

```typescript
interface AuthContextType {
  user: User | null              // Supabase auth user
  session: Session | null        // Supabase session
  profile: Profile | null        // DB profil (role, preferences)
  loading: boolean               // Počáteční stav
  isAdmin: boolean               // profile?.role === 'admin'
  signIn(email, password): Promise<void>
  signUp(email, password, fullName): Promise<void>   // 30-user limit check
  signOut(): Promise<void>
  resetPassword(email): Promise<void>
  refreshProfile(): Promise<void>
}
```

**Chování**:
- Na mount: `getSession()` → fetch profile
- `onAuthStateChange` listener pro real-time session updates
- `signUp()` kontroluje count profiles ≥ 30

---

## 8. Knihovny (src/lib/)

### `constants.ts` (93 ř.)
- `APP_LIMITS`: MAX_USERS=30, SUPPORTED_CURRENCIES, WINE_CACHE_DAYS=30
- `ADMIN_EMAIL`: 'pavel.koutsky@gmail.com'
- `WINE_COLORS`: Record<WineColor, český label>
- `MATURITY_LABELS` / `MATURITY_COLORS` / `MATURITY_DOT_COLORS`: pro zobrazení zralosti
- `MOVEMENT_REASONS`: české labels pro důvody pohybu
- `MESSAGE_TYPES`: české labels pro typy zpráv
- `WINE_COLOR_SWATCHES`: hex barvy pro grafy
- `COUNTRIES_CS`: 15 zemí ISO→čeština

### `utils.ts` (140 ř.)
- `cn()`: clsx + tailwind-merge
- `formatCurrency(amount, currency)`: Intl.NumberFormat cs-CZ
- `formatDate(date)`: d. M. yyyy, česky
- `formatMonthYear(date)`: LLLL yyyy, česky
- `formatRating(rating, max)`: toFixed(1) pro 5-star, Math.round/100 pro 100-scale
- `computeMaturityStatus(vintage, sommelierReview?)` → MaturityStatus: klíčová business logika
- `computeMaturityProgress(vintage, sommelierReview?)` → 0-100: pro progress bar
- `convertCurrency(amount, from, to, rates)`: lookup konverze
- `slugify(text)`: NFD + remove diacritics + lowercase
- `truncate(text, maxLength)`: s elipsou
- `normalizeWineName(name)`: NFD + château → chateau + lowercase
- `getImageUrl(url, fallback)`: fallback '/wine-placeholder.svg'
- `pluralize(count, one, few, many)`: česká pluralizace (1/2-4/5+)

### `supabase.ts` (42 ř.)
- `supabase`: createClient s VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- `Database` typ: typované definice všech 10 tabulek (Row/Insert/Update)

### `gemini.ts` (114 ř.)

**KRITICKÉ**: Používá přímý `fetch()` s anon klíčem místo `supabase.functions.invoke()`.
Důvod: Supabase SDK automaticky posílá user session JWT jako Bearer token, který Kong gateway odmítá (401 Invalid JWT).

- `invokeEdgeFunction(body)`: přímý POST na Edge Function URL s anon key
- `lookupWineWithGemini(name, vintage)` → GeminiWineData | null
- `loadWineProfile(wineId, vintageId, wineName, vintage, color)` → boolean
- `generateFoodPairing(wineName, vintage, color, region)` → string

### `validations.ts` (125 ř.)
Zod schémata:
- `registerSchema`: email, full_name, password (min 8, uppercase, digit), password_confirm
- `loginSchema`: email, password
- `resetPasswordSchema` / `newPasswordSchema`: password flows
- `addWineSchema`: wine_name, is_nv, vintage, quantity, price, currency, date, location, notes, color, country_cs
- `manualWineSchema`: kompletní manuální vstup
- `removeWineSchema`: quantity, reason, date, consumption_rating, food_paired, notes
- `imageSchema`: File validace (2MB, JPEG/PNG/WebP)
- `importRowSchema`: wine_name, vintage, quantity, purchase_date/price/currency

---

## 9. Komponenty

### `MaturityBar` (84 ř.)
- Props: `vintage`, `sommelierReview?`, `className?`
- Volá `computeMaturityStatus()` a `computeMaturityProgress()`
- Vizuální elementy: status badge, progress bar (barva dle statusu), peak zone overlay, datum grid
- Skrytá pro NV vína (year === 0)

### Layout: AppShell / Sidebar / MobileNav / MobileDrawer
- `AppShell`: `<aside>` se Sidebar (hidden mobile) + `<Outlet />` + MobileNav (hidden desktop)
- `Sidebar`: userNav (8 položek) + adminNav (6 položek) + user info + Odhlásit
- `MobileNav`: 5-item bottom tab bar, "Více" otevře MobileDrawer
- `MobileDrawer`: bottom sheet s backdrop, Historie/Reporty/Zprávy/Nastavení/Odhlásit

### UI (shadcn/ui)
Standardní shadcn/ui komponenty: Badge (custom!), Button, Card, Dialog, Input, Label, Select, Separator, Tabs, Textarea.

---

## 10. Build a konfigurace

### Vite (vite.config.ts)
- `@vitejs/plugin-react`
- Path alias: `@/` → `./src/`
- **manualChunks** (code splitting):
  - `vendor-react` → react, react-dom, react-router-dom
  - `vendor-ui` → 17× @radix-ui/*
  - `vendor-recharts` → recharts
  - `vendor-xlsx` → xlsx
  - `vendor-supabase` → @supabase/supabase-js
  - `vendor-forms` → react-hook-form, @hookform/resolvers, zod

### TypeScript (tsconfig.app.json)
- Target: ES2020, strict mode
- `noUnusedLocals: true`, `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- JSX: react-jsx
- Paths: `@/*` → `./src/*`

### Tailwind (tailwind.config.ts)
- darkMode: 'class'
- Custom barvy: `wine` (50–950), `gold` (DEFAULT/light/dark)
- Kompletní shadcn/ui CSS variable set
- Animace: accordion-down/up, fade-in
- Font: Inter + system-ui
- Plugin: tailwindcss-animate

---

## 11. Skripty

### `npm run validate` (validate.sh)
1. `tsc --noEmit` – TypeScript type checking
2. `npm run build` – production build
3. Scan src/pages/**/*.tsx pro stub stránky (< 10 řádků)

### `npm run pm` (pm-agent.mjs)
- Čte AGENTS.md, skenuje src/pages/ a supabase/functions/
- Posílá obsah do Gemini 2.5 Flash s retry (3 pokusy, 10/20s delay pro 429)
- Ukládá report do `pm-report.md`
- Čte GEMINI_API_KEY z `.env.local`

### `npm run wine-test` (wine-test.mjs)
- Testuje Gemini 2.5 Flash znalosti proti 97 slavným vínům
- Bez Google Search grounding (testuje raw model knowledge)
- Resume podpora: progress v `test-results/progress.json`
- Výsledky: 94% úspěšnost, 98% avg skóre, 0 chyb

### `npm run qa`
Kombinace: `validate.sh` + `pm-agent.mjs`

---

## 12. Konfigurace prostředí

### `.env.local`
```
VITE_SUPABASE_URL=https://fupzdgtncwmrdglmrwue.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (iat: Feb 2026)
GEMINI_API_KEY=AIzaSy... (pro lokální skripty, NENÍ v bundlu)
```

### Supabase Secrets (server-side)
```
GEMINI_API_KEY   – pro Edge Functions
SUPABASE_URL     – automaticky nastaveno
SUPABASE_SERVICE_ROLE_KEY – automaticky nastaveno
```

---

## 13. Známé problémy a workaroundy

### KRITICKÉ

| Problém | Workaround | Soubor |
|---------|-----------|--------|
| `supabase.functions.invoke()` posílá user JWT → 401 | Přímý `fetch()` s anon klíčem | `src/lib/gemini.ts` |
| `@radix-ui/react-badge` neexistuje | Custom `src/components/ui/badge.tsx` | badge.tsx |
| `@/components/ui/checkbox` neexistuje | Nativní `<input type="checkbox">` | AddWinePage.tsx |

### DŮLEŽITÉ

| Problém | Detail |
|---------|--------|
| Edge Function upsert | Nelze použít onConflict:'name' (constraint neexistuje). Použít SELECT → UPDATE/INSERT pattern |
| Edge Function `return handler()` | MUSÍ být `return await handler()` – bez await async chyby obejdou try/catch |
| SQL unaccent() | Potřebuje IMMUTABLE wrapper `immutable_unaccent()` pro GENERATED sloupce |
| TS strict | `noUnusedLocals: true` – žádné unused importy (error 6133) |
| Gemini modely | `gemini-2.5-flash` + `gemini-2.5-flash-lite` (2.0 verze deprecated) |
| Edge Function nasazení | Přes `npx supabase functions deploy gemini-wine-info --project-ref fupzdgtncwmrdglmrwue` |

---

## 14. Backlog (neimplementováno)

- Barcode scanner (@zxing/browser nainstalováno, UI placeholder)
- PWA (Service Worker)
- Email notifikace o zralosti
- Sdílení sklepa (read-only token – DB tabulka existuje, UI ne)
- Mapa sklepa (position_row/col/label v DB, UI ne)
- Dark mode (Tailwind darkMode: 'class' připraveno, toggle ne)

---

## 15. Závislosti (package.json)

### Production (21 balíčků)
```
@hookform/resolvers, @radix-ui/react-dialog, @radix-ui/react-label,
@radix-ui/react-select, @radix-ui/react-separator, @radix-ui/react-slot,
@radix-ui/react-tabs, @supabase/supabase-js, @zxing/browser,
class-variance-authority, clsx, date-fns, lucide-react, react,
react-dom, react-hook-form, react-router-dom, recharts, sonner,
tailwind-merge, xlsx, zod
```

### Dev (11 balíčků)
```
@types/react, @types/react-dom, @vitejs/plugin-react, autoprefixer,
postcss, supabase, tailwindcss, tailwindcss-animate, typescript,
vite, eslint (implicit)
```
