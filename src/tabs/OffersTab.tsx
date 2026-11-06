import { useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePlannerStore, useSelectedProduct, useVisibleProducts } from '@/store/plannerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { planProduct, volumeTiersToCore } from '@/engine/planProduct'
import { analyzeOffer, campaignBudget, compareOffers, mixMatchCheck, safeLimits, tieredStepChecks, type OfferAnalysis } from '@/engine/offers/analyze'
import { simulateCampaign, type CampaignBasket } from '@/engine/offers/campaign'
import { planSale } from '@/engine/offers/sale'
import { formatINR, formatPct } from '@/lib/formatters'
import { Badge, BrandFilter, CopyValue, Empty, Guide, NumberField, NumInput, ProductPicker, SectionLabel, Term } from '@/components/planner/ui'
import type { BasketLine, Offer, OfferItem, OfferType, OrderOptions, OrderOutcome, PlannerConfig, PlannerProduct } from '@/types/planner'

type Section = 'compare' | 'campaign' | 'sale'
const sections: Array<[Section, string]> = [['compare', 'Compare offers'], ['campaign', 'Campaign budget'], ['sale', 'Sale / compare-at']]

const OFFER_TYPES: Array<[OfferType, string]> = [
  ['percentage', 'Percentage off'],
  ['flat', 'Flat amount off'],
  ['free_shipping', 'Free shipping'],
  ['tiered_spend', 'Spend more, save more (planning only)'],
  ['gift_with_purchase', 'Free gift with purchase (planning only)'],
  ['nth_item_pct', 'Nth item % off (planning only)'],
  ['buy_x_get_y', 'Buy X get Y free (planning only)'],
  ['bundle_price', 'Whole-basket bundle price (planning only)'],
  ['mix_match', 'Mix and match: any N for ₹ (planning only)'],
  ['free_gift_wrap', 'Free gift wrap (planning only)'],
]

const PRESETS: Offer[] = [
  { type: 'percentage', label: '10% off', discount_value: 10, max_discount_amount: null, min_order_amount: null },
  { type: 'flat', label: '₹150 off over ₹999', discount_value: 150, min_order_amount: 999 },
  { type: 'free_shipping', label: 'Free shipping', discount_value: 0 },
  { type: 'buy_x_get_y', label: 'Buy 2 get 1 free', discount_value: 0, buy: 2, get: 1 },
  { type: 'tiered_spend', label: 'Spend more, save more', discount_value: 0, steps: [{ min_order: 999, amount_off: 100 }, { min_order: 2499, amount_off: 300 }] },
]

const MAX_OFFERS = 8

interface BasketEntry { id: string; quantity: number }

