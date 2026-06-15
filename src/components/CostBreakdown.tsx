import type { PricingResult } from '@/types'
import { formatINR } from '@/lib/formatters'

interface Props { result: PricingResult }

const rows: { label: string; key: keyof PricingResult['breakdown'] }[] = [
  { label: 'Material', key: 'material_cost' },
  { label: 'Electricity', key: 'energy_cost' },
  { label: 'Machine (deprec + maint)', key: 'depreciation_cost' },
  { label: 'Maintenance', key: 'maintenance_cost' },
  { label: 'Labor — Setup', key: 'setup_labor_cost' },
  { label: 'Labor — Monitoring', key: 'monitoring_labor_cost' },
  { label: 'Post-Processing', key: 'post_proc_labor_cost' },
  { label: 'Failure Buffer', key: 'failure_buffer' },
]

export function CostBreakdown({ result }: Props) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3">Live Cost Breakdown</p>
      <div>
        {rows.map(({ label, key }) => {
          const value = result.breakdown[key]
          if (value === 0) return null
          return (
            <div key={key} className="flex justify-between py-2 border-b border-zinc-800 text-sm">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-200 tabular-nums">{formatINR(value)}</span>
            </div>
          )
        })}
        <div className="flex justify-between py-2 border-b border-zinc-700 text-sm font-semibold">
          <span className="text-slate-300">Production Cost</span>
          <span className="text-white tabular-nums">{formatINR(result.breakdown.production_cost)}</span>
        </div>
      </div>

      {/* Sell Price Card */}
      <div className="mt-3 p-3 rounded-lg bg-orange-950/30 border border-orange-800/40 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">B2C Unit Price (ex-GST)</p>
          <p className="text-2xl font-extrabold text-orange-400 tabular-nums">{formatINR(result.b2c_price_ex_gst)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Margin</p>
          <p className={`text-xl font-bold tabular-nums ${
            result.margin_status === 'healthy' ? 'text-emerald-400' :
            result.margin_status === 'warning' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {result.actual_margin_pct.toFixed(1)}%
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            result.margin_status === 'healthy' ? 'bg-emerald-900/40 text-emerald-400' :
            result.margin_status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' :
            'bg-red-900/40 text-red-400'
          }`}>
            {result.margin_status === 'healthy' ? 'Healthy' :
             result.margin_status === 'warning' ? 'Caution' : 'Below Min'}
          </span>
        </div>
      </div>
    </div>
  )
}
