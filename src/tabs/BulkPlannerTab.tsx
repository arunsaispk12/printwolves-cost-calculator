// src/tabs/BulkPlannerTab.tsx
import { useCalculatorStore } from '@/store/calculatorStore'
import { useSettingsStore } from '@/store/settingsStore'
import { computeBulkTiers } from '@/engine/bulkPlanner'
import { formatINR } from '@/lib/formatters'
import { Zap } from 'lucide-react'

export function BulkPlannerTab() {
  const { result } = useCalculatorStore()
  const settings = useSettingsStore()

  if (!result) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Calculate a job in the Calculator tab first, then return here to see bulk pricing.
      </div>
    )
  }

  const gst_rate = settings.pricing_strategy.gst_rate_pct / 100
  const rows = computeBulkTiers(result.b2c_price_ex_gst, settings.volume_tiers, gst_rate)
  const bestRow = rows.find(r => r.is_best_value)

  return (
    <div className="p-6">
      <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-4">Bulk Pricing — All Tiers</p>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              {['Qty', 'Discount', 'Unit Price (ex-GST)', 'Total (ex-GST)', 'Total (inc-GST 18%)', 'You Save vs 1 unit'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {rows.map(row => (
              <tr
                key={row.qty}
                className={`${row.is_best_value ? 'bg-orange-950/20' : 'hover:bg-zinc-900/50'} transition-colors`}
              >
                <td className="px-4 py-3 font-semibold text-slate-200 tabular-nums">
                  {row.qty}
                  {row.is_best_value && (
                    <span className="ml-2 text-[10px] bg-orange-900/40 border border-orange-700/40 text-orange-400 px-1.5 py-0.5 rounded font-semibold">
                      Best Value
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.discount_pct > 0 ? (
                    <span className="text-[11px] bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                      {row.discount_pct}% off
                    </span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-200 tabular-nums">{formatINR(row.unit_price_ex_gst)}</td>
                <td className="px-4 py-3 text-slate-200 font-semibold tabular-nums">{formatINR(row.total_ex_gst)}</td>
                <td className="px-4 py-3 text-slate-200 font-semibold tabular-nums">{formatINR(row.total_inc_gst)}</td>
                <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums">
                  {row.saving_vs_one > 0 ? `+${formatINR(row.saving_vs_one)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bestRow && (
        <div className="mt-4 bg-zinc-800 border border-orange-800/40 rounded-lg p-4 flex gap-3">
          <Zap size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-400 mb-1">Smart Recommendation</p>
            <p className="text-xs text-slate-400">
              At <strong className="text-slate-200">{bestRow.qty} units</strong>, your effective unit cost is{' '}
              <strong className="text-slate-200">{formatINR(bestRow.unit_price_ex_gst)}</strong> and you save{' '}
              <strong className="text-emerald-400">{formatINR(bestRow.saving_vs_one)}</strong> vs. single-unit pricing.
              This is the best value batch for this job.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
