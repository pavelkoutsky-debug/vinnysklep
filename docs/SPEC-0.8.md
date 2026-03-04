# Vinný Sklep – Funkční specifikace v0.8

> Datum: 2026-03-04
> Cílová skupina: 1 admin (sommelier) + max 29 uživatelů
> Jazyk UI: čeština

---

## 1. Přehled aplikace

Webová aplikace pro správu osobního vinného sklepa. Uživatel eviduje svá vína (lahve), sleduje jejich zralost, přidává nová vína s pomocí AI, prohlíží statistiky a historii pohybů. Admin (sommelier) má přístup ke správě uživatelů, katalogu vín a může přidávat expertní hodnocení.

---

## 2. Role a oprávnění

| Role | Popis | Přístup |
|------|-------|---------|
| **user** | Běžný uživatel | Vlastní sklep, statistiky, historie, zprávy, nastavení |
| **admin** | Sommelier/správce | Vše jako user + admin sekce (uživatelé, katalog, hodnocení, zprávy) |

Admin je identifikován emailem `pavel.koutsky@gmail.com` (nastaveno v DB i frontendovém kódu).

---

## 3. Autentizace

### 3.1 Registrace
- Vstup: jméno (min 2 znaky), email, heslo (min 8 znaků, 1 velké, 1 číslo), potvrzení hesla
- Limit: max 30 uživatelů celkem
- Automatické potvrzení emailu (mailer_autoconfirm: true)
- Automatické přiřazení role (admin pro admin email, jinak user)

### 3.2 Přihlášení
- Email + heslo
- Supabase Auth (JWT, 1h expirace, auto-refresh)

### 3.3 Reset hesla
- Uživatel zadá email → obdrží reset link
- Po kliknutí na link: formulář pro nové heslo
- Automatické přesměrování po úspěšné změně

---

## 4. Dashboard (/)

### Co uživatel vidí
- **4 statistické karty**:
  - Celkem lahví (součet quantity > 0)
  - Unikátních vín (počet cellar_items s quantity > 0)
  - Nákupní hodnota (součet purchase_price × quantity, v preferované měně)
  - Odhadovaná hodnota (součet price_eur × quantity, konvertováno)
- **Doporučujeme vypít**: Seznam vín se statusem `ideal` nebo `drink_soon`, seřazených od nejurgentnějších. Zobrazuje MaturityBar, informace o víně, odkaz na detail.
- **Poslední přidaná vína**: 5 nejnovějších cellar_items s basic info.

---

## 5. Můj sklep (/cellar)

### Funkce
- **Vyhledávání**: fulltextové hledání v názvu vína, vinařství, regionu, zemi (client-side)
- **Filter**: podle barvy vína (select: Červené, Bílé, Rosé, atd.)
- **Řazení**: podle názvu, ročníku, ceny, počtu lahví
- **Zobrazení**: přepínání grid (karty) ↔ list (řádky)

### Karta vína (grid view)
- Název vína, vinařství
- Ročník (nebo "NV" pro Non-Vintage)
- Barva badge
- Počet lahví
- MaturityBar (indikátor zralosti)

### Řádek vína (list view)
- Kompaktní zobrazení: název, ročník, barva, počet, lokace

### Chování
- Klik na víno → `/cellar/:id` (detail)
- URL parametry zachovávají stav filtrů: `?q=`, `?color=`, `?sort=`
- Zobrazují se pouze cellar_items s quantity > 0

---

## 6. Přidat víno (/cellar/add)

### Krok 1: Vyhledání vína
1. Uživatel zadá název vína (povinné)
2. Zadá ročník NEBO zaškrtne "Bez ročníku (NV)"
3. Klik na "Vyhledat s Gemini AI"
4. Gemini AI vyhledá víno přes Google Search grounding
5. **Nalezeno**: zobrazí se nalezená data:
   - Vinařství, země, region, apelace
   - Barva, odrůdy, alkohol
   - Popis česky
   - Confidence badge (high/medium/low)
   - Doporučené pití, vrchol zralosti
6. **Nenalezeno**: zobrazí se manuální formulář (barva a země povinné)

### Krok 2: Skladové údaje
- Počet lahví (1–9999, povinné)
- Nákupní cena (volitelné)
- Měna (CZK/EUR/USD)
- Datum nákupu (volitelné)
- Umístění ve sklepě (volitelné)
- Poznámky (volitelné)

### Uložení do DB
1. Wine: lookup existujícího (ilike name) → update NEBO insert
2. Vintage: upsert (wine_id + year)
3. CellarItem: insert (user_id, vintage_id, quantity, price...)
4. Movement: insert (type='add', reason='purchase')

---

## 7. Detail vína (/cellar/:id)

### Hlavní informace
- Název vína, vinařství, ročník/NV
- Barva badge, confidence badge
- Apelace, odrůdy, alkohol, klasifikace
- Popis česky
- Počet lahví, umístění, nákupní cena/datum
- Osobní hodnocení

### Indikátor zralosti (MaturityBar)
- Vizuální progress bar s barevným kódováním:
  - Zelená: příliš mladé
  - Žluto-zelená: lze pít
  - Žlutá: ideální zralost
  - Oranžová: brzy vypít
  - Červená: přezrálé
