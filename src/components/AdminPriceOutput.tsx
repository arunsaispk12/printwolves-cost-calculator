import type { PricingResult } from '@/types'
import { formatINR } from '@/lib/formatters'
import { Copy } from 'lucide-react'

interface Props { result: PricingResult }

interface OutputField {
  label: string
  sublabel: string
  value: number
  highlight?: boolean
}

function CopyButton({ value }: { value: number }) {
  const copy = () => navigator.clipboard.writeText(Math.round(value).toString())
  return (
    <button onClick={copy} className="text-slate-600 hover:text-slate-400 transition-colors ml-2" title="Copy to clipboard">
      <Copy size={12} />
    </button>
  )
}

export function AdminPriceOutput({ result }: Props) {
  const fields: OutputField[] = [
    { label: 'Cost Price', sublabel: 'Admin → Step 5, field 1', value: result.breakdown.production_cost },
    { label: 'Base Price', sublabel: 'Admin → Step 5, field 2 (B2C ex-GST)', value: result.b2c_price_ex_gst, highlight: true },
    { label: 'B2C Price (inc-GST)', sublabel: 'Admin → Step 5, field 3', value: result.b2c_inc_gst },
    { label: 'B2B Price (inc-GST)', sublabel: 'Admin → Step 5, field 4', value: result.b2b_inc_gst },
    { label: 'Compare At (MRP)', sublabel: 'Admin → Step 5, field 5', value: result.compare_at_suggested },
  ]

  return (
    <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden">
      <div className="bg-slate-800 px-3 py-2 border-b border-slate-700">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Admin Pricing Form — Step 5 Values</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Copy these values directly into KL/PW Admin</p>
      </div>
      <div className="divide-y divide-slate-800">
        {fields.map(f => (
          <div key={f.label} className={`flex items-center justify-between px-3 py-2 ${f.highlight ? 'bg-orange-950/20' : ''}`}>
            <div>
              <p className={`text-xs font-medium ${f.highlight ? 'text-orange-300' : 'text-slate-300'}`}>{f.label}</p>
              <p className="text-[10px] text-slate-600">{f.sublabel}</p>
            </div>
            <div className="flex items-center">
              <span className={`text-sm font-semibold tabular-nums ${f.highlight ? 'text-orange-400' : 'text-slate-200'}`}>
                {formatINR(f.value)}
              </span>
              <CopyButton value={f.value} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
