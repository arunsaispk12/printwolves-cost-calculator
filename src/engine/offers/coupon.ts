import type { BasketLine, CouponSpec, Offer, OfferItem, OrderOptions, OrderOutcome, PlannerConfig } from '@/types/planner'
import { round2 } from '@/engine/landedCost'

// Mirrors KaspersLab-Ecommerce lib/promotions/discount.ts: percentage is capped
// by max_discount_amount, flat is the fixed value, both clamp to the subtotal,
// min_order_amount gates the whole coupon. Free shipping discounts nothing here;
// its cost is the shipping fee it waives.
export function resolveDiscount(subtotal: number, coupon: CouponSpec | null): { discount: number; free_shipping: boolean; applied: boolean } {
  if (!coupon) return { discount: 0, free_shipping: false, applied: false }
  if (coupon.min_order_amount != null && subtotal < coupon.min_order_amount) {
    return { discount: 0, free_shipping: false, applied: false }
  }
  if (coupon.type === 'free_shipping') return { discount: 0, free_shipping: true, applied: true }

  let discount = coupon.type === 'percentage' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value
  if (coupon.type === 'percentage' && coupon.max_discount_amount != null) {
    discount = Math.min(discount, coupon.max_discount_amount)
  }
  discount = Math.min(Math.max(discount, 0), subtotal)
  return { discount: round2(discount), free_shipping: false, applied: true }
}

export interface ResolvedOffer {
  discount: number
  free_shipping: boolean
  free_gift_wrap: boolean
  gift_cost: number
  gift_value: number
  applied: boolean
}

const NONE: ResolvedOffer = { discount: 0, free_shipping: false, free_gift_wrap: false, gift_cost: 0, gift_value: 0, applied: false }

// Mix-and-match: basket units that are in the pool are grouped `size` at a time, most
// expensive first (the customer's best case), and each full group sells at the price.
function mixMatchDiscount(lines: BasketLine[], pool: OfferItem[], size: number, price: number): number {
  const in_pool = (l: BasketLine) => l.id != null && pool.some(p => p.id === l.id)
  const units = lines.filter(in_pool).flatMap(l => Array(Math.max(0, Math.floor(l.quantity))).fill(l.unit_price) as number[])
  units.sort((a, b) => b - a)
  let discount = 0
  for (let i = 0; i + size <= units.length; i += size) {
    const group = units.slice(i, i + size).reduce((s, u) => s + u, 0)
    discount += Math.max(group - price, 0)
  }
  return discount
}

// Any offer on a basket. Coupon types defer to resolveDiscount so they match the store.
export function resolveOfferDiscount(lines: BasketLine[], subtotal: number, offer: CouponSpec | Offer | null): ResolvedOffer {
  if (!offer) return NONE
  if (offer.type === 'percentage' || offer.type === 'flat' || offer.type === 'free_shipping') {
    return { ...NONE, ...resolveDiscount(subtotal, offer as CouponSpec) }
  }
  const o = offer as Offer
  if (o.min_order_amount != null && subtotal < o.min_order_amount) return NONE
  const clamp = (d: number) => round2(Math.min(Math.max(d, 0), subtotal))

  switch (o.type) {
    case 'bundle_price': {
      const price = o.bundle_price ?? subtotal
      return { ...NONE, discount: clamp(subtotal - price), applied: true }
    }
    case 'buy_x_get_y': {
      const buy = Math.max(1, Math.floor(o.buy ?? 1))
      const get = Math.max(0, Math.floor(o.get ?? 0))
      const d = lines.reduce((s, l) => s + Math.floor(l.quantity / (buy + get)) * get * l.unit_price, 0)
      return { ...NONE, discount: clamp(d), applied: d > 0 }
    }
    case 'nth_item_pct': {
      const nth = Math.max(1, Math.floor(o.nth ?? 2))
      const pct = (o.nth_pct ?? 0) / 100
      const d = lines.reduce((s, l) => s + Math.floor(l.quantity / nth) * l.unit_price * pct, 0)
      return { ...NONE, discount: clamp(d), applied: d > 0 }
    }
    case 'tiered_spend': {
      const step = [...(o.steps ?? [])].sort((a, b) => b.min_order - a.min_order).find(s => subtotal >= s.min_order)
      return step ? { ...NONE, discount: clamp(step.amount_off), applied: true } : NONE
    }
    case 'gift_with_purchase':
      return o.gift ? { ...NONE, gift_cost: o.gift.landed_cost, gift_value: o.gift.unit_price, applied: true } : NONE
    case 'mix_match': {
      const d = mixMatchDiscount(lines, o.pool ?? [], Math.max(1, Math.floor(o.bundle_size ?? 2)), o.bundle_price ?? 0)
      return { ...NONE, discount: clamp(d), applied: d > 0 }
    }
    case 'free_gift_wrap':
      return { ...NONE, free_gift_wrap: true, applied: true }
  }
  return NONE
}

