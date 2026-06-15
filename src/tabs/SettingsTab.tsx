// src/tabs/SettingsTab.tsx
import { useSettingsStore } from '@/store/settingsStore'
import { RotateCcw } from 'lucide-react'

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">{title}</p>
      <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
    </div>
  )
}

function NumberField({ label, value, onChange, min, step, unit }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number; unit?: string
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}{unit && <span className="text-slate-600 ml-1">({unit})</span>}</label>
      <input
        type="number"
        min={min ?? 0}
        step={step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 tabular-nums"
      />
    </div>
  )
}

export function SettingsTab() {
  const s = useSettingsStore()

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">All Settings — Saved to This Browser</p>
        <button
          onClick={s.resetToDefaults}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 border border-zinc-700 px-3 py-1.5 rounded-md transition-colors"
        >
          <RotateCcw size={12} />
          Reset to Defaults
        </button>
      </div>

      <div className="space-y-8">

        {/* 1. Materials */}
        <section>
          <SectionHeader title="1. Materials" subtitle="Cost per kg and density for each filament or resin" />
          <div className="space-y-2">
            {s.materials.map(m => (
              <div key={m.key} className="grid grid-cols-[1fr_140px_120px] gap-3 items-end bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-slate-300">{m.name}</p>
                  <p className="text-[10px] text-slate-600">{m.description}</p>
                </div>
                <NumberField label="Cost/kg (₹)" value={m.cost_per_kg} onChange={v => s.updateMaterial(m.key, { cost_per_kg: v })} min={1} />
                <NumberField label="Density (g/cm³)" value={m.density_g_cm3} step={0.01} onChange={v => s.updateMaterial(m.key, { density_g_cm3: v })} min={0.1} />
              </div>
            ))}
          </div>
        </section>

        {/* 2. Printer Profile */}
        <section>
          <SectionHeader title="2. Printer Profile" subtitle="One active printer. Updates cost formula immediately." />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <NumberField label="Purchase Price" value={s.printer.purchase_price_inr} unit="₹" onChange={v => s.updatePrinter({ purchase_price_inr: v })} min={1000} />
            <NumberField label="Lifespan" value={s.printer.lifespan_hours} unit="hours" onChange={v => s.updatePrinter({ lifespan_hours: v })} min={100} />
            <NumberField label="Power Draw" value={s.printer.power_watts} unit="watts" onChange={v => s.updatePrinter({ power_watts: v })} min={10} />
            <NumberField label="Monthly Maintenance" value={s.printer.monthly_maintenance_inr} unit="₹/month" onChange={v => s.updatePrinter({ monthly_maintenance_inr: v })} />
            <NumberField label="Monthly Print Hours" value={s.printer.monthly_print_hours} unit="hrs" onChange={v => s.updatePrinter({ monthly_print_hours: v })} min={1} />
            <NumberField label="Failure Rate" value={s.printer.failure_rate_pct} unit="%" step={0.5} onChange={v => s.updatePrinter({ failure_rate_pct: v })} min={0} />
          </div>
        </section>

        {/* 3. Labor Rates */}
        <section>
          <SectionHeader title="3. Labor Rates" subtitle="Your time costs. Setup = flat per job. Monitoring = per print hour." />
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Setup Cost (flat)" value={s.labor.setup_cost_per_print} unit="₹/job" onChange={v => s.updateLabor({ setup_cost_per_print: v })} />
            <NumberField label="Monitoring Rate" value={s.labor.monitoring_rate_per_hour} unit="₹/hr" onChange={v => s.updateLabor({ monitoring_rate_per_hour: v })} />
            <NumberField label="Post-Processing Rate" value={s.labor.post_processing_rate_per_hour} unit="₹/hr" onChange={v => s.updateLabor({ post_processing_rate_per_hour: v })} />
          </div>
        </section>

        {/* 4. Electricity */}
        <section>
          <SectionHeader title="4. Electricity" subtitle="Your local electricity tariff" />
          <div className="max-w-xs">
            <NumberField label="Rate" value={s.electricity.rate_per_kwh} unit="₹/kWh" step={0.5} onChange={v => s.updateElectricity({ rate_per_kwh: v })} min={1} />
          </div>
        </section>

        {/* 5. Pricing Strategy */}
        <section>
          <SectionHeader title="5. Pricing Strategy" subtitle="Target margins and GST rate. B2B discount is taken from B2C price." />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <NumberField label="Target Retail Margin" value={s.pricing_strategy.target_retail_margin_pct} unit="%" step={1} onChange={v => s.updatePricingStrategy({ target_retail_margin_pct: v })} min={10} />
            <NumberField label="Minimum Margin Threshold" value={s.pricing_strategy.min_margin_threshold_pct} unit="%" step={1} onChange={v => s.updatePricingStrategy({ min_margin_threshold_pct: v })} min={5} />
            <NumberField label="B2B Discount from B2C" value={s.pricing_strategy.b2b_discount_pct} unit="%" step={1} onChange={v => s.updatePricingStrategy({ b2b_discount_pct: v })} min={0} />
            <NumberField label="GST Rate" value={s.pricing_strategy.gst_rate_pct} unit="%" step={1} onChange={v => s.updatePricingStrategy({ gst_rate_pct: v })} min={0} />
            <NumberField label="Compare At Multiplier" value={s.pricing_strategy.compare_at_multiplier} step={0.05} onChange={v => s.updatePricingStrategy({ compare_at_multiplier: v })} min={1} />
          </div>
        </section>

        {/* 6. Volume Tiers */}
        <section>
          <SectionHeader title="6. Volume Tiers" subtitle="Bulk discount structure shown in Tier Bar and Bulk Planner" />
          <div className="space-y-2">
            {s.volume_tiers.map((tier, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_120px] gap-3 items-end bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <NumberField label="Min Qty" value={tier.min_qty} onChange={v => {
                  const updated = [...s.volume_tiers]
                  updated[i] = { ...tier, min_qty: v }
                  s.updateVolumeTiers(updated)
                }} min={1} />
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Label</label>
                  <input
                    type="text"
                    value={tier.label}
                    onChange={e => {
                      const updated = [...s.volume_tiers]
                      updated[i] = { ...tier, label: e.target.value }
                      s.updateVolumeTiers(updated)
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <NumberField label="Discount %" value={tier.discount_pct} onChange={v => {
                  const updated = [...s.volume_tiers]
                  updated[i] = { ...tier, discount_pct: v }
                  s.updateVolumeTiers(updated)
                }} min={0} />
              </div>
            ))}
          </div>
        </section>

        {/* 7. Complexity Multipliers */}
        <section>
          <SectionHeader title="7. Complexity Multipliers" subtitle="Multiplies adjusted print time — affects energy, depreciation, maintenance, and labor" />
          <div className="grid grid-cols-4 gap-3">
            {(['simple', 'moderate', 'complex', 'very_complex'] as const).map(c => (
              <NumberField
                key={c}
                label={c.replace('_', ' ')}
                value={s.complexity_multipliers[c]}
                step={0.05}
                onChange={v => s.updateComplexityMultipliers({ [c]: v })}
                min={1}
              />
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
