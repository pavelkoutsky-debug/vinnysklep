# Vinný Sklep – Changelog

Všechny významné změny v projektu jsou dokumentovány v tomto souboru.
Formát: [Semantic Versioning](https://semver.org/) – MAJOR.MINOR.PATCH

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