// One line that says what an offer does, for the collapsed editor rows.
function describeOffer(o: Offer): string {
  const min = o.min_order_amount ? ` · min order ${formatINR(o.min_order_amount)}` : ''
  switch (o.type) {
    case 'percentage': return `${o.discount_value}% off${o.max_discount_amount ? `, up to ${formatINR(o.max_discount_amount)}` : ''}${min}`
    case 'flat': return `${formatINR(o.discount_value)} off${min}`
    case 'free_shipping': return `Free shipping${min}`
    case 'bundle_price': return `Whole basket for ${o.bundle_price != null ? formatINR(o.bundle_price) : '(set a price)'}${min}`
    case 'buy_x_get_y': return `Buy ${o.buy ?? 1}, get ${o.get ?? 0} free${min}`
    case 'nth_item_pct': return `Every ${ordinal(o.nth ?? 2)} unit ${o.nth_pct ?? 0}% off${min}`
    case 'tiered_spend': return (o.steps ?? []).length === 0 ? 'Add steps'
      : [...(o.steps ?? [])].sort((a, b) => a.min_order - b.min_order).map(st => `${formatINR(st.amount_off)} off ${formatINR(st.min_order)}+`).join(' · ')
    case 'gift_with_purchase': return `Free ${o.gift?.name ?? '(pick a gift)'}${min}`
    case 'mix_match': return `Any ${o.bundle_size ?? 2} of ${(o.pool_ids ?? []).length} items for ${formatINR(o.bundle_price ?? 0)}${min}`
    case 'free_gift_wrap': return `Gift wrap free${min}`
  }
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`

const describeLift = (a: OfferAnalysis) =>
  a.break_even_lift_pct == null ? 'never: each order loses money' : a.break_even_lift_pct <= 0 ? 'none needed' : `+${formatPct(a.break_even_lift_pct)} orders`

export function OffersTab() {
  const [section, setSection] = useState<Section>('compare')
  const [basket, setBasket] = useState<BasketEntry[]>([])
  const [offers, setOffers] = useState<Offer[]>(PRESETS)
  const [mix, setMix] = useState<CampaignBasket[]>([])
  const [giftWrap, setGiftWrap] = useState(false)
  const products = useVisibleProducts()
  const all = usePlannerStore(s => s.products)
  const config = usePlannerStore(s => s.config)
  const volume = useSettingsStore(s => s.volume_tiers)

  // Each line sells at the price the planner generates for that estimate.
  const lines: BasketLine[] = useMemo(() => basket.flatMap(e => {
    const p = all.find(x => x.id === e.id)
    if (!p || e.quantity <= 0) return []
    const { landed, ladder } = planProduct(p, volumeTiersToCore(volume), config)
    if (landed.source === 'none' || ladder.b2c_price <= 0) return []
    return [{ id: p.id, unit_price: ladder.b2c_price, landed_cost: landed.landed_cost, quantity: e.quantity }]
  }), [basket, all, config, volume])

  // Offers that name estimates (a gift, a mix-and-match pool) get those estimates'
  // planned price and landed cost filled in for the engine.
  const resolved: Offer[] = useMemo(() => {
    const item = (id: string): OfferItem | null => {
      const p = all.find(x => x.id === id)
      if (!p) return null
      const { landed, ladder } = planProduct(p, volumeTiersToCore(volume), config)
      return landed.source === 'none' ? null : { id: p.id, name: p.name, unit_price: ladder.b2c_price, landed_cost: landed.landed_cost }
    }
    return offers.map(o => ({
      ...o,
      gift: o.gift_product_id ? item(o.gift_product_id) ?? undefined : undefined,
      pool: (o.pool_ids ?? []).map(item).filter((x): x is OfferItem => x != null),
    }))
  }, [offers, all, config, volume])
  const opts: OrderOptions = { gift_wrap: giftWrap }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-md border border-zinc-800 overflow-hidden">
          {sections.map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${section === id ? 'bg-orange-950/40 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <BrandFilter />
      </div>

      <SectionGuide section={section} />

      {section === 'sale' ? <SalePlanner /> : (
        <div className="grid xl:grid-cols-[380px_1fr] gap-6">
          <div className="space-y-4">
            <BasketBuilder basket={basket} setBasket={setBasket} products={products} lines={lines} giftWrap={giftWrap} setGiftWrap={setGiftWrap} />
            <OfferEditor offers={offers} setOffers={setOffers} products={all} />
          </div>
          <div className="space-y-4 min-w-0">
            {lines.length === 0 ? <Empty>Add an estimate to the basket. Every offer is tested on that basket.</Empty> : section === 'compare' ? (
              <Comparison lines={lines} offers={resolved} config={config} opts={opts} />
            ) : (
              <CampaignBudget lines={lines} offers={resolved} mix={mix} setMix={setMix} config={config} opts={opts} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BasketBuilder({ basket, setBasket, products, lines, giftWrap, setGiftWrap }: {
  basket: BasketEntry[]
  setBasket: (b: BasketEntry[]) => void
  products: PlannerProduct[]
  lines: BasketLine[]
  giftWrap: boolean
  setGiftWrap: (v: boolean) => void
}) {
  const [pick, setPick] = useState('')
  const add = () => {
    if (!pick) return
    const existing = basket.find(b => b.id === pick)
    setBasket(existing ? basket.map(b => (b.id === pick ? { ...b, quantity: b.quantity + 1 } : b)) : [...basket, { id: pick, quantity: 1 }])
  }
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
      <SectionLabel>Basket (one typical order)</SectionLabel>
      <div className="flex gap-2">
        <select value={pick} onChange={e => setPick(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100">
          <option value="">Add a product…</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={add} className="px-2 rounded bg-orange-600 hover:bg-orange-500 text-white"><Plus size={14} /></button>
      </div>
      {basket.map(b => (
        <div key={b.id} className="flex items-center gap-3 text-sm">
          <span className="flex-1 text-sm text-slate-300">{products.find(p => p.id === b.id)?.name ?? 'Removed estimate'}</span>
          <NumInput min={0} empty={0} value={b.quantity}
            onChange={v => setBasket(basket.map(x => (x.id === b.id ? { ...x, quantity: v ?? 0 } : x)))}
            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-slate-100 tabular-nums" />
          <button onClick={() => setBasket(basket.filter(x => x.id !== b.id))} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      ))}
      {subtotal > 0 && <p className="text-xs text-slate-500">Subtotal at planned prices: <strong className="text-slate-300">{formatINR(subtotal)}</strong></p>}
      <label className="flex items-center gap-2 text-xs text-slate-400 pt-1">
        <input type="checkbox" checked={giftWrap} onChange={e => setGiftWrap(e.target.checked)} />
        This order is gift wrapped <span className="text-slate-600">(fee and cost from Planner Settings)</span>
      </label>
    </div>
  )
}

function OfferEditor({ offers, setOffers, products }: { offers: Offer[]; setOffers: (o: Offer[]) => void; products: PlannerProduct[] }) {
  const [editing, setEditing] = useState<number | null>(null)
  const set = (i: number, patch: Partial<Offer>) => setOffers(offers.map((o, j) => (j === i ? { ...o, ...patch } : o)))
  const input = 'mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-slate-100 tabular-nums focus:outline-none focus:border-orange-500'
  const field = (label: string, el: React.ReactNode) => <label className="block text-[11px] text-slate-500">{label}{el}</label>
  const remove = (i: number) => {
    setOffers(offers.filter((_, j) => j !== i))
    setEditing(null)
  }
  const add = () => {
    setOffers([...offers, { type: 'percentage', label: `Offer ${offers.length + 1}`, discount_value: 15 }])
    setEditing(offers.length)
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 space-y-2">
      <SectionLabel>Offers to compare ({offers.length}/{MAX_OFFERS})</SectionLabel>
      {offers.map((o, i) => (
        <div key={i} className={`rounded border ${editing === i ? 'border-orange-800/60 bg-zinc-900/60' : 'border-zinc-800'}`}>
          <div className="flex items-center gap-2 px-3 py-2">
            <button onClick={() => setEditing(editing === i ? null : i)} className="flex-1 min-w-0 text-left">
              <p className="text-sm text-slate-200 truncate">{o.label || 'Untitled offer'}</p>
              <p className="text-[11px] text-slate-500 truncate">{describeOffer(o)}</p>
            </button>
            <button onClick={() => setEditing(editing === i ? null : i)} className="text-slate-500 hover:text-orange-400" title={editing === i ? 'Close' : 'Edit'}>
              {editing === i ? <ChevronDown size={14} className="rotate-180" /> : <Pencil size={13} />}
            </button>
            <button onClick={() => remove(i)} className="text-slate-600 hover:text-red-400" title="Remove"><Trash2 size={13} /></button>
          </div>
          {editing === i && (
            <div className="px-3 pb-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-2">
              <div className="col-span-2">{field('Name', <input value={o.label} onChange={e => set(i, { label: e.target.value })} className={input} />)}</div>
              <div className="col-span-2">{field('Type', (
                <select value={o.type} onChange={e => set(i, { type: e.target.value as OfferType })} className={input}>
                  {OFFER_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              ))}</div>
              {o.type === 'percentage' && field('Discount %', <NumInput min={0} empty={0} value={o.discount_value} onChange={v => set(i, { discount_value: v ?? 0 })} className={input} />)}
              {o.type === 'percentage' && field('Cap ₹ (blank = none)', <NumInput min={0} value={o.max_discount_amount} onChange={v => set(i, { max_discount_amount: v ?? null })} className={input} />)}
              {o.type === 'flat' && field('Amount ₹', <NumInput min={0} empty={0} value={o.discount_value} onChange={v => set(i, { discount_value: v ?? 0 })} className={input} />)}
              {o.type === 'bundle_price' && field('Price for the whole basket ₹', <NumInput min={0} value={o.bundle_price} onChange={v => set(i, { bundle_price: v })} className={input} />)}
              {o.type === 'buy_x_get_y' && field('Buy (units)', <NumInput min={1} empty={1} value={o.buy} onChange={v => set(i, { buy: v ?? 1 })} className={input} />)}
              {o.type === 'buy_x_get_y' && field('Get free (units)', <NumInput min={0} empty={0} value={o.get} onChange={v => set(i, { get: v ?? 0 })} className={input} />)}
              {o.type === 'nth_item_pct' && field('Every Nth unit', <NumInput min={1} empty={2} value={o.nth} onChange={v => set(i, { nth: v ?? 2 })} className={input} />)}
              {o.type === 'nth_item_pct' && field('% off that unit', <NumInput min={0} empty={0} value={o.nth_pct} onChange={v => set(i, { nth_pct: v ?? 0 })} className={input} />)}
              {o.type === 'gift_with_purchase' && <div className="col-span-2">{field('Gift (any estimate)', (
                <select value={o.gift_product_id ?? ''} onChange={e => set(i, { gift_product_id: e.target.value || undefined })} className={input}>
                  <option value="">Pick the gift…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ))}</div>}
              {o.type === 'mix_match' && field('Group size (any N)', <NumInput min={1} empty={2} value={o.bundle_size} onChange={v => set(i, { bundle_size: v ?? 2 })} className={input} />)}
              {o.type === 'mix_match' && field('Price per group ₹', <NumInput min={0} value={o.bundle_price} onChange={v => set(i, { bundle_price: v })} className={input} />)}
              {o.type === 'mix_match' && (
                <div className="col-span-2 space-y-1">
                  <p className="text-[11px] text-slate-500">Items in the pool</p>
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={(o.pool_ids ?? []).includes(p.id)}
                        onChange={e => set(i, { pool_ids: e.target.checked ? [...(o.pool_ids ?? []), p.id] : (o.pool_ids ?? []).filter(x => x !== p.id) })} />
                      {p.name}
                    </label>
                  ))}
                </div>
              )}
              {o.type === 'tiered_spend' && <StepsEditor steps={o.steps ?? []} onChange={steps => set(i, { steps })} input={input} />}
              {o.type !== 'tiered_spend' && field('Min order ₹ (blank = none)', <NumInput min={0} value={o.min_order_amount} onChange={v => set(i, { min_order_amount: v ?? null })} className={input} />)}
            </div>
          )}
        </div>
      ))}
      {offers.length < MAX_OFFERS && (
        <button onClick={add} className="text-xs text-orange-400 hover:underline pt-1">+ Add offer</button>
      )}
    </div>
  )
}

function Comparison({ lines, offers, config, opts }: { lines: BasketLine[]; offers: Offer[]; config: PlannerConfig; opts: OrderOptions }) {
  const ranked = compareOffers(lines, offers, config, opts)
  const [selected, setSelected] = useState(0)
  const pick = ranked[Math.min(selected, ranked.length - 1)]
  const baseline = ranked[0]?.baseline

  return (
    <div className="space-y-4">
      {baseline && (
        <p className="text-xs text-slate-400">
          Without any offer this basket earns <strong className="text-slate-200">{formatINR(baseline.profit)}</strong> per order
          at <strong className="text-slate-200">{formatPct(baseline.margin_pct)}</strong> net margin. Offers are ranked by profit per order; click one for details.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800">
              {['#', 'Offer', 'Customer saves', 'Margin', 'Profit / order', 'Cost / order', 'Break-even needs'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 tabular-nums">
            {ranked.map((a, i) => (
              <tr key={i} onClick={() => setSelected(i)}
                className={`cursor-pointer transition-colors ${pick === a ? 'bg-orange-950/30' : 'hover:bg-zinc-900/50'}`}>
                <td className={`px-3 py-2 ${pick === a ? 'text-orange-400 shadow-[inset_3px_0_0_#f97316]' : 'text-slate-500'}`}>{i + 1}</td>
                <td className="px-3 py-2 min-w-[180px]">
                  <p className="text-slate-200">{a.offer.label || 'Untitled'}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {a.store_supported ? <Badge tone="muted">store can run it</Badge> : <Badge tone="warn">planning only</Badge>}
                    {!a.outcome.coupon_applied
                      ? <Badge tone="muted">not triggered</Badge>
                      : a.customer_saving === 0 && <Badge tone="muted">no effect here</Badge>}
                  </p>
                </td>
                <td className="px-3 py-2 text-slate-300">{formatINR(a.customer_saving)}</td>
                <td className="px-3 py-2"><Badge tone={a.outcome.below_floor ? 'bad' : 'ok'}>{formatPct(a.outcome.margin_pct)}</Badge></td>
                <td className={`px-3 py-2 ${a.outcome.profit < 0 ? 'text-red-400' : 'text-slate-200'}`}>{formatINR(a.outcome.profit)}</td>
                <td className="px-3 py-2 text-slate-300">{formatINR(a.cost_per_order)}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${a.break_even_lift_pct == null ? 'text-red-400' : 'text-slate-300'}`}>{describeLift(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pick && <OfferDetail lines={lines} analysis={pick} config={config} />}
    </div>
  )
}

