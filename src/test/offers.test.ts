import { evaluateOrder, isStoreSupported, resolveOfferDiscount } from '@/engine/offers/coupon'
import { analyzeOffer, campaignBudget, compareOffers, maxSafeFlat, mixMatchCheck, suggestedMinOrder, tieredStepChecks } from '@/engine/offers/analyze'
import { defaultPlannerConfig as config } from '@/lib/plannerDefaults'
import type { BasketLine, Offer } from '@/types/planner'

// One ESP32 board: sells at 839, lands at 525 (see planner.test.ts).
const one: BasketLine[] = [{ unit_price: 839, landed_cost: 525, quantity: 1 }]
const three: BasketLine[] = [{ unit_price: 839, landed_cost: 525, quantity: 3 }]

const pct = (v: number, extra: Partial<Offer> = {}): Offer => ({ type: 'percentage', label: `${v}% off`, discount_value: v, ...extra })

describe('resolveOfferDiscount — planning-only offers', () => {
  it('bundle price: discount is subtotal minus the bundle price', () => {
    const r = resolveOfferDiscount(three, 2517, { type: 'bundle_price', label: 'b', discount_value: 0, bundle_price: 2199 })
    expect(r.discount).toBe(318)
  })

  it('bundle price above the subtotal discounts nothing', () => {
    expect(resolveOfferDiscount(one, 839, { type: 'bundle_price', label: 'b', discount_value: 0, bundle_price: 999 }).discount).toBe(0)
  })

  it('buy 2 get 1: one free unit in three', () => {
    const r = resolveOfferDiscount(three, 2517, { type: 'buy_x_get_y', label: 'b2g1', discount_value: 0, buy: 2, get: 1 })
    expect(r.discount).toBe(839)
    expect(r.applied).toBe(true)
  })

  it('buy 2 get 1 does nothing on two units', () => {
    const two: BasketLine[] = [{ unit_price: 839, landed_cost: 525, quantity: 2 }]
    expect(resolveOfferDiscount(two, 1678, { type: 'buy_x_get_y', label: 'b2g1', discount_value: 0, buy: 2, get: 1 }).applied).toBe(false)
  })

  it('only the store coupon types are store-supported', () => {
    expect(isStoreSupported({ type: 'flat' })).toBe(true)
    expect(isStoreSupported({ type: 'bundle_price' })).toBe(false)
    expect(isStoreSupported({ type: 'buy_x_get_y' })).toBe(false)
  })
})

describe('analyzeOffer — break-even', () => {
  it('break-even lift is baseline profit / offer profit - 1', () => {
    const a = analyzeOffer(one, pct(10), config)
    const expected = (a.baseline.profit / a.outcome.profit - 1) * 100
    expect(a.break_even_lift_pct).toBeCloseTo(expected, 1)
    expect(a.cost_per_order).toBeCloseTo(a.baseline.profit - a.outcome.profit, 2)
  })

  it('matches discount / (margin - discount) when shipping and fees are left out', () => {
    // 20% off at a 55% margin needs about 57% more orders (the textbook example).
    const plain = { ...config, gateway_fee_pct: 0, outbound_shipping_cost_inr: 0, customer_shipping_fee_inr: 0 }
    const a = analyzeOffer([{ unit_price: 100, landed_cost: 45, quantity: 1 }], pct(20), plain)
    expect(a.break_even_lift_pct).toBeCloseTo(57.14, 1)
  })

  it('is null when the offer makes the order lose money', () => {
    expect(analyzeOffer(one, pct(60), config).break_even_lift_pct).toBeNull()
  })

  it('customer saving counts waived shipping too', () => {
    const a = analyzeOffer(one, { type: 'free_shipping', label: 'fs', discount_value: 0 }, config)
    expect(a.customer_saving).toBe(120)
  })
})

describe('compareOffers', () => {
  it('ranks the most profitable offer first', () => {
    const ranked = compareOffers(one, [pct(25), pct(5), pct(15)], config)
    expect(ranked.map(r => r.offer.discount_value)).toEqual([5, 15, 25])
  })
})

