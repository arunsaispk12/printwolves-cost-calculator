import type { BasketLine, Offer, OrderOptions, OrderOutcome, PlannerConfig } from '@/types/planner'
import { evaluateOrder, isStoreSupported, maxSafePercentCoupon } from '@/engine/offers/coupon'
import { round2 } from '@/engine/landedCost'

export interface OfferAnalysis {
  offer: Offer
  outcome: OrderOutcome
  baseline: OrderOutcome
  customer_saving: number
  cost_per_order: number
  // Extra orders needed for the offer to earn what the same orders earn without it.
  // null when the offer makes each order lose money, so no volume can recover it.
  break_even_lift_pct: number | null
  store_supported: boolean
}

export interface SafeLimits {
  max_safe_percent: number
  max_safe_flat: number
  suggested_min_order: number | null
}

// Profit per order with the offer vs without, and the volume lift that makes up the
// difference: the general form of discount / (margin - discount).
export function analyzeOffer(lines: BasketLine[], offer: Offer, config: PlannerConfig, opts: OrderOptions = {}): OfferAnalysis {
  const baseline = evaluateOrder(lines, null, config, opts)
  const outcome = evaluateOrder(lines, offer, config, opts)
  const cost_per_order = round2(baseline.profit - outcome.profit)
  const break_even_lift_pct = outcome.profit > 0 && baseline.profit > 0
    ? round2((baseline.profit / outcome.profit - 1) * 100)
    : null
  return {
    offer,
    outcome,
    baseline,
    customer_saving: round2(outcome.discount + outcome.shipping_waived + outcome.gift_wrap_waived + outcome.gift_value),
    cost_per_order,
    break_even_lift_pct,
    store_supported: isStoreSupported(offer),
  }
}

// Same basket, several offers, most profitable first.
export function compareOffers(lines: BasketLine[], offers: Offer[], config: PlannerConfig, opts: OrderOptions = {}): OfferAnalysis[] {
  return offers.map(o => analyzeOffer(lines, o, config, opts)).sort((a, b) => b.outcome.profit - a.outcome.profit)
}

// Largest flat amount off this basket that keeps the margin floor.
export function maxSafeFlat(lines: BasketLine[], config: PlannerConfig): number {
  const holds = (amount: number) =>
    !evaluateOrder(lines, { type: 'flat', label: '', discount_value: amount }, config).below_floor
  if (!holds(0)) return 0
  let lo = 0
  let hi = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (holds(mid)) lo = mid
    else hi = mid
  }
  return Math.floor(lo)
}

// Smallest order value from which this store-type offer keeps the margin floor for
// every larger order too, assuming bigger orders have this basket's cost-to-price
// ratio. "Every larger order" matters: on a tiny order the customer's shipping fee can
// exceed the real shipping cost and make the order look profitable, and margin dips
// again where free shipping starts. Rounded up to the next ₹50. 0 means no minimum is
// needed (it holds at any order value); null means even ₹50,000 orders miss the floor.
export function suggestedMinOrder(lines: BasketLine[], offer: Offer, config: PlannerConfig): number | null {
  if (!isStoreSupported(offer)) return null
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const goods = lines.reduce((s, l) => s + l.landed_cost * l.quantity, 0)
  if (subtotal <= 0) return null
  const cost_ratio = goods / subtotal
  const open = { ...offer, min_order_amount: null }
  const holds = (value: number) =>
    !evaluateOrder([{ unit_price: value, landed_cost: value * cost_ratio, quantity: 1 }], open, config).below_floor

  const top = 50000
  if (!holds(top)) return null
  for (let value = top; value >= 10; value -= 10) {
    if (!holds(value)) return Math.ceil((value + 10) / 50) * 50
  }
  return 0
}

export function safeLimits(lines: BasketLine[], offer: Offer, config: PlannerConfig): SafeLimits {
  return {
    max_safe_percent: maxSafePercentCoupon(lines, config, offer.type === 'percentage' ? offer.max_discount_amount ?? null : null),
    max_safe_flat: maxSafeFlat(lines, config),
    suggested_min_order: suggestedMinOrder(lines, offer, config),
  }
}

