# Multi-Agent Development Workflow – Vinný Sklep

## Přehled rolí

### 🎯 PM Agent (Project Manager)
**Script:** `npm run pm`
**Model:** Gemini 2.0 Flash + Google Search

**Zodpovědnosti:**
- Porovná aktuální stav kódu se specifikací
- Identifikuje chybějící nebo nedokončené funkce
- Prioritizuje další úkoly
- Zkontroluje kvalitu implementace
- Vytvoří report s doporučeními

**Kdy spustit:** Na začátku každé vývojové session a po dokončení fáze.

---

### 🔨 Dev Agent (Developer)
**Tool:** Claude Code (claude-sonnet-4-6)

**Zodpovědnosti:**
- Čte zadání z PM reportu nebo přímo od uživatele
- Plánuje implementaci (EnterPlanMode pro komplexní úkoly)
- Implementuje kód podle konvencí v CLAUDE.md
- Spouští QA po každém větším bloku práce

**Workflow:**
```
1. Přečíst PM report (pm-report.md)
2. Vybrat nejvyšší prioritu
3. Naplánovat implementaci
4. Implementovat
5. Spustit: npm run validate
6. Označit úkol jako hotový
```

---

### 🧪 QA Agent
**Script:** `npm run validate`

**Zodpovědnosti:**
- TypeScript check (žádné type errors)
- Build (produkční build musí projít)
- Detekce nepoužívaných importů
- Hlášení chyb s kontextem

---

## Vývojové fáze (z MEGA PROMPT v4)

### ✅ Fáze 0: Inicializace projektu
- [x] React + Vite + TypeScript + Tailwind + shadcn/ui
- [x] Supabase client konfigurace
- [x] Gemini 2.0 Flash integrace
- [x] SQL migrace – kompletní schema

### ✅ Fáze 1: Auth + základní navigace
- [x] Login / Register / Reset hesla
- [x] Auth context (useAuth hook)
- [x] App shell (Sidebar, MobileNav)
- [x] Protected/Admin/Guest routes
- [x] Dashboard (přehled, urgentní vína)

### ✅ Fáze 2: Sklep + detail
- [x] CellarPage (grid/list, filtry, vyhledávání)
- [x] WineDetailPage (info, zralost, sommelier, odebrat/přidat)
- [x] AddWinePage (Gemini vyhledávání + ruční přidání)
- [x] MaturityBar komponenta

### ✅ Fáze 3: Statistiky + historie
- [x] StatisticsPage (pie chart barvy, bar chart země/ročník, zralost)
- [x] HistoryPage (timeline pohybů po dnech)

### ✅ Fáze 4: Admin
- [x] AdminDashboardPage
- [x] AdminUsersPage (seznam uživatelů s počtem lahví)
- [x] AdminUserCellarPage (pohled do cizího sklepa)
- [x] AdminCatalogPage (databáze vín)
- [x] AdminReviewsPage (sommelier hodnocení formulář)
- [x] AdminMessagesPage (odeslat zprávu uživatelům)

### ✅ Fáze 5: Nastavení + zprávy
- [x] SettingsPage (profil, měna, reset hesla)
- [x] MessagesPage (inbox s auto-mark as read)

### ✅ Fáze 6: Edge Functions (backend AI)
- [x] `supabase/functions/gemini-wine-info/index.ts` – nasazena (gemini-2.5-flash + food-pairing)
- [x] `supabase/functions/exchange-rates/index.ts` – nasazena (ECB kurzy)
- [x] Supabase CLI nainstalováno, projekt propojen (`fupzdgtncwmrdglmrwue`)
- [x] Gemini klíč v Supabase Secrets, odstraněn z JS bundlu
- [x] Frontend volá Gemini výhradně přes Edge Function (`supabase.functions.invoke()`)

### ✅ Fáze 7: Pokročilé funkce (částečně)
- [x] ReportsPage – export Excel (.xlsx) + PDF (tisk)
- [ ] Barcode scanner (@zxing/browser) – v backlogu
- [ ] Import z Excelu – v backlogu
- [ ] Sdílení sklepa (read-only token) – v backlogu
- [ ] Email notifikace o zralosti – v backlogu

### ✅ Fáze 8: Optimalizace (částečně)
- [x] Code splitting (React.lazy + Suspense + Vite manualChunks)
- [ ] PWA (Service Worker)
- [ ] Performance optimalizace

---

## Jak PM agent pracuje

```
scripts/pm-agent.mjs
      │
      ├─ 1. Načte AGENTS.md (aktuální stav fází)
      ├─ 2. Prohledá src/pages/ (implementované vs. stub soubory)
      ├─ 3. Zkontroluje supabase/functions/
      ├─ 4. Odešle vše Gemini s otázkou:
      │       "Jaké jsou priority pro další sprint?
      │        Co chybí? Kde jsou rizika?"
      └─ 5. Uloží report do pm-report.md
```

---

## Sprint planning

### Sprint 3 – DOKONČENO ✅
- Edge Functions nasazeny (gemini-wine-info + exchange-rates)
- ReportsPage – Excel export + PDF tisk
- Gemini API klíč bezpečně v Supabase Secrets
- Code splitting (React.lazy + manualChunks)

### Aktuální sprint (Sprint 4)
**Cíl:** Produkční stabilita + UX vylepšení

**Úkoly (prioritizováno):**
1. ~~Wine test (`npm run wine-test`)~~ ✅ HOTOVO – 94% úspěšnost, 98% avg skóre, 0 chyb
2. ~~RLS audit~~ ✅ HOTOVO – všechny tabulky mají RLS + správné politiky
3. ~~Pohyby – fix: `cellar_item_id` je prázdný string~~ ✅ HOTOVO – opraveno v AddWinePage
4. Vylepšení UX AddWinePage – lepší error feedback
5. Import z Excelu – bulk přidání vín

### Backlog
- Barcode scanner
- Email notifikace
- PWA
- Vizuální mapa sklepa (optional)