function OutcomeRows({ o }: { o: OrderOutcome }) {
  return (
    <div className="divide-y divide-slate-800">
      <CopyValue label="Subtotal" value={o.subtotal} />
      <CopyValue label="Discount" value={o.discount} />
      <CopyValue label="Shipping charged to customer" value={o.shipping_charged} />
      {o.shipping_waived > 0 && <CopyValue label="Shipping fee waived (not in discount_amount)" value={o.shipping_waived} />}
      {(o.gift_wrap_charged > 0 || o.gift_wrap_waived > 0) && <CopyValue label="Gift wrap charged" value={o.gift_wrap_charged} />}
      {o.gift_wrap_waived > 0 && <CopyValue label="Gift wrap fee waived" value={o.gift_wrap_waived} />}
      {o.gift_cost > 0 && <CopyValue label={`Free gift: costs you (customer sees ${formatINR(o.gift_value)})`} value={o.gift_cost} />}
      <CopyValue label="Revenue" value={o.revenue} />
      <CopyValue label="Cost (goods + shipping + gateway)" value={o.cost} />
      <CopyValue label="Profit" value={o.profit} />
    </div>
  )
}

function OfferDetail({ lines, analysis: a, config }: { lines: BasketLine[]; analysis: OfferAnalysis; config: PlannerConfig }) {
  const limits = safeLimits(lines, a.offer, config)
  const subtotal = a.outcome.subtotal
  const code = (a.offer.label || 'OFFER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'OFFER'
  const row = a.store_supported ? {
    title: a.offer.label, type: a.offer.type, discount_value: a.offer.discount_value, coupon_code: code,
    min_order_amount: a.offer.min_order_amount ?? null,
    max_discount_amount: a.offer.type === 'percentage' ? a.offer.max_discount_amount ?? null : null,
  } : null

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">{a.offer.label || 'Offer'} on this basket</p>
          <Badge tone={a.outcome.below_floor ? 'bad' : 'ok'}>{formatPct(a.outcome.margin_pct)} margin</Badge>
        </div>
        {!a.outcome.coupon_applied ? (
          <p className="px-3 py-2 text-xs text-amber-300">Not triggered on this basket (below the minimum order, or not enough units).</p>
        ) : a.customer_saving === 0 && (
          <p className="px-3 py-2 text-xs text-amber-300">No effect on this basket: the customer saves nothing (for free shipping, the basket is already over the free-shipping threshold).</p>
        )}
        <OutcomeRows o={a.outcome} />
      </div>

      <div className="space-y-4">
        <TypeChecks lines={lines} offer={a.offer} config={config} />
        <div className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs text-slate-400">
          <SectionLabel>Safe limits on this basket ({config.min_margin_pct}% floor)</SectionLabel>
          <p>Deepest percentage off: <strong className="text-orange-400">{formatPct(limits.max_safe_percent)}</strong></p>
          <p>Largest flat amount off: <strong className="text-orange-400">{formatINR(limits.max_safe_flat)}</strong>
            {' '}(so the lowest bundle price for this basket is <strong className="text-slate-200">{formatINR(Math.max(0, subtotal - limits.max_safe_flat))}</strong>)</p>
          {a.store_supported && (
            <p>Minimum order for this offer to keep the floor: <strong className="text-orange-400">
              {limits.suggested_min_order == null ? 'none: even ₹50,000 orders miss it' : limits.suggested_min_order === 0 ? 'none needed, it holds at any order value' : formatINR(limits.suggested_min_order)}</strong>
              <span className="text-slate-600"> (assumes bigger orders have this basket's cost ratio)</span></p>
          )}
          <p>To earn the same total profit it needs <strong className="text-slate-200">{describeLift(a)}</strong>.</p>
        </div>
        {row ? (
          <div className="border border-zinc-800 rounded-lg">
            <CopyValue label="store_promotions row (JSON, not written anywhere)" value="Copy" text={JSON.stringify(row, null, 2)} />
          </div>
        ) : (
          <p className="text-xs text-slate-500">The store cannot run this offer type yet; it is here to plan with.</p>
        )}
      </div>
    </div>
  )
}

function CampaignBudget({ lines, offers, mix, setMix, config, opts }: {
  lines: BasketLine[]
  offers: Offer[]
  mix: CampaignBasket[]
  setMix: (m: CampaignBasket[]) => void
  config: PlannerConfig
  opts: OrderOptions
}) {
  const [offerIdx, setOfferIdx] = useState(0)
  const [label, setLabel] = useState('')
  const [weight, setWeight] = useState(1)
  const [baseline, setBaseline] = useState(100)
  const [uplift, setUplift] = useState(20)
  const [redemption, setRedemption] = useState(60)
  const offer = offers[Math.min(offerIdx, offers.length - 1)]

  if (!offer) return <Empty>Add an offer on the left to plan a campaign.</Empty>

  // Per-order figures: the saved basket mix if there is one, else the current basket.
  const per_order = (() => {
    if (mix.length > 0) {
      const w = simulateCampaign(mix, offer, config, opts)
      const wo = simulateCampaign(mix, null, config, opts)
      return { profit_with: w.expected_profit, profit_without: wo.expected_profit, discount: w.expected_discount, shipping_waived: w.expected_shipping_waived }
    }
    const a = analyzeOffer(lines, offer, config, opts)
    return { profit_with: a.outcome.profit, profit_without: a.baseline.profit, discount: a.outcome.discount, shipping_waived: a.outcome.shipping_waived }
  })()
  const r = campaignBudget(per_order, { baseline_orders: baseline, uplift_pct: uplift, redemption_pct: redemption })

  return (
    <div className="space-y-4">
      <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
        <SectionLabel>Campaign</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-xs text-slate-400">Offer
            <select value={Math.min(offerIdx, offers.length - 1)} onChange={e => setOfferIdx(Number(e.target.value))}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100">
              {offers.map((o, i) => <option key={i} value={i}>{o.label || `Offer ${i + 1}`}</option>)}
            </select>
          </label>
          <NumberField label="Orders in the period without it" value={baseline} onChange={setBaseline} />
          <NumberField label="Expected extra orders" suffix="%" value={uplift} onChange={setUplift} />
          <NumberField label="Orders that use the offer" suffix="%" value={redemption} onChange={setRedemption} />
        </div>
        <p className="text-xs text-slate-500">
          Per-order figures come from {mix.length > 0 ? `the saved basket mix (${mix.length} baskets)` : 'the current basket'}.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
            <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Over the period</p>
            <Badge tone={r.gain >= 0 ? 'ok' : 'bad'}>{r.gain >= 0 ? 'comes out ahead' : 'loses money'}</Badge>
          </div>
          <div className="divide-y divide-slate-800">
            <CopyValue label="Orders with the offer running" value={r.orders_with_offer.toFixed(0)} />
            <CopyValue label="Orders using the offer" value={r.redeemed_orders.toFixed(0)} />
            <CopyValue label="Discount given away" value={r.discount_spend} />
            <CopyValue label="Shipping given away" value={r.shipping_given_away} />
            <CopyValue label="Profit without the offer" value={r.profit_without_offer} />
            <CopyValue label="Profit with the offer" value={r.profit_with_offer} />
            <CopyValue label="Difference" value={r.gain} />
          </div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-4 text-xs text-slate-400 space-y-2">
          <SectionLabel>Break-even</SectionLabel>
          {r.break_even_uplift_pct == null ? (
            <p className="text-red-300">No amount of extra orders pays for this: orders using the offer lose money.</p>
          ) : (
            <p>
              The campaign needs <strong className="text-orange-400">{r.break_even_uplift_pct <= 0 ? 'no' : `+${formatPct(r.break_even_uplift_pct)}`}</strong> extra
              orders to match the profit you would make without it. You assumed <strong className="text-slate-200">+{formatPct(uplift)}</strong>.
            </p>
          )}
          <p className="text-slate-500">Assumes the extra orders look like the basket, and that offer users would partly have bought anyway.</p>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-lg p-4 space-y-3">
        <SectionLabel>Basket mix (optional)</SectionLabel>
        <p className="text-xs text-slate-500">Save the current basket as a typical order with how common it is. With a mix saved, the budget uses the weighted average order.</p>
        <div className="flex gap-2 items-end">
          <label className="flex-1 text-xs text-slate-400">Label
            <input value={label} onChange={e => setLabel(e.target.value)}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-slate-100" />
          </label>
          <div className="w-24"><NumberField label="Weight" value={weight} onChange={setWeight} /></div>
          <button disabled={!label.trim()} onClick={() => { setMix([...mix, { label: label.trim(), lines, weight }]); setLabel('') }}
            className="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-500 text-white text-sm disabled:opacity-40">Save</button>
        </div>
        {mix.map(m => (
          <div key={m.label} className="flex items-center justify-between text-sm text-slate-300">
            <span>{m.label} <span className="text-slate-500">· weight {m.weight}</span></span>
            <button onClick={() => setMix(mix.filter(x => x.label !== m.label))} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SalePlanner() {
  const product = useSelectedProduct()
  const config = usePlannerStore(s => s.config)
  const volume = useSettingsStore(s => s.volume_tiers)
  const [pct, setPct] = useState(15)

  return (
    <div className="space-y-4 max-w-xl">
      <ProductPicker />
      {!product ? <Empty>Pick an estimate to plan a sale price.</Empty> : product.bom.length === 0 ? (
        <Empty>This estimate has no components yet, so there is no cost to plan against.</Empty>
      ) : (() => {
        const { landed: cost, ladder } = planProduct(product, volumeTiersToCore(volume), config)
        const landed = cost.landed_cost
        const plan = planSale(ladder.b2c_price, pct, landed, config)
        return (
          <>
            <NumberField label="Sale discount" suffix="%" step={1} value={pct} onChange={setPct} />
            <div className="border border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-800">
              <CopyValue label="Sale price (B2C)" value={plan.sale_price} text={String(plan.sale_price)} />
              <CopyValue label="Compare at (strike-through)" value={plan.compare_at_price} text={String(plan.compare_at_price)} />
              <CopyValue label="Customer sees" value={`${formatPct(plan.customer_saving_pct)} off`} />
              <CopyValue label="Lowest price that holds the floor" value={plan.floor_price} />
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-slate-300">Net margin at sale price</span>
                <Badge tone={plan.below_floor ? 'bad' : 'ok'}>{landed > 0 ? formatPct(plan.margin_pct) : 'no cost data'}</Badge>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// What each Offers section is for and how to read it.
function SectionGuide({ section }: { section: Section }) {
  if (section === 'compare') return (
    <Guide id="offers-compare" title="How to compare offers">
      <ol className="list-decimal pl-4 space-y-1">
        <li>Build one typical order in the <strong className="text-slate-300">Basket</strong>: add estimates and set quantities. Prices are the planned B2C prices.</li>
        <li>Set up to eight <strong className="text-slate-300">offers</strong>. Percentage, flat and free shipping can run on the store today; the other types are for planning only.</li>
        <li>The table ranks them by profit per order. Click a row to see the full order and how far you can safely push it.</li>
      </ol>
      <dl className="space-y-1 pt-1">
        <Term name="Customer saves">The discount plus any shipping fee the offer waives.</Term>
        <Term name="Margin">Profit as a share of what the customer pays, after goods, your real shipping cost and the gateway fee.</Term>
        <Term name="Cost / order">Profit you give up on each order compared with no offer.</Term>
        <Term name="Break-even needs">How many more orders the offer must bring for total profit to stay the same. "Never" means each order loses money.</Term>
        <Term name="Safe limits">The deepest discount that still keeps your margin floor (set in Planner Settings).</Term>
      </dl>
      <dl className="space-y-1 pt-1 border-t border-sky-900/40">
        <Term name="Spend more, save more">Bigger orders unlock bigger amounts off. Each step is checked at its own threshold, where it is thinnest.</Term>
        <Term name="Free gift">Give any estimate free above a spend. It costs you its landed cost, but the customer sees its full price, so it often beats a coupon of the same value.</Term>
        <Term name="Nth item % off">For example, every 2nd unit 50% off. Counts per item, so it rewards buying several of the same thing.</Term>
        <Term name="Mix and match">Any N items from a pool at one price. Customers can fill a group with the costliest item, so that worst case is checked against your floor.</Term>
        <Term name="Gift wrap">Tick it on the basket to add the wrap fee and your real wrap cost; "Free gift wrap" waives the fee.</Term>
      </dl>
    </Guide>
  )
  if (section === 'campaign') return (
    <Guide id="offers-campaign" title="How to plan a campaign budget">
      <ol className="list-decimal pl-4 space-y-1">
        <li>Pick an offer, and enter how many orders you would get in the period <strong className="text-slate-300">without</strong> it.</li>
        <li>Enter the extra orders you expect it to bring, and the share of orders that will actually use it (not everyone enters a code).</li>
        <li>Read the difference: profit with the offer minus profit without. The break-even box says the lift you need for it to pay off.</li>
      </ol>
      <p>For a more realistic average order, save a few different baskets in the <strong className="text-slate-300">Basket mix</strong> with how common each is.</p>
    </Guide>
  )
  return (
    <Guide id="offers-sale" title="How to plan a sale price">
      <p>Pick an estimate and a sale discount. The regular planned price becomes the strike-through compare-at price, and the sale price is checked against your margin floor.</p>
      <p><strong className="text-slate-300">Lowest price that holds the floor</strong> is the price you should never go below, whatever the promotion.</p>
    </Guide>
  )
}

function StepsEditor({ steps, onChange, input }: { steps: Array<{ min_order: number; amount_off: number }>; onChange: (s: Array<{ min_order: number; amount_off: number }>) => void; input: string }) {
  const set = (i: number, patch: Partial<{ min_order: number; amount_off: number }>) => onChange(steps.map((st, j) => (j === i ? { ...st, ...patch } : st)))
  return (
    <div className="col-span-2 space-y-1">
      <p className="text-[11px] text-slate-500">Steps: spend at least → amount off</p>
      {steps.map((st, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <NumInput min={0} empty={0} value={st.min_order} onChange={v => set(i, { min_order: v ?? 0 })} className={input} aria-label="Spend at least" />
          <NumInput min={0} empty={0} value={st.amount_off} onChange={v => set(i, { amount_off: v ?? 0 })} className={input} aria-label="Amount off" />
          <button onClick={() => onChange(steps.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 pb-1.5"><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...steps, { min_order: (steps.at(-1)?.min_order ?? 499) + 1000, amount_off: (steps.at(-1)?.amount_off ?? 0) + 100 }])}
        className="text-[11px] text-orange-400 hover:underline">+ Add step</button>
    </div>
  )
}

// Checks that only make sense for one offer type: each spend step at its threshold,
// the worst mix-and-match group, and what a free gift costs against what it is worth.
function TypeChecks({ lines, offer, config }: { lines: BasketLine[]; offer: Offer; config: PlannerConfig }) {
  if (offer.type === 'tiered_spend') {
    const checks = tieredStepChecks(lines, offer, config)
    if (checks.length === 0) return null
    return (
      <div className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs text-slate-400">
        <SectionLabel>Each step at its threshold</SectionLabel>
        {checks.map(c => (
          <p key={c.min_order} className="flex items-center justify-between gap-3">
            <span>{formatINR(c.amount_off)} off an order of exactly {formatINR(c.min_order)}</span>
            <Badge tone={c.below_floor ? 'bad' : 'ok'}>{formatPct(c.margin_pct)}</Badge>
          </p>
        ))}
        <p className="text-slate-600">Assumes orders have this basket's cost ratio.</p>
      </div>
    )
  }
  if (offer.type === 'mix_match') {
    const c = mixMatchCheck(offer, config)
    if (!c) return <p className="text-xs text-amber-300">Pick at least one costed item for the pool and set a group price.</p>
    return (
      <div className="border border-zinc-800 rounded-lg p-4 space-y-2 text-xs text-slate-400">
        <SectionLabel>Worst and best group</SectionLabel>
        <p className="flex items-center justify-between gap-3">
          <span>Worst: a group of all <strong className="text-slate-300">{c.worst_item}</strong></span>
          <Badge tone={c.worst_below_floor ? 'bad' : 'ok'}>{formatPct(c.worst_margin_pct)}</Badge>
        </p>
        <p className="flex items-center justify-between gap-3"><span>Best: a group of the cheapest item to make</span><Badge tone="ok">{formatPct(c.best_margin_pct)}</Badge></p>
        {c.worst_below_floor && <p className="text-red-300">Raise the group price or drop {c.worst_item} from the pool.</p>}
      </div>
    )
  }
  if (offer.type === 'gift_with_purchase') {
    if (!offer.gift) return <p className="text-xs text-amber-300">Pick an estimate with costed components as the gift.</p>
    return (
      <div className="border border-zinc-800 rounded-lg p-4 text-xs text-slate-400">
        <SectionLabel>The gift</SectionLabel>
        <p><strong className="text-slate-300">{offer.gift.name}</strong> costs you <strong className="text-orange-400">{formatINR(offer.gift.landed_cost)}</strong>; the customer sees a {formatINR(offer.gift.unit_price)} gift.</p>
      </div>
    )
  }
  return null
}
