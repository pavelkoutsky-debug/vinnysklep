import { cn } from '@/lib/utils'
import { computeMaturityProgress, computeMaturityStatus } from '@/lib/utils'
import { MATURITY_LABELS, MATURITY_COLORS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import type { Vintage, SommelierReview } from '@/types/database'

interface MaturityBarProps {
  vintage: Vintage
  sommelierReview?: SommelierReview | null
  className?: string
}

export function MaturityBar({ vintage, sommelierReview, className }: MaturityBarProps) {
  const status = computeMaturityStatus(vintage, sommelierReview)
  const progress = computeMaturityProgress(vintage, sommelierReview)

  const drinkFrom = sommelierReview?.drink_from_override ?? vintage.drink_from
  const drinkUntil = sommelierReview?.drink_until_override ?? vintage.drink_until
  const peakStart = sommelierReview?.peak_start_override ?? vintage.peak_start
  const peakEnd = sommelierReview?.peak_end_override ?? vintage.peak_end

  const barColors: Record<typeof status, string> = {
    too_young: 'bg-green-500',
    can_drink: 'bg-lime-500',
    ideal: 'bg-yellow-500',
    drink_soon: 'bg-orange-500',
    past_peak: 'bg-red-500',
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Zralost</span>
        <Badge className={cn('text-xs font-medium', MATURITY_COLORS[status])} variant="outline">
          {MATURITY_LABELS[status]}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', barColors[status])}
            style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
          />
        </div>
        {/* Peak zone indicator */}
        {peakStart && peakEnd && drinkFrom && drinkUntil && (
          <div
            className="absolute top-0 h-3 rounded-full bg-yellow-300/40 border border-yellow-400/60"
            style={{
              left: `${Math.max(0, ((peakStart - drinkFrom) / (drinkUntil - drinkFrom)) * 100)}%`,
              width: `${Math.min(100, ((peakEnd - peakStart) / (drinkUntil - drinkFrom)) * 100)}%`,
            }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Příliš mladé</span>
        <span className="font-medium text-yellow-600">Vrchol</span>
        <span>Přezrálé</span>
      </div>

      {/* Dates */}
      {drinkFrom && drinkUntil && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Doporučené pití</p>
            <p className="font-medium">{drinkFrom} – {drinkUntil}</p>
          </div>
          {peakStart && peakEnd && (
            <div>
              <p className="text-xs text-muted-foreground">Vrchol</p>
              <p className="font-medium text-yellow-600">{peakStart} – {peakEnd}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
