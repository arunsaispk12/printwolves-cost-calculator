import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, Info } from 'lucide-react'
import { usePlannerStore, useVisibleProducts } from '@/store/plannerStore'
import { formatINR } from '@/lib/formatters'

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3">{children}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-slate-500 text-sm">{children}</div>
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
  const styles = {
    ok: 'bg-emerald-900/30 border-emerald-700/40 text-emerald-400',
    warn: 'bg-amber-900/30 border-amber-700/40 text-amber-400',
    bad: 'bg-red-900/30 border-red-700/40 text-red-400',
    muted: 'bg-zinc-800 border-zinc-700 text-zinc-400',
  }[tone]
  return <span className={`text-[10px] border px-1.5 py-0.5 rounded font-semibold ${styles}`}>{children}</span>
}

// A number input that keeps what is typed, so the field can be emptied or set to 0.
// `empty` is the value an empty field means (undefined = "not set").
export function NumInput({ value, onChange, empty, ...rest }: {
  value: number | null | undefined
  onChange: (v: number | undefined) => void
  empty?: number
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const toValue = (t: string) => (t.trim() === '' || Number.isNaN(Number(t)) ? empty : Number(t))
  const shown = (toValue(text) ?? null) === (value ?? null) ? text : value == null ? '' : String(value)
  return (
    <input
      {...rest}
      type="number"
      value={shown}
      onChange={e => {
        setText(e.target.value)
        onChange(toValue(e.target.value))
      }}
    />
  )
}

export function NumberField({ label, value, onChange, step = 1, suffix, hint }: {
  label: string
  value: number | null
  onChange: (v: number) => void
  step?: number
  suffix?: string
  hint?: ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-xs text-slate-400 mb-1">{label}{hint}</span>
      <span className="flex items-center gap-2">
        <NumInput
          step={step}
          min={0}
          empty={0}
          value={value}
          onChange={v => onChange(v ?? 0)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100 tabular-nums focus:outline-none focus:border-orange-500"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  )
}

export function CopyValue({ label, value, text }: { label: string; value: number | string; text?: string }) {
  const [done, setDone] = useState(false)
  const shown = typeof value === 'number' ? formatINR(value) : value
  const copy = () => {
    navigator.clipboard.writeText(text ?? String(value))
    setDone(true)
    setTimeout(() => setDone(false), 1200)
  }
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <p className="text-xs text-slate-300">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200 tabular-nums">{shown}</span>
        <button onClick={copy} className="text-slate-600 hover:text-slate-400 transition-colors" title="Copy to clipboard">
          {done ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  )
}

export function BrandFilter() {
  const brand = usePlannerStore(s => s.brand_filter)
  const setBrand = usePlannerStore(s => s.setBrandFilter)
  const options = [['all', 'All'], ['kl', 'KaspersLab'], ['pw', 'PrintWolves']] as const
  return (
    <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => setBrand(id)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            brand === id ? 'bg-orange-950/40 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function ProductPicker() {
  const products = useVisibleProducts()
  const selected = usePlannerStore(s => s.selected_id)
  const select = usePlannerStore(s => s.selectProduct)
  return (
    <select
      value={selected ?? ''}
      onChange={e => select(e.target.value || null)}
      className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-orange-500"
    >
      <option value="">Select an estimate…</option>
      {products.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}

// A collapsible "how this works" panel. It starts open each visit: nothing is kept in
// the browser, and a screen preference isn't worth a server save (and a version bump).
export function Guide({ title, children }: { id?: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  const toggle = () => setOpen(!open)
  return (
    <div className="border border-sky-900/50 bg-sky-950/20 rounded-lg">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold text-sky-300"><Info size={13} />{title}</span>
        <span className="flex items-center gap-1 text-[11px] text-sky-500">
          {open ? 'Hide guide' : 'Show guide'}
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-4 pb-3 text-xs text-slate-400 leading-relaxed space-y-2">{children}</div>}
    </div>
  )
}

// A term and its meaning, for the definition lists inside guides.
export function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <dt className="text-slate-300 font-medium">{name}</dt>
      <dd>{children}</dd>
    </div>
  )
}
