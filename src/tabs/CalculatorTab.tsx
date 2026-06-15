import { useEffect } from 'react'
import { useCalculatorStore } from '@/store/calculatorStore'
import { useSettingsStore } from '@/store/settingsStore'
import { computePrice } from '@/engine/pricingEngine'
import { suggestMargin } from '@/engine/marginAdvisor'
import { CostBreakdown } from '@/components/CostBreakdown'
import { AdminPriceOutput } from '@/components/AdminPriceOutput'
import { TierProgressBar } from '@/components/TierProgressBar'
import type { Complexity } from '@/types'

const COMPLEXITY_OPTIONS: { value: Complexity; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'complex', label: 'Complex' },
  { value: 'very_complex', label: 'Very Complex' },
]

export function CalculatorTab() {
  const { inputs, result, setInputs, setResult, togglePostProcessing } = useCalculatorStore()
  const settings = useSettingsStore()

  useEffect(() => {
    try {
      const computed = computePrice(inputs, settings)
      const material = settings.materials.find(m => m.key === inputs.material_key)
      if (material) {
        const suggested = suggestMargin(material, inputs.complexity)
        computed.suggested_margin_pct = suggested
      }
      setResult(computed)
    } catch {
      // Invalid state during transition — ignore
    }
  }, [inputs, settings])

  const selectedMaterial = settings.materials.find(m => m.key === inputs.material_key)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-104px)]">
      {/* Left: Inputs */}
      <div className="p-6 border-r border-zinc-800">
        <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-4">Job Details</p>

        {/* Material */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1.5 block">Material</label>
          <select
            value={inputs.material_key}
            onChange={e => setInputs({ material_key: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          >
            {settings.materials.map(m => (
              <option key={m.key} value={m.key}>{m.name} — ₹{m.cost_per_kg}/kg</option>
            ))}
          </select>
          {selectedMaterial && result && (
            <p className="text-[10px] text-slate-600 mt-1">
              Suggested margin: <span className="text-amber-400 font-semibold">{result.suggested_margin_pct}%</span>
              {' '}(current: {settings.pricing_strategy.target_retail_margin_pct}%)
            </p>
          )}
        </div>

        {/* Weight + Print Time */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Weight (g)</label>
            <input
              type="number"
              min={1}
              value={inputs.weight_g}
              onChange={e => setInputs({ weight_g: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Print Time (hrs)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={inputs.print_hours}
              onChange={e => setInputs({ print_hours: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 tabular-nums"
            />
          </div>
        </div>

        {/* Complexity */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1.5 block">Complexity</label>
          <div className="grid grid-cols-4 gap-1.5">
            {COMPLEXITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setInputs({ complexity: opt.value })}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                  inputs.complexity === opt.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity + Delivery */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Quantity</label>
            <input
              type="number"
              min={1}
              value={inputs.quantity}
              onChange={e => setInputs({ quantity: Number(e.target.value) })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Delivery</label>
            <select
              value={inputs.delivery_key}
              onChange={e => setInputs({ delivery_key: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
            >
              {settings.delivery_speeds.map(d => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Post Processing */}
        <div className="mb-4">
          <label className="text-xs text-slate-400 mb-1.5 block">Post-Processing</label>
          <div className="flex flex-wrap gap-1.5">
            {settings.post_processing_options.map(opt => {
              const active = inputs.post_processing_keys.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => togglePostProcessing(opt.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    active
                      ? 'bg-orange-600/20 border border-orange-600 text-orange-400'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tier Progress Bar */}
        {result && (
          <TierProgressBar
            tiers={settings.volume_tiers}
            currentQty={inputs.quantity}
            baseUnitPrice={result.b2c_price_ex_gst}
            theme="dark"
            onSuggestionClick={qty => setInputs({ quantity: qty })}
          />
        )}
      </div>

      {/* Right: Output */}
      <div className="p-6">
        {result ? (
          <>
            <CostBreakdown result={result} />
            <AdminPriceOutput result={result} />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold py-2.5 rounded-md transition-colors"
                onClick={() => {/* navigate to quote tab */}}
              >
                Build Quote
              </button>
              <button
                className="bg-zinc-800 border border-zinc-700 text-slate-300 text-xs font-semibold py-2.5 rounded-md hover:bg-zinc-700 transition-colors"
                onClick={() => {/* navigate to bulk tab */}}
              >
                Open in Bulk Planner
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-sm">
            Enter job details to see pricing
          </div>
        )}
      </div>
    </div>
  )
}