export function isStoreSupported(offer: Pick<Offer, 'type'>): boolean {
  return offer.type === 'percentage' || offer.type === 'flat' || offer.type === 'free_shipping'
}

// One order, end to end: what the business collects, spends, and keeps.
// The free-shipping threshold is tested on the pre-discount subtotal, as the store does.
// Gift wrap, when chosen, adds the fee charged (unless an offer waives it) and its real cost.
export function evaluateOrder(
  lines: BasketLine[],
  coupon: CouponSpec | Offer | null,
  config: PlannerConfig,
  opts: OrderOptions = {},
): OrderOutcome {
  const subtotal = round2(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0))
  const goods_cost = lines.reduce((s, l) => s + l.landed_cost * l.quantity, 0)

  const resolved = resolveOfferDiscount(lines, subtotal, coupon)
  const fee_due = subtotal >= config.free_shipping_threshold_inr ? 0 : config.customer_shipping_fee_inr
  const shipping_charged = resolved.free_shipping ? 0 : fee_due
  const shipping_waived = resolved.free_shipping ? fee_due : 0

  const wrap_fee = opts.gift_wrap ? config.gift_wrap_fee_inr ?? 0 : 0
  const gift_wrap_waived = resolved.free_gift_wrap ? wrap_fee : 0
  const gift_wrap_charged = wrap_fee - gift_wrap_waived
  const wrap_cost = opts.gift_wrap ? config.gift_wrap_cost_inr ?? 0 : 0

  const revenue = round2(subtotal - resolved.discount + shipping_charged + gift_wrap_charged)
  const gateway_fee = revenue * (config.gateway_fee_pct / 100)
  const cost = round2(goods_cost + resolved.gift_cost + config.outbound_shipping_cost_inr + wrap_cost + gateway_fee)
  const profit = round2(revenue - cost)
  const margin_pct = revenue > 0 ? round2((profit / revenue) * 100) : 0

  return {
    subtotal,
    discount: resolved.discount,
    shipping_charged,
    shipping_waived,
    gift_wrap_charged,
    gift_wrap_waived,
    gift_cost: resolved.gift_cost,
    gift_value: resolved.gift_value,
    revenue,
    cost,
    profit,
    margin_pct,
    below_floor: margin_pct < config.min_margin_pct,
    coupon_applied: resolved.applied,
  }
}

// Largest percentage coupon that keeps this basket at or above the margin floor.
export function maxSafePercentCoupon(lines: BasketLine[], config: PlannerConfig, max_discount_amount: number | null = null): number {
  const holds = (pct: number) =>
    !evaluateOrder(lines, { type: 'percentage', discount_value: pct, max_discount_amount }, config).below_floor
  if (!holds(0)) return 0
  let lo = 0
  let hi = 100
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (holds(mid)) lo = mid
    else hi = mid
  }
  return round2(lo)
}
