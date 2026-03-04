import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { cs } from 'date-fns/locale'
import type { MaturityStatus, Vintage, SommelierReview } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Formátování ──────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'CZK'): string {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd. M. yyyy', { locale: cs })
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'LLLL yyyy', { locale: cs })
}

export function formatRating(rating: number, max = 5): string {
  if (max === 5) return rating.toFixed(1)
  return `${Math.round(rating)}/100`
}

// ── Zralost ──────────────────────────────────────────────────

export function computeMaturityStatus(
  vintage: Vintage,
  sommelierReview?: SommelierReview | null
): MaturityStatus {
  const currentYear = new Date().getFullYear()

  // Sommelier review má přednost
  if (sommelierReview?.maturity_status) {
    return sommelierReview.maturity_status
  }

  const drinkFrom = sommelierReview?.drink_from_override ?? vintage.drink_from
  const drinkUntil = sommelierReview?.drink_until_override ?? vintage.drink_until
  const peakStart = sommelierReview?.peak_start_override ?? vintage.peak_start
  const peakEnd = sommelierReview?.peak_end_override ?? vintage.peak_end

  if (!drinkFrom || !drinkUntil) return 'can_drink'

  if (currentYear < drinkFrom) return 'too_young'
  if (currentYear > drinkUntil) return 'past_peak'

  if (peakStart && peakEnd) {
    if (currentYear >= peakStart && currentYear <= peakEnd) return 'ideal'
    if (currentYear > peakEnd && currentYear <= drinkUntil) return 'drink_soon'
    if (currentYear >= drinkFrom && currentYear < peakStart) return 'can_drink'
  }

  // Poslední 20% okna pitnosti = drink_soon
  const windowSize = drinkUntil - drinkFrom
  const drinkSoonStart = drinkUntil - Math.max(2, Math.floor(windowSize * 0.2))
  if (currentYear >= drinkSoonStart) return 'drink_soon'

  return 'can_drink'
}

export function computeMaturityProgress(
  vintage: Vintage,
  sommelierReview?: SommelierReview | null
): number {
  const currentYear = new Date().getFullYear()
  const drinkFrom = sommelierReview?.drink_from_override ?? vintage.drink_from
  const drinkUntil = sommelierReview?.drink_until_override ?? vintage.drink_until

  if (!drinkFrom || !drinkUntil) return 50

  if (currentYear <= drinkFrom) return 0
  if (currentYear >= drinkUntil) return 100

  return Math.round(((currentYear - drinkFrom) / (drinkUntil - drinkFrom)) * 100)
}

// ── Ceny / měny ──────────────────────────────────────────────

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount
  const key = `${fromCurrency}_${toCurrency}`
  const rate = rates[key]
  if (!rate) return amount
  return amount * rate
}

// ── Ostatní utility ──────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

export function normalizeWineName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/château/gi, 'chateau')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getImageUrl(url: string | null | undefined, fallback = '/wine-placeholder.svg'): string {
  if (!url) return fallback
  return url
}

export function pluralize(count: number, one: string, few: string, many: string): string {
  if (count === 1) return `${count} ${one}`
  if (count >= 2 && count <= 4) return `${count} ${few}`
  return `${count} ${many}`
}
