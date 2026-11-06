import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { usePlannerStore, useVisibleProducts } from '@/store/plannerStore'
import { useCalculatorStore } from '@/store/calculatorStore'
import { useSettingsStore } from '@/store/settingsStore'
import { planProduct, volumeTiersToCore } from '@/engine/planProduct'
import { formatINR, formatPct } from '@/lib/formatters'
import { Badge, BrandFilter, Empty, Guide, NumInput, SectionLabel, Term } from '@/components/planner/ui'
import type { Brand, PlannerProduct } from '@/types/planner'

type Draft = Omit<PlannerProduct, 'id'> & { id?: string }

const blank: Draft = { name: '', brand: 'kl', bom: [] }

export function ProductsTab() {
  const products = useVisibleProducts()
  const { config, upsertProduct, removeProduct, selectProduct } = usePlannerStore()
  const result = useCalculatorStore(s => s.result)
  const tiers = volumeTiersToCore(useSettingsStore(s => s.volume_tiers))
  const [draft, setDraft] = useState<Draft>(blank)
  const [error, setError] = useState<string | null>(null)

  const setLine = (i: number, patch: Partial<PlannerProduct['bom'][number]>) =>
    setDraft({ ...draft, bom: draft.bom.map((l, j) => (j === i ? { ...l, ...patch } : l)) })

  const save = () => {
    if (!draft.name.trim()) return setError('Give the estimate a name')
    setError(null)
    const id = draft.id ?? crypto.randomUUID()
    upsertProduct({ ...draft, id, name: draft.name.trim(), bom: draft.bom.filter(l => l.name.trim() !== '') })
    selectProduct(id)
    setDraft(blank)
  }

  // The calculator already works out a print job's cost; it enters here as one line.
  const addFromCalculator = () => {
    if (!result) return
    const id = crypto.randomUUID()
    upsertProduct({
      id,
      name: `3D print job ${products.filter(p => p.brand === 'pw').length + 1}`,
      brand: 'pw',
      bom: [{ name: '3D print job (from Calculator)', quantity: 1, unit_cost: Math.round(result.breakdown.production_cost * 100) / 100 }],
    })
    selectProduct(id)
  }

  const preview = planProduct(draft, tiers, config)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Product Estimates</SectionLabel>
        <BrandFilter />
      </div>

      <Guide id="products" title="How estimates work">
        <ol className="list-decimal pl-4 space-y-1">
          <li>Name the product and pick the brand.</li>
          <li>List everything that goes into <strong className="text-slate-300">one unit</strong>, each as quantity × unit cost: parts, materials, and your time (hours × hourly rate).</li>
          <li>For a 3D-printed part, cost the print in the <strong className="text-slate-300">Calculator</strong> tab first, press <strong className="text-slate-300">Add current calculator job</strong> here, then edit it to add the bought-in parts.</li>
          <li>You never type a price. Open <strong className="text-slate-300">Price Ladder</strong> to see the prices, tiers and Step 5 values generated from these lines.</li>
        </ol>
        <dl className="space-y-1 pt-1">
          <Term name="Landed cost">Unit cost plus inbound freight and packaging: what one unit costs you before it is sold.</Term>
          <Term name="Planned B2C">The retail price that reaches your target margin after the payment gateway fee.</Term>
          <Term name="Issues">Things to check, such as a quantity tier that falls below your margin floor. Hover the badge to read them.</Term>
        </dl>
      </Guide>

      {products.length === 0 ? (
        <Empty>No estimates yet. List the components and resources of a product below, or add the current calculator job.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 border-b border-zinc-800">
                {['Product', 'Landed cost', 'Planned B2C', 'Net margin', 'Issues', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {products.map(p => {
                const { landed, ladder } = planProduct(p, tiers, config)
                return (
                  <tr key={p.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => selectProduct(p.id)} className="text-orange-400 hover:underline text-sm">{p.name}</button>
                      <span className="ml-2"><Badge tone="muted">{p.brand === 'kl' ? 'KL' : 'PW'}</Badge></span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">
                      {landed.source === 'none' ? <Badge tone="bad">no cost</Badge> : formatINR(landed.landed_cost)}
                    </td>
                    <td className="px-4 py-3 text-slate-200 tabular-nums">{ladder.b2c_price > 0 ? formatINR(ladder.b2c_price) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{ladder.b2c_price > 0 ? formatPct(ladder.margin_pct) : '—'}</td>
                    <td className="px-4 py-3">
                      {landed.source === 'none' ? <Badge tone="muted">add components</Badge> : ladder.issues.length === 0 ? <Badge tone="ok">none</Badge> : (
                        <span title={ladder.issues.join('\n')}><Badge tone="warn">{ladder.issues.length}</Badge></span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setDraft({ id: p.id, name: p.name, brand: p.brand, bom: p.bom })} className="text-slate-600 hover:text-orange-400 mr-3" title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => removeProduct(p.id)} className="text-slate-600 hover:text-red-400" title="Remove"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-zinc-800 rounded-lg p-4 space-y-3 max-w-2xl">
        <SectionLabel>{draft.id ? 'Edit estimate' : 'New estimate'}</SectionLabel>
        <p className="text-xs text-slate-500">
          List what goes into one unit: parts, materials, labour hours, anything with a cost. Cost, prices, tiers, margin and GST are worked out from this and the Planner Settings.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">Name
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-orange-500" />
          </label>
          <label className="block text-xs text-slate-400">Brand
            <select value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value as Brand })}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100">
              <option value="kl">KaspersLab</option>
              <option value="pw">PrintWolves</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {draft.bom.length > 0 && (
            <div className="grid grid-cols-[1fr_70px_90px_80px_auto] gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              <span>Component / resource</span><span>Qty</span><span>Unit ₹</span><span className="text-right">Line</span><span />
            </div>
          )}
          {draft.bom.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_90px_80px_auto] gap-2 items-center">
              <input placeholder="e.g. ESP32-S3 module, assembly labour (hr)" value={l.name}
                onChange={e => setLine(i, { name: e.target.value })}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-slate-100" />
              <NumInput min={0} step={0.01} empty={0} value={l.quantity} onChange={v => setLine(i, { quantity: v ?? 0 })}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-slate-100 tabular-nums" />
              <NumInput min={0} step={0.01} empty={0} value={l.unit_cost} onChange={v => setLine(i, { unit_cost: v ?? 0 })}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-slate-100 tabular-nums" />
              <span className="text-right text-sm text-slate-300 tabular-nums">{formatINR(l.quantity * l.unit_cost)}</span>
              <button onClick={() => setDraft({ ...draft, bom: draft.bom.filter((_, j) => j !== i) })} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
          ))}
          <button onClick={() => setDraft({ ...draft, bom: [...draft.bom, { name: '', quantity: 1, unit_cost: 0 }] })}
            className="text-xs text-orange-400 hover:underline">+ Add component or resource</button>
        </div>

        {preview.landed.source !== 'none' && (
          <p className="text-xs text-slate-400 border-t border-zinc-800 pt-3">
            Unit cost <strong className="text-slate-200">{formatINR(preview.landed.unit_cost)}</strong> → landed <strong className="text-slate-200">{formatINR(preview.landed.landed_cost)}</strong>
            {' '}→ planned B2C <strong className="text-orange-400">{formatINR(preview.ladder.b2c_price)}</strong> at {formatPct(preview.ladder.margin_pct)} net margin.
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium">
            <Plus size={14} /> {draft.id ? 'Save changes' : 'Add estimate'}
          </button>
          {draft.id && (
            <button onClick={() => setDraft(blank)} className="px-3 py-1.5 rounded border border-zinc-700 text-sm text-slate-300 hover:bg-zinc-800">Cancel</button>
          )}
          <button onClick={addFromCalculator} disabled={!result}
            className="px-3 py-1.5 rounded border border-zinc-700 text-sm text-slate-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Add current calculator job
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  )
}