export interface BudgetInputs {
  baseline_orders: number
  uplift_pct: number
  redemption_pct: number
}

export interface BudgetResult {
  orders_with_offer: number
  redeemed_orders: number
  discount_spend: number
  shipping_given_away: number
  profit_without_offer: number
  profit_with_offer: number
  gain: number
  break_even_uplift_pct: number | null
}

// A campaign over a period. Orders grow by uplift; only redemption% of them use the
// offer, the rest pay full price. Compared against the baseline orders with no offer.
export function campaignBudget(
  per_order: { profit_with: number; profit_without: number; discount: number; shipping_waived: number },
  inputs: BudgetInputs,
): BudgetResult {
  const orders_with_offer = inputs.baseline_orders * (1 + inputs.uplift_pct / 100)
  const share = Math.min(Math.max(inputs.redemption_pct, 0), 100) / 100
  const redeemed_orders = orders_with_offer * share
  const blended = share * per_order.profit_with + (1 - share) * per_order.profit_without
  const profit_without_offer = inputs.baseline_orders * per_order.profit_without
  const profit_with_offer = orders_with_offer * blended
  return {
    orders_with_offer: round2(orders_with_offer),
    redeemed_orders: round2(redeemed_orders),
    discount_spend: round2(redeemed_orders * per_order.discount),
    shipping_given_away: round2(redeemed_orders * per_order.shipping_waived),
    profit_without_offer: round2(profit_without_offer),
    profit_with_offer: round2(profit_with_offer),
    gain: round2(profit_with_offer - profit_without_offer),
    break_even_uplift_pct: blended > 0 && per_order.profit_without > 0
      ? round2((per_order.profit_without / blended - 1) * 100)
      : null,
  }
}

export interface StepCheck {
  min_order: number
  amount_off: number
  margin_pct: number
  below_floor: boolean
}

// Tiered spend-and-save: the margin of an order landing exactly on each threshold (the
// thinnest order that earns that step), at this basket's cost-to-price ratio.
export function tieredStepChecks(lines: BasketLine[], offer: Offer, config: PlannerConfig): StepCheck[] {
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)
  const goods = lines.reduce((s, l) => s + l.landed_cost * l.quantity, 0)
  const ratio = subtotal > 0 ? goods / subtotal : 0
  return [...(offer.steps ?? [])]
    .sort((a, b) => a.min_order - b.min_order)
    .map(step => {
      const o = evaluateOrder(
        [{ unit_price: step.min_order, landed_cost: step.min_order * ratio, quantity: 1 }],
        { ...offer, steps: [step], min_order_amount: null },
        config,
      )
      return { ...step, margin_pct: o.margin_pct, below_floor: o.below_floor }
    })
}

export interface MixMatchCheck {
  worst_item: string
  worst_margin_pct: number
  best_margin_pct: number
  worst_below_floor: boolean
}

// Mix-and-match: customers can fill a group with the highest-cost item in the pool, so
// that group (bundle_size of it, at the bundle price) is the worst case to check.
export function mixMatchCheck(offer: Offer, config: PlannerConfig): MixMatchCheck | null {
  const pool = offer.pool ?? []
  const size = Math.max(1, Math.floor(offer.bundle_size ?? 2))
  const price = offer.bundle_price ?? 0
  if (pool.length === 0 || price <= 0) return null
  const margin = (landed: number) => {
    const o = evaluateOrder([{ unit_price: price, landed_cost: landed, quantity: 1 }], null, config)
    return { margin_pct: o.margin_pct, below_floor: o.below_floor }
  }
  const worst = pool.reduce((a, b) => (b.landed_cost > a.landed_cost ? b : a))
  const best = pool.reduce((a, b) => (b.landed_cost < a.landed_cost ? b : a))
  const w = margin(worst.landed_cost * size)
  return {
    worst_item: worst.name,
    worst_margin_pct: w.margin_pct,
    best_margin_pct: margin(best.landed_cost * size).margin_pct,
    worst_below_floor: w.below_floor,
  }
}
