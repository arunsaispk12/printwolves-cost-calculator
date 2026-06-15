// src/tabs/QuoteBuilderTab.tsx
import { useState } from 'react'
import { useCalculatorStore } from '@/store/calculatorStore'
import { useSettingsStore } from '@/store/settingsStore'
import { computeBulkTiers } from '@/engine/bulkPlanner'
import { formatINR } from '@/lib/formatters'
import { Download } from 'lucide-react'

export function QuoteBuilderTab() {
  const { result, inputs } = useCalculatorStore()
  const settings = useSettingsStore()
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)

  if (!result) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Calculate a job in the Calculator tab first, then build a quote here.
      </div>
    )
  }

  const gst_rate = settings.pricing_strategy.gst_rate_pct / 100
  const tiers = computeBulkTiers(result.b2c_price_ex_gst, settings.volume_tiers, gst_rate)
  const chosenTier = tiers.find(t => t.qty === selectedQty) ?? tiers[0]
  const material = settings.materials.find(m => m.key === inputs.material_key)
  const delivery = settings.delivery_speeds.find(d => d.key === inputs.delivery_key)

  const handlePrint = () => window.print()

  return (
    <div className="p-6 max-w-3xl">
      <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-4">Quote Builder</p>

      {/* Client details */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Client Name</label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="e.g. ABC Pvt Ltd"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Project / Part Name</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. Enclosure v3"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Quantity selector */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1.5 block">Quoted Quantity</label>
        <div className="flex flex-wrap gap-2">
          {tiers.map(t => (
            <button
              key={t.qty}
              onClick={() => setSelectedQty(t.qty)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                t.qty === selectedQty
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.qty} {t.discount_pct > 0 && <span className="text-emerald-400">(-{t.discount_pct}%)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Quote preview */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden mb-4">
        <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="text-sm font-bold text-white">Print Wolves</span>
          </div>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <div className="p-4">
          {clientName && <p className="text-sm text-slate-300 mb-1">For: <strong>{clientName}</strong></p>}
          {projectName && <p className="text-sm text-slate-400 mb-3">Project: {projectName}</p>}

          <div className="divide-y divide-zinc-800 text-sm mb-3">
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Material</span>
              <span className="text-slate-200">{material?.name}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Complexity</span>
              <span className="text-slate-200 capitalize">{inputs.complexity.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Delivery</span>
              <span className="text-slate-200">{delivery?.label}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Quantity</span>
              <span className="text-slate-200">{selectedQty}</span>
            </div>
            {chosenTier.discount_pct > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Bulk Discount</span>
                <span className="text-emerald-400">{chosenTier.discount_pct}% off</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Unit Price (ex-GST)</span>
              <span className="text-slate-200 tabular-nums">{formatINR(chosenTier.unit_price_ex_gst)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">GST ({settings.pricing_strategy.gst_rate_pct}%)</span>
              <span className="text-slate-200 tabular-nums">{formatINR(chosenTier.unit_price_ex_gst * gst_rate * selectedQty)}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <span className="text-slate-300">Total (inc-GST)</span>
              <span className="text-orange-400 tabular-nums text-base">{formatINR(chosenTier.total_inc_gst)}</span>
            </div>
          </div>

          {notes && <p className="text-xs text-slate-500 mt-2 border-t border-zinc-800 pt-2">{notes}</p>}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 mb-1 block">Notes / Terms</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Quote valid for 7 days. 50% advance required."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>

      <button
        onClick={handlePrint}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-md transition-colors"
      >
        <Download size={14} />
        Print / Save as PDF
      </button>
    </div>
  )
}
