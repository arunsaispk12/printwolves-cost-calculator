import { useState } from 'react'
import { Check, Download } from 'lucide-react'
import { usePlannerStore, useSelectedProduct, useVisibleProducts } from '@/store/plannerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { planProduct, volumeTiersToCore } from '@/engine/planProduct'
import { toPriceSheetCsv, toStepFive, toWizardImport, type StepFiveValues } from '@/engine/stepFiveExport'
import { buildVerificationPrompt } from '@/engine/verifyPrompt'
import { formatINR, formatPct } from '@/lib/formatters'
import { Badge, BrandFilter, CopyValue, Empty, Guide, NumberField, ProductPicker, SectionLabel, Term } from '@/components/planner/ui'
import type { LandedCost, PlannerConfig, PlannerProduct, PriceLadder } from '@/types/planner'

function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function PriceLadderTab() {
  const product = useSelectedProduct()
  const products = useVisibleProducts()
  const config = usePlannerStore(s => s.config)
  const tiers = volumeTiersToCore(useSettingsStore(s => s.volume_tiers))
  const [shift, setShift] = useState(0)

  const exportAll = () => {
    const rows = products.map(p => {
      const { landed, ladder } = planProduct(p, tiers, config)
      return { name: p.name, values: toStepFive(ladder, landed.unit_cost, config.gst_rate_pct ?? 0) }
    })
    downloadCsv('price-estimates.csv', toPriceSheetCsv(rows))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SectionLabel>Price Ladder & Tiers</SectionLabel>
        <div className="flex items-center gap-3">
          <BrandFilter />
          <ProductPicker />
          <button onClick={exportAll} disabled={products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-zinc-700 text-sm text-slate-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={13} /> Price sheet CSV
          </button>
        </div>
      </div>

      <Guide id="ladder" title="How to read the price ladder">
        <ol className="list-decimal pl-4 space-y-1">
          <li><strong className="text-slate-300">How the price is built</strong> walks from your lines to landed cost to the B2C price.</li>
          <li><strong className="text-slate-300">Step 5 values</strong> are what the Core product wizard asks for; copy them one by one, or use the hand-off box to copy them all as one import.</li>
          <li><strong className="text-slate-300">Verify with any AI</strong> copies a prompt so ChatGPT, Claude or another assistant can recheck the maths and your component costs.</li>
          <li>Use <strong className="text-slate-300">Cost what-if</strong> to see what a supplier price change does to every price.</li>
        </ol>
        <dl className="space-y-1 pt-1">
          <Term name="B2B price">B2C minus the B2B extra discount from Planner Settings.</Term>
          <Term name="Compare at">The struck-through reference price: B2C × the compare-at multiplier, rounded to a price ending in 9.</Term>
          <Term name="Tiers">Quantity discounts, taken from Settings → Volume tiers. A red margin means that tier sells below your floor.</Term>
          <Term name="Max safe">The deepest discount off B2C that still keeps your margin floor.</Term>
        </dl>
      </Guide>

      {product ? <Ladder product={product} config={config} shift={shift} setShift={setShift} /> : (
        <Empty>Pick an estimate above, or add one in the Products tab.</Empty>
      )}
    </div>
  )
}

function Ladder({ product, config, shift, setShift }: {
  product: PlannerProduct
  config: PlannerConfig
  shift: number
  setShift: (v: number) => void
}) {
  const tiers = volumeTiersToCore(useSettingsStore(s => s.volume_tiers))
  const { landed, ladder, shifted } = planProduct(product, tiers, config, shift)
  const base = planProduct(product, tiers, config)
  const step5 = toStepFive(ladder, landed.unit_cost, config.gst_rate_pct ?? 0)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
          <SectionLabel>How the price is built</SectionLabel>
          {landed.source === 'none' ? (
            <p className="text-xs text-amber-300">This estimate has no costed components yet. Edit it in the Products tab.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <tbody className="text-slate-300">
                {product.bom.filter(l => l.quantity * l.unit_cost > 0).map((l, i) => (
                  <tr key={i}>
                    <td className="py-0.5">{l.name || 'Unnamed'} <span className="text-slate-600">× {l.quantity}</span></td>
                    <td className="text-right">{formatINR(l.quantity * l.unit_cost)}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-800"><td className="pt-1 text-slate-400">Unit cost</td><td className="pt-1 text-right">{formatINR(landed.unit_cost)}</td></tr>
                <tr><td className="text-slate-500">+ Inbound freight ({config.inbound_freight_pct}%)</td><td className="text-right">{formatINR(landed.freight_cost)}</td></tr>
                <tr><td className="text-slate-500">+ Packaging</td><td className="text-right">{formatINR(landed.packaging_cost)}</td></tr>
                <tr className="border-t border-zinc-800 text-slate-100"><td className="pt-1">Landed cost</td><td className="pt-1 text-right">{formatINR(landed.landed_cost)}</td></tr>
                <tr><td className="text-slate-500">Target {config.target_margin_pct}% margin after {config.gateway_fee_pct}% gateway fee</td><td className="text-right text-orange-400">{formatINR(ladder.b2c_price)}</td></tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
          <SectionLabel>Cost what-if</SectionLabel>
          <NumberField label="Landed cost change (e.g. supplier +10)" suffix="%" step={1} value={shift} onChange={setShift} />
          {shift !== 0 && <p className="text-xs text-amber-400">Planning at {formatINR(shifted)} landed cost.</p>}
        </div>

        <VerifyPrompt product={product} landed={base.landed} ladder={base.ladder} config={config} />

        {ladder.issues.length > 0 && (
          <div className="border border-amber-800/40 bg-amber-950/10 rounded-lg p-4 space-y-1">
            <SectionLabel>Issues</SectionLabel>
            {ladder.issues.map(i => <p key={i} className="text-xs text-amber-300">• {i}</p>)}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 border-b border-slate-700">
            <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Core Admin — Step 5 Values</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Generated from the components; copy only, never written to Core</p>
          </div>
          <div className="divide-y divide-slate-800">
            <CopyValue label="Cost Price" value={step5.cost_price} text={String(step5.cost_price)} />
            <CopyValue label="Base Price" value={step5.base_price} text={String(step5.base_price)} />
            <CopyValue label="B2C Price" value={step5.b2c_price} text={String(step5.b2c_price)} />
            <CopyValue label="B2B Price" value={step5.b2b_price} text={String(step5.b2b_price)} />
            <CopyValue label="Compare At" value={step5.compare_at_price} text={String(step5.compare_at_price)} />
            <CopyValue label="GST rate" value={`${step5.gst_rate}%`} text={String(step5.gst_rate)} />
          </div>
        </div>

        <WizardHandoff product={product} values={step5} />

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                {['Tier', 'Min qty', 'Discount', 'Unit price', 'Margin', 'Max safe'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 tabular-nums">
              {ladder.tiers.map(t => (
                <tr key={t.min_quantity}>
                  <td className="px-3 py-2 text-slate-200">{t.tier_label}</td>
                  <td className="px-3 py-2 text-slate-300">{t.min_quantity}+</td>
                  <td className="px-3 py-2 text-slate-300">{t.discount_pct}%</td>
                  <td className="px-3 py-2 text-slate-200">{formatINR(t.unit_price)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={t.below_floor ? 'bad' : 'ok'}>{formatPct(t.margin_pct)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{formatPct(t.max_safe_discount_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Hand-off to the Core product wizard: its "Import from AI" box takes this JSON.
// The wizard needs a SKU to accept the import; it is asked for here, only at hand-off.
function WizardHandoff({ product, values }: { product: PlannerProduct; values: StepFiveValues }) {
  const [sku, setSku] = useState('')
  const [withBom, setWithBom] = useState(false)
  const [copied, setCopied] = useState(false)
  const bom = product.bom.filter(l => l.name.trim() !== '' && l.unit_cost > 0)

  const copy = () => {
    const payload = toWizardImport(values, { name: product.name, brand: product.brand, sku, bom: withBom ? bom : undefined })
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <SectionLabel>Hand off to Core product wizard</SectionLabel>
      <p className="text-xs text-slate-500">
        In Core, start <strong className="text-slate-300">New product → Import from AI</strong> and paste this. It fills the brand, name, cost and all prices,
        tiers and GST. The import replaces the whole wizard draft, so do it first, then continue from Step 1.
      </p>
      <label className="block text-xs text-slate-400">SKU <span className="text-slate-600">(the wizard import refuses to run without one; you can still change it in Step 1)</span>
        <input value={sku} onChange={e => setSku(e.target.value)}
          className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-orange-500" />
      </label>
      {bom.length > 0 && (
        <label className="flex items-start gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={withBom} onChange={e => setWithBom(e.target.checked)} className="mt-0.5" />
          <span>Include {bom.length} line{bom.length > 1 ? 's' : ''} as the BOM. Only tick this if each name is an exact IPMS material SKU; a mistyped one never deducts stock.</span>
        </label>
      )}
      <button onClick={copy} disabled={!sku.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
        {copied ? <><Check size={14} /> Copied</> : 'Copy wizard import JSON'}
      </button>
    </div>
  )
}

// Copies a prompt that lets any AI assistant re-derive and sanity-check this estimate.
// It uses the unshifted plan: the what-if is a scenario, not the estimate to verify.
function VerifyPrompt({ product, landed, ladder, config }: {
  product: PlannerProduct
  landed: LandedCost
  ladder: PriceLadder
  config: PlannerConfig
}) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const prompt = buildVerificationPrompt(product, landed, ladder, config)

  const copy = () => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <SectionLabel>Verify with any AI</SectionLabel>
      <p className="text-xs text-slate-500">
        Copies a prompt with the components, settings, formulas and these results. Paste it into ChatGPT, Claude, Gemini or any assistant:
        it recomputes every number, flags mismatches, checks your component costs and lists missing cost items. Nothing is sent from here.
      </p>
      <div className="flex gap-2">
        <button onClick={copy} disabled={landed.source === 'none'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
          {copied ? <><Check size={14} /> Copied</> : 'Copy verification prompt'}
        </button>
        <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded border border-zinc-700 text-sm text-slate-300 hover:bg-zinc-800">
          {open ? 'Hide' : 'Preview'}
        </button>
      </div>
      {open && (
        <textarea readOnly value={prompt} rows={16}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200" />
      )}
    </div>
  )
}