- Žlutá zóna = peak (vrchol)
- Labels: "Doporučené pití YYYY–YYYY", "Vrchol YYYY–YYYY"
- Skrytý pro NV vína

### Sommelier hodnocení (admin)
- Žlutě ohraničená karta (pokud existuje)
- Rating (0–100), degustační poznámky, doporučení
- Přepisuje automatická maturity data

### Senzorický profil
- 3 vizuální bary: Tělo (light/medium/full), Tanniny (low/medium/high), Kyselost (low/medium/high)
- Textové popisy: Aroma, Chuť, Doznívání
- Podmíněně zobrazeno (jen pokud data existují)

### Expert hodnocení
- Badge s průměrem (0–100)
- Detail text: "Decanter: 95, WS: 93, WA: 96"

### Historie vinařství
- 2–3 věty česky o historii vinařství
- Podmíněně zobrazeno

### AI food pairing
- Tlačítko "Doporučit párování s jídlem"
- Generuje 2 věty česky přes Gemini AI
- Zobrazí se po kliknutí

### Obnovit AI data
- Tlačítko pro on-demand enrichment (sensory profile, winery history, expert ratings)
- Zobrazí se jen pokud chybí enriched data

### Akce

#### Odebrat lahve
- Počet (1 – aktuální quantity)
- Důvod: Vypito, Darováno, Prodáno, Rozbito, Jiné
- Datum
- Hodnocení konzumace (0–100, volitelné)
- S jakým jídlem párováno (volitelné)
- Poznámky (volitelné)
- → Sníží quantity, vytvoří movement (type='remove')

#### Přidat lahve
- Počet (1–9999)
- Důvod: Nákup, Obdržený dar, Jiné
- Nákupní cena (volitelné)
- Měna
- Poznámky
- → Zvýší quantity, vytvoří movement (type='add')

#### Upravit záznam
- Nákupní cena/datum
- Umístění ve sklepě
- Osobní hodnocení (0–100)
- Poznámky

### Externí odkazy
- Vivino (pokud vivino_url existuje)
- VinnyShop.cz (pokud vinnyshop_url existuje)

---

## 8. Statistiky (/statistics)

### Souhrn (4 karty)
- Celkem lahví
- Unikátních vín
- Odhadovaná hodnota (v preferované měně)
- Průměrné osobní hodnocení

### Grafy (tabs)

#### Barva (PieChart)
- Počet lahví per barva
- Custom label: procento na řezu
- Barevné swatches odpovídají barvě vína

#### Země (BarChart)
- Top 8 zemí podle počtu lahví
- Horizontální bars

#### Ročník (BarChart)
- Distribuce lahví po ročnících
- NV vína zobrazena jako "NV" na ose

#### Zralost (custom)
- Progress bar per maturity status
- Počet lahví v každém statusu

---

## 9. Historie (/history)

- Posledních 200 pohybů (movements)
- Seskupeno po dnech (sestupně)
- Timeline layout s +/- ikonami
- Informace: název vína, ročník, důvod pohybu, hodnocení konzumace, párované jídlo, poznámky

---

## 10. Reporty (/reports)

### Import z Excelu
1. Nahrání Excel souboru (.xlsx)
2. Automatická detekce sloupců:
   - Podporované hlavičky (CZ): "Název vína", "Ročník", "Počet lahví", "Datum nákupu", "Nákupní cena"
   - Podporované hlavičky (EN): "Wine Name", "Vintage", "Quantity", "Purchase Date", "Purchase Price"
   - Case-insensitive, normalizované
3. Preview tabulka s validací
4. Import s progress barem:
   - Sekvenční zpracování řádek po řádku
   - Pro každý řádek: Gemini AI vyhledání → upsert wine/vintage → insert cellar_item + movement
5. Výsledkové shrnutí: X úspěšně, Y selhalo
6. Stažení šablony (prázdný Excel s správnými sloupci)

### Export do Excelu
- 3 listy:
  - **Sklep**: všechny cellar_items s wine info
  - **Historie**: všechny movements
  - **Souhrn**: statistiky (celkem lahví, hodnota, apod.)

### Export do PDF
- Generuje formátované HTML → otevře print dialog
- Obsahuje: název, ročník, barva, počet, cena, umístění

---

## 11. Zprávy (/messages)

- Inbox zpráv od admina
- Typy zpráv: Aktualita (blue), Akce (purple), Doporučení (yellow), Systémová (gray)
- Badge nepřečtených zpráv
- Klik → rozbalení obsahu → automatické označení jako přečtené

---

## 12. Nastavení (/settings)

- **Profil**: úprava jména, preferovaná měna (CZK/EUR/USD)
- **Zabezpečení**: odeslání reset emailu pro změnu hesla
- **Informace**: role (user/admin), datum registrace

---

## 13. Admin sekce (/admin/*)

### Admin Dashboard (/admin)
- Statistiky: počet uživatelů (x/30), vína v katalogu, celkový počet lahví
- Quick-link karty do všech admin sekcí

