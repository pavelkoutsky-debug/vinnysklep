import type { WineColor, MaturityStatus, MovementReason, MessageType } from '@/types/database'

export const APP_LIMITS = {
  MAX_USERS: 30,
  MAX_BOTTLES_PER_USER: Infinity,
  MAX_IMAGE_SIZE_MB: 2,
  MAX_IMPORT_ROWS: 1000,
  SUPPORTED_CURRENCIES: ['CZK', 'EUR', 'USD'] as const,
  DEFAULT_CURRENCY: 'CZK',
  WINE_CACHE_DAYS: 30,
} as const

export const ADMIN_EMAIL = 'pavel.koutsky@gmail.com'

export const WINE_COLORS: Record<WineColor, string> = {
  red: 'Červené',
  white: 'Bílé',
  rose: 'Rosé',
  orange: 'Oranžové',
  sparkling: 'Šumivé',
  dessert: 'Dezertní',
  fortified: 'Fortifikované',
}

export const MATURITY_LABELS: Record<MaturityStatus, string> = {
  too_young: 'Příliš mladé',
  can_drink: 'Lze pít',
  ideal: 'Ideální zralost',
  drink_soon: 'Brzy vypít',
  past_peak: 'Přezrálé',
}

export const MATURITY_COLORS: Record<MaturityStatus, string> = {
  too_young: 'text-green-600 bg-green-50',
  can_drink: 'text-lime-600 bg-lime-50',
  ideal: 'text-yellow-600 bg-yellow-50',
  drink_soon: 'text-orange-600 bg-orange-50',
  past_peak: 'text-red-600 bg-red-50',
}

export const MATURITY_DOT_COLORS: Record<MaturityStatus, string> = {
  too_young: 'bg-green-500',
  can_drink: 'bg-lime-500',
  ideal: 'bg-yellow-500',
  drink_soon: 'bg-orange-500',
  past_peak: 'bg-red-500',
}

export const MOVEMENT_REASONS: Record<MovementReason, string> = {
  purchase: 'Nákup',
  gift_received: 'Obdržený dar',
  consumed: 'Vypito',
  gift_given: 'Darováno',
  sold: 'Prodáno',
  broken: 'Rozbito',
  import: 'Import',
  other: 'Jiné',
}

export const MESSAGE_TYPES: Record<MessageType, string> = {
  news: 'Aktualita',
  event: 'Akce',
  recommendation: 'Doporučení',
  system: 'Systémová zpráva',
}

export const WINE_COLOR_SWATCHES: Record<WineColor, string> = {
  red: '#722F37',
  white: '#F5E6D3',
  rose: '#FFB6C1',
  orange: '#E8945A',
  sparkling: '#C8D8E8',
  dessert: '#D4A574',
  fortified: '#8B4513',
}

export const COUNTRIES_CS: Record<string, string> = {
  FR: 'Francie',
  IT: 'Itálie',
  ES: 'Španělsko',
  PT: 'Portugalsko',
  DE: 'Německo',
  AT: 'Rakousko',
  CZ: 'Česká republika',
  SK: 'Slovensko',
  HU: 'Maďarsko',
  US: 'USA',
  AR: 'Argentina',
  CL: 'Chile',
  AU: 'Austrálie',
  NZ: 'Nový Zéland',
  ZA: 'Jižní Afrika',
}
