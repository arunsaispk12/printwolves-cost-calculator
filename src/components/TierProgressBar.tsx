import type { TierProgressBarProps } from '@/types'
import { formatINR } from '@/lib/formatters'

export function TierProgressBar({ tiers, currentQty, baseUnitPrice, theme, onSuggestionClick }: TierProgressBarProps) {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty)
  const maxQty = sorted[sorted.length - 1].min_qty

  const activeTier = [...sorted].reverse().find(t => currentQty >= t.min_qty) ?? sorted[0]
  const nextTier = sorted.find(t => t.min_qty > currentQty)

  const progressPct = Math.min((currentQty / maxQty) * 100, 100)

  const isDark = theme === 'dark'

  const containerClass = isDark
    ? 'bg-slate-800 border border-slate-700 rounded-lg p-3'
    : 'bg-green-50 border border-green-200 rounded-lg p-3'

  const labelClass = isDark ? 'text-slate-400' : 'text-slate-600'
  const badgeClass = isDark
    ? 'bg-blue-900/30 border border-blue-700 text-blue-300'
    : 'bg-green-100 border border-green-400 text-green-700'
  const tipClass = isDark ? 'text-amber-400' : 'text-green-700'
  const trackClass = isDark ? 'bg-slate-700' : 'bg-green-200'
  const fillGradient = isDark
    ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
    : 'linear-gradient(90deg, #16a34a, #22c55e)'
  const markerClass = isDark ? 'text-slate-500' : 'text-slate-400'

  const unitSaving = nextTier
    ? baseUnitPrice * (nextTier.discount_pct - activeTier.discount_pct) / 100
    : 0

  return (
    <div className={containerClass}>
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs ${labelClass}`}>
          {currentQty} unit{currentQty !== 1 ? 's' : ''} — {activeTier.discount_pct === 0 ? 'No discount' : `${activeTier.discount_pct}% off`}
        </span>
        {nextTier && (
          <button
            onClick={() => onSuggestionClick?.(nextTier.min_qty)}
            className={`text-xs px-2 py-0.5 rounded border font-semibold ${badgeClass}`}
          >
            Next: {nextTier.min_qty} units ({nextTier.discount_pct}% off)
          </button>
        )}
      </div>

      {/* Track */}
      <div className={`relative h-1.5 ${trackClass} rounded-full mb-1.5`}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressPct}%`, background: fillGradient }}
        />
        {sorted.map(t => (
          <div
            key={t.min_qty}
            className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-slate-400"
            style={{ left: `${(t.min_qty / maxQty) * 100}%` }}
          />
        ))}
      </div>

      {/* Qty labels */}
      <div className={`flex justify-between text-[10px] ${markerClass} mb-1.5`}>
        {sorted.map(t => (
          <span key={t.min_qty}>{t.min_qty}</span>
        ))}
      </div>

      {nextTier && (
        <p className={`text-xs ${tipClass}`}>
          Add <strong>{nextTier.min_qty - currentQty} more</strong> to unlock {nextTier.discount_pct}% off
          — save {formatINR(unitSaving)} per unit
        </p>
      )}
    </div>
  )
}