describe('safe limits', () => {
  it('max safe flat keeps the floor, one rupee more breaks it', () => {
    const flat = maxSafeFlat(one, config)
    expect(evaluateOrder(one, { type: 'flat', label: '', discount_value: flat }, config).below_floor).toBe(false)
    expect(evaluateOrder(one, { type: 'flat', label: '', discount_value: flat + 2 }, config).below_floor).toBe(true)
  })

  it('suggested min order holds the floor at that value and is a multiple of 50', () => {
    const min = suggestedMinOrder(one, { type: 'flat', label: '', discount_value: 200 }, config)
    expect(min).not.toBeNull()
    expect(min! % 50).toBe(0)
    expect(min!).toBeGreaterThan(0)
    const ratio = 525 / 839
    const at = evaluateOrder([{ unit_price: min!, landed_cost: min! * ratio, quantity: 1 }], { type: 'flat', label: '', discount_value: 200 }, config)
    expect(at.below_floor).toBe(false)
  })

  it('gives no min order for planning-only offers', () => {
    expect(suggestedMinOrder(one, { type: 'bundle_price', label: '', discount_value: 0, bundle_price: 700 }, config)).toBeNull()
  })
})

describe('campaignBudget', () => {
  const per_order = { profit_with: 200, profit_without: 300, discount: 100, shipping_waived: 0 }

  it('100 baseline orders, +30% lift, everyone redeems: 130 x 200 vs 100 x 300', () => {
    const r = campaignBudget(per_order, { baseline_orders: 100, uplift_pct: 30, redemption_pct: 100 })
    expect(r.orders_with_offer).toBe(130)
    expect(r.profit_with_offer).toBe(26000)
    expect(r.profit_without_offer).toBe(30000)
    expect(r.gain).toBe(-4000)
    expect(r.discount_spend).toBe(13000)
    expect(r.break_even_uplift_pct).toBe(50)
  })

  it('partial redemption blends offer and full-price orders', () => {
    const r = campaignBudget(per_order, { baseline_orders: 100, uplift_pct: 30, redemption_pct: 50 })
    expect(r.profit_with_offer).toBe(32500)
    expect(r.gain).toBe(2500)
    expect(r.break_even_uplift_pct).toBe(20)
  })

  it('no break-even when every redeemed order loses money and all redeem', () => {
    const r = campaignBudget({ ...per_order, profit_with: -10 }, { baseline_orders: 100, uplift_pct: 30, redemption_pct: 100 })
    expect(r.break_even_uplift_pct).toBeNull()
  })
})

describe('suggestedMinOrder — every larger order must hold', () => {
  const ratio = 525 / 839
  const at = (v: number, offer: Offer) => evaluateOrder([{ unit_price: v, landed_cost: v * ratio, quantity: 1 }], offer, config)

  it('₹200 flat: about ₹678 by hand, so ₹700, and every larger order holds', () => {
    const flat: Offer = { type: 'flat', label: '', discount_value: 200 }
    const min = suggestedMinOrder(one, flat, config)
    expect(min).toBe(700)
    expect(at(650, flat).below_floor).toBe(true)
    for (let v = 700; v <= 5000; v += 10) expect(at(v, flat).below_floor).toBe(false)
  })

  it('returns 0 when no minimum is needed: 10% off this basket holds at any value', () => {
    expect(suggestedMinOrder(one, { type: 'percentage', label: '', discount_value: 10 }, config)).toBe(0)
  })
})

