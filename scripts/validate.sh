#!/bin/bash
# =====================================================
# QA Agent – automatická validace projektu
# Spusť: npm run validate
# =====================================================

set -e  # Zastaví se při první chybě

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}══════════════════════════════════${NC}"
echo -e "${BLUE}  🧪 QA Agent – Vinný Sklep        ${NC}"
echo -e "${BLUE}══════════════════════════════════${NC}\n"

cd "$(dirname "$0")/.."

# ── 1. TypeScript check ────────────────────────────
echo -e "${YELLOW}[1/3] TypeScript check...${NC}"
if npx tsc --noEmit 2>&1; then
  echo -e "${GREEN}✅ TypeScript: OK${NC}\n"
else
  echo -e "${RED}❌ TypeScript chyby! Oprav je před pokračováním.${NC}\n"
  exit 1
fi

# ── 2. Produkční build ─────────────────────────────
echo -e "${YELLOW}[2/3] Produkční build...${NC}"
if npm run build 2>&1 | tail -5; then
  echo -e "\n${GREEN}✅ Build: OK${NC}\n"
else
  echo -e "\n${RED}❌ Build selhal!${NC}\n"
  exit 1
fi

# ── 3. Kontrola stub stránek ───────────────────────
echo -e "${YELLOW}[3/3] Kontrola implementace stránek...${NC}"

STUB_COUNT=0
for file in src/pages/**/*.tsx src/pages/*.tsx; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file")
    if [ "$LINES" -lt 10 ]; then
      echo -e "  ${YELLOW}⚠️  Stub: $file ($LINES řádků)${NC}"
      STUB_COUNT=$((STUB_COUNT + 1))
    fi
  fi
done

if [ "$STUB_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ Žádné stub stránky${NC}"
else
  echo -e "${YELLOW}⚠️  $STUB_COUNT stub stránek nalezeno (viz výše)${NC}"
fi

# ── Shrnutí ────────────────────────────────────────
echo -e "\n${BLUE}══════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ QA validace dokončena         ${NC}"
echo -e "${BLUE}══════════════════════════════════${NC}\n"