### Správa uživatelů (/admin/users)
- Seznam všech profilů
- Info: jméno, email, počet lahví, datum registrace, admin ikona
- Proklik na prohlížení cizího sklepa

### Prohlížení sklepa (/admin/users/:userId/cellar)
- Read-only zobrazení libovolného uživatelského sklepa
- Všechny cellar_items (i s quantity=0)

### Katalog vín (/admin/catalog)
- Procházení sdíleného wine katalogu (prvních 100)
- Client-side vyhledávání
- Data source badge: gemini (purple), vinnyshop (green), manual (gray), ai (blue)

### Expertní hodnocení (/admin/reviews)
- Seznam všech sommelier_reviews s info o víně
- **Přidat nové hodnocení**:
  - Výběr vintage (vyhledávání)
  - Datum degustace
  - Rating (0–100)
  - Degustační poznámky
  - Doporučení
  - Maturity status override
  - Drink window override (drink_from, drink_until, peak_start, peak_end)
- Upsert: jedno hodnocení na ročník (UNIQUE vintage_id)
- Hodnocení sommeliera přepisuje automatická data v celé aplikaci

### Správa zpráv (/admin/messages)
- Odeslání zprávy: všem (broadcast) nebo konkrétnímu uživateli
- Typ zprávy: Aktualita, Akce, Doporučení, Systémová
- Předmět + obsah

---

## 14. AI integrace (Gemini 2.5 Flash)

### Vyhledání vína
- **Vstup**: název vína + ročník (nebo NV)
- **Model**: Gemini 2.5 Flash + Google Search grounding
- **Výstup**: strukturovaný JSON se všemi údaji o víně
- **Cache**: 30 dní v DB (cache_expires_at)
- **Fallback**: gemini-2.5-flash-lite, pak bez grounding

### On-demand enrichment
- **Vstup**: wineId + vintageId + metadata
- **Výstup**: sensory_profile (JSONB), winery_history_cs, expert_rating_avg/text
- **Trigger**: tlačítko "Obnovit AI data" na WineDetailPage

### Food pairing
- **Vstup**: název, ročník, barva, region
- **Výstup**: 2 věty česky
- **Cache**: žádný

### Kvalita dat
- wine-test výsledky: 94% úspěšnost, 98% avg skóre (97 vín)
- Confidence badge: high (zelená), medium (žlutá), low (červená)

---

## 15. Multi-currency

- Podporované měny: CZK, EUR, USD
- Uživatelská preference: `preferred_currency` v profilu
- Směnné kurzy: `exchange_rates` tabulka, aktualizováno Edge Function z ECB
- Konverze: `convertCurrency()` v utils.ts
- Použití: nákupní cena (input v libovolné měně), statistiky (zobrazení v preferované)

---

## 16. Non-Vintage (NV) vína

- **Sentinel**: `vintages.year = 0`
- **DB**: CHECK constraint povoluje year=0 OR (1900–2200)
- **Frontend**: zobrazuje "NV" místo "0" všude (CellarPage, Dashboard, Statistics, WineDetail)
- **AddWinePage**: checkbox "Bez ročníku (NV)" → skryje ročník input
- **Maturity**: MaturityBar skrytá pro NV (nemají drink window)
- **Statistiky**: NV jako samostatný bucket v grafu ročníků

---

## 17. Zabezpečení

### Row Level Security (RLS)
Každá tabulka má RLS povolené. Klíčové politiky:
- **cellar_items, movements**: jen vlastní data (user_id = auth.uid()) + admin
- **wines, vintages**: čtení pro autentizované, zápis admin + autentizovaní (wines insert)
- **sommelier_reviews**: čtení public, zápis jen admin
- **admin_messages**: čtení: recipient/broadcast/admin, zápis admin
- **exchange_rates, app_config**: čtení public, zápis admin

### Edge Functions
- GEMINI_API_KEY pouze v Supabase Secrets (nikdy v JS bundlu)
- Edge Functions používají SUPABASE_SERVICE_ROLE_KEY pro DB operace
- CORS: povolený pro všechny originy (Access-Control-Allow-Origin: *)

### Frontend
- Heslo: min 8 znaků, 1 uppercase, 1 číslo
- User limit: max 30 registrací
- JWT auto-refresh přes Supabase client

---

## 18. Backlog (budoucí funkce)

| Funkce | Stav | Detail |
|--------|------|--------|
| Barcode scanner | Knihovna nainstalovaná (@zxing/browser), UI placeholder | Sken EAN kódu → vyhledání vína |
| PWA | Nepřipraveno | Service Worker, offline mode, install prompt |
| Email notifikace | Nepřipraveno | Upozornění na blížící se drink_until |
| Sdílení sklepa | DB tabulka existuje (cellar_shares), UI ne | Read-only link s tokenem |
| Mapa sklepa | DB sloupce existují (position_*), UI ne | Vizuální rozmístění lahví |
| Dark mode | Tailwind připraveno (darkMode: 'class'), toggle ne | Přepínač světlý/tmavý režim |
| Multijazyčnost | Nepřipraveno | i18n, překlad do dalších jazyků |