describe('new offer types', () => {
  const kit: BasketLine[] = [
    { id: 'board', unit_price: 839, landed_cost: 525, quantity: 1 },
    { id: 'sensor', unit_price: 299, landed_cost: 120, quantity: 2 },
  ]
  // subtotal 839 + 598 = 1437

  it('nth item: every 2nd unit 50% off takes half of one sensor', () => {
    const o = evaluateOrder(kit, { type: 'nth_item_pct', label: '', discount_value: 0, nth: 2, nth_pct: 50 }, config)
    expect(o.discount).toBe(149.5)
  })

  it('tiered spend: the highest step reached wins', () => {
    const steps = [{ min_order: 999, amount_off: 100 }, { min_order: 1399, amount_off: 200 }, { min_order: 2499, amount_off: 400 }]
    expect(evaluateOrder(kit, { type: 'tiered_spend', label: '', discount_value: 0, steps }, config).discount).toBe(200)
    expect(evaluateOrder(one, { type: 'tiered_spend', label: '', discount_value: 0, steps }, config).coupon_applied).toBe(false)
  })

  it('tiered spend: each step is checked at its own threshold', () => {
    const steps = [{ min_order: 999, amount_off: 100 }, { min_order: 1999, amount_off: 700 }]
    const checks = tieredStepChecks(one, { type: 'tiered_spend', label: '', discount_value: 0, steps }, config)
    expect(checks.map(c => c.min_order)).toEqual([999, 1999])
    expect(checks[0].below_floor).toBe(false)
    expect(checks[1].below_floor).toBe(true)
  })

  it('gift with purchase: costs its landed cost, customer values it at its price', () => {
    const gift = { id: 'sensor', name: 'Sensor', unit_price: 299, landed_cost: 120 }
    const base = evaluateOrder(one, null, config)
    const o = evaluateOrder(one, { type: 'gift_with_purchase', label: '', discount_value: 0, gift }, config)
    expect(o.discount).toBe(0)
    expect(o.gift_cost).toBe(120)
    expect(o.profit).toBeCloseTo(base.profit - 120, 2)
    expect(analyzeOffer(one, { type: 'gift_with_purchase', label: '', discount_value: 0, gift }, config).customer_saving).toBe(299)
  })

  it('gift with purchase respects its minimum order', () => {
    const gift = { id: 'sensor', name: 'Sensor', unit_price: 299, landed_cost: 120 }
    expect(evaluateOrder(one, { type: 'gift_with_purchase', label: '', discount_value: 0, gift, min_order_amount: 1499 }, config).gift_cost).toBe(0)
  })

  it('mix and match: any 2 from the pool for 999, most expensive grouped first', () => {
    const pool = [{ id: 'board', name: 'Board', unit_price: 839, landed_cost: 525 }, { id: 'sensor', name: 'Sensor', unit_price: 299, landed_cost: 120 }]
    // Units 839, 299, 299 -> one group (839 + 299 = 1138) at 999 -> 139 off; the last sensor pays full price.
    const o = evaluateOrder(kit, { type: 'mix_match', label: '', discount_value: 0, pool, bundle_size: 2, bundle_price: 999 }, config)
    expect(o.discount).toBe(139)
  })

  it('mix and match ignores basket lines outside the pool', () => {
    const pool = [{ id: 'sensor', name: 'Sensor', unit_price: 299, landed_cost: 120 }]
    const o = evaluateOrder(kit, { type: 'mix_match', label: '', discount_value: 0, pool, bundle_size: 2, bundle_price: 499 }, config)
    expect(o.discount).toBe(99)
  })

  it('mix and match worst case is the pool item that costs most', () => {
    const pool = [{ id: 'board', name: 'Board', unit_price: 839, landed_cost: 525 }, { id: 'sensor', name: 'Sensor', unit_price: 299, landed_cost: 120 }]
    const check = mixMatchCheck({ type: 'mix_match', label: '', discount_value: 0, pool, bundle_size: 2, bundle_price: 999 }, config)!
    expect(check.worst_item).toBe('Board')
    expect(check.worst_below_floor).toBe(true)
    expect(check.best_margin_pct).toBeGreaterThan(check.worst_margin_pct)
  })

  it('gift wrap adds the fee and its cost; free gift wrap waives only the fee', () => {
    const plain = evaluateOrder(one, null, config)
    const wrapped = evaluateOrder(one, null, config, { gift_wrap: true })
    expect(wrapped.gift_wrap_charged).toBe(149)
    expect(wrapped.revenue).toBe(plain.revenue + 149)
    const free = evaluateOrder(one, { type: 'free_gift_wrap', label: '', discount_value: 0 }, config, { gift_wrap: true })
    expect(free.gift_wrap_charged).toBe(0)
    expect(free.gift_wrap_waived).toBe(149)
    expect(free.cost).toBeCloseTo(plain.cost + 40, 0)
  })

  it('only the three coupon types are store-supported', () => {
    for (const t of ['nth_item_pct', 'tiered_spend', 'gift_with_purchase', 'mix_match', 'free_gift_wrap'] as const) {
      expect(isStoreSupported({ type: t })).toBe(false)
    }
  })
})
