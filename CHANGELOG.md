# Vinný Sklep – Changelog

Všechny významné změny v projektu jsou dokumentovány v tomto souboru.
Formát: [Semantic Versioning](https://semver.org/) – MAJOR.MINOR.PATCH

---

## [0.9.0] – 2026-03-04

### Přidáno
- **Automatické fotky lahví**: Při vyhledávání vína přes Gemini AI se automaticky stáhne fotka lahve
  - Gemini s Google Search grounding najde URL fotky (preferuje konkrétní ročník, fallback na jiný ročník)
  - Edge Function stáhne obrázek server-side a uloží do Supabase Storage (bucket `wine-images`)
  - Fotka se zobrazí v search result (AddWinePage), grid/list view (CellarPage), detail (WineDetailPage)
  - Fail-safe: při jakékoliv chybě stahování se víno uloží bez fotky (Wine ikona jako fallback)
- **Supabase Storage bucket** `wine-images`: public read, service_role write, 2MB limit, JPEG/PNG/WebP

### Změněno
- `GeminiWineData.image_search_hint` přejmenováno na `image_url`
- Gemini prompt rozšířen o požadavek na `image_url` – přímý odkaz na fotografii lahve
- CellarPage WineListRow nyní zobrazuje fotku lahve (dříve jen Wine ikona)

### Soubory
- `supabase/migrations/004_wine_images_storage.sql` – NOVÝ: Storage bucket + RLS policies
- `supabase/functions/gemini-wine-info/index.ts` – nová funkce `fetchAndStoreWineImage()`, rozšířený prompt, integrace do `handleWineInfo`
- `src/lib/gemini.ts` – `image_search_hint` → `image_url` v interface + mapping
- `src/pages/AddWinePage.tsx` – náhled fotky v search result
- `src/pages/CellarPage.tsx` – image v WineListRow + rozšířený type cast

### Migrace
- `004_wine_images_storage.sql` – Storage bucket `wine-images` + RLS policies

---

## [0.8.0] – 2026-03-04

### Základ (initial release)
Kompletní funkční aplikace zahrnující:

- **Auth**: Login, registrace (30-user limit), reset hesla
- **Sklep**: CRUD, grid/list view, filtry, řazení, NV vína
- **AI**: Gemini 2.5 Flash vyhledávání vín + Google Search grounding
- **Detail vína**: Maturity bar, senzorický profil, expert hodnocení, historie vinařství, food pairing AI
- **Pohyby**: Přidání/odebrání lahví s důvodem, hodnocením, food pairing
- **Statistiky**: 4 grafy (barva, země, ročník, zralost) – Recharts
- **Historie**: Timeline posledních 200 pohybů
- **Reporty**: Excel import (s AI na pozadí), Excel export (3 listy), PDF export
- **Zprávy**: Admin → uživatel inbox
- **Admin**: Dashboard, uživatelé, katalog, sommelier hodnocení, zprávy
- **Edge Functions**: gemini-wine-info (3 akce), exchange-rates
- **DB**: 13 tabulek, RLS na všech, 3 migrace
- **Build**: Code splitting (7 vendor chunků), lazy loading, TypeScript strict

### Známé workaroundy
- Edge Functions volány přes přímý `fetch()` s anon klíčem (ne `supabase.functions.invoke()`)
- `@radix-ui/react-badge` neexistuje → custom `badge.tsx`
- `@/components/ui/checkbox` neexistuje → nativní `<input type="checkbox">`

### Dokumentace
- `docs/VERSION-0.8.md` – technická dokumentace
- `docs/SPEC-0.8.md` – funkční specifikace

---

<!-- TEMPLATE pro nové záznamy:

## [X.Y.Z] – YYYY-MM-DD

### Přidáno
- Nové funkce

### Změněno
- Změny v existujících funkcích

### Opraveno
- Bug fixy

### Odstraněno
- Odebrané funkce

### Soubory
- `cesta/k/souboru.ts` – popis změny

### Migrace
- `NNN_popis.sql` – popis DB změny (pokud relevantní)

-->
