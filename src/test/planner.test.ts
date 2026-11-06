import { computeLandedCost } from '@/engine/landedCost'
import { buildLadder, maxSafeDiscountPct, netMarginPct, priceForMargin } from '@/engine/priceLadder'
import { planProduct, volumeTiersToCore } from '@/engine/planProduct'
import { buildVerificationPrompt } from '@/engine/verifyPrompt'
import { evaluateOrder, maxSafePercentCoupon, resolveDiscount } from '@/engine/offers/coupon'
import { simulateCampaign } from '@/engine/offers/campaign'
import { planSale } from '@/engine/offers/sale'
import { toPriceSheetCsv, toStepFive, toWizardImport } from '@/engine/stepFiveExport'
import { defaultPlannerConfig as config } from '@/lib/plannerDefaults'
import type { BasketLine, CorePriceTier } from '@/types/planner'

const tiers: CorePriceTier[] = [
  { min_quantity: 5, discount_pct: 10, tier_label: 'Starter' },
  { min_quantity: 25, discount_pct: 25, tier_label: 'Bulk' },
]

describe('computeLandedCost', () => {
  const lines = [
    { name: 'ESP32 module', quantity: 2, unit_cost: 100 },
    { name: 'Assembly labour (hr)', quantity: 0.5, unit_cost: 100 },
  ]

  it('sums the lines, then adds freight and packaging: 250 x 1.02 + 15 = 270', () => {
    const r = computeLandedCost({ bom: lines }, config)
    expect(r.source).toBe('bom')
    expect(r.unit_cost).toBe(250)
    expect(r.freight_cost).toBe(5)
    expect(r.packaging_cost).toBe(15)
    expect(r.landed_cost).toBe(270)
  })

  it('treats a zero quantity or zero unit cost as costing nothing', () => {
    const r = computeLandedCost({ bom: [{ name: 'a', quantity: 0, unit_cost: 500 }, { name: 'b', quantity: 3, unit_cost: 0 }] }, config)
    expect(r.source).toBe('none')
    expect(r.landed_cost).toBe(0)
  })

  it('reports no cost for an empty estimate rather than inventing one', () => {
    expect(computeLandedCost({ bom: [] }, config)).toMatchObject({ source: 'none', landed_cost: 0 })
  })
})

describe('planProduct', () => {
  it('generates the whole ladder from the lines alone', () => {
    const { landed, ladder } = planProduct({ bom: [{ name: 'Kit', quantity: 1, unit_cost: 500 }] }, tiers, config)
    expect(landed.landed_cost).toBe(525)
    expect(ladder.b2c_price).toBe(839)
  })

  it('applies a cost what-if to landed cost before pricing', () => {
    const base = planProduct({ bom: [{ name: 'Kit', quantity: 1, unit_cost: 500 }] }, tiers, config)
    const up = planProduct({ bom: [{ name: 'Kit', quantity: 1, unit_cost: 500 }] }, tiers, config, 10)
    expect(up.shifted).toBeCloseTo(577.5, 1)
    expect(up.ladder.b2c_price).toBeGreaterThan(base.ladder.b2c_price)
  })

  it('turns calculator volume tiers into Core tiers, dropping the 1-unit row', () => {
    expect(volumeTiersToCore([
      { min_qty: 1, label: 'Single', discount_pct: 0 },
      { min_qty: 5, label: 'Starter', discount_pct: 5 },
    ])).toEqual([{ min_quantity: 5, discount_pct: 5, tier_label: 'Starter' }])
  })
})

describe('price ladder', () => {
  it('prices 525 landed at 35% net margin: 525 / 0.6264 = 838.1 -> 839', () => {
    const ladder = buildLadder(525, tiers, config)
    expect(ladder.b2c_price).toBe(839)
    expect(ladder.margin_pct).toBeCloseTo(35.07, 1)
    expect(ladder.b2b_price).toBe(756)
    expect(ladder.compare_at_price).toBe(1099)
  })

  it('flags the 25% tier as under the 15% floor and names the safe discount', () => {
    const ladder = buildLadder(525, tiers, config)
    expect(ladder.tiers[0].below_floor).toBe(false)
    expect(ladder.tiers[1].unit_price).toBe(630)
    expect(ladder.tiers[1].below_floor).toBe(true)
    expect(ladder.tiers[1].max_safe_discount_pct).toBeCloseTo(24.28, 1)
    expect(ladder.issues.some(i => i.includes('Bulk'))).toBe(true)
  })

  it('refuses a price when margin plus gateway fee reaches 100%', () => {
    const ladder = buildLadder(100, [], { ...config, target_margin_pct: 98 })
    expect(ladder.b2c_price).toBe(0)
    expect(ladder.issues.length).toBeGreaterThan(0)
  })

  it('flags missing cost data', () => {
    expect(buildLadder(0, [], config).issues[0]).toMatch(/No cost data/)
  })

  it('priceForMargin and netMarginPct are inverses', () => {
    const p = priceForMargin(525, 20, config.gateway_fee_pct)
    expect(netMarginPct(p, 525, config.gateway_fee_pct)).toBeCloseTo(20, 1)
  })

  it('maxSafeDiscountPct is 0 when the price is already at the floor', () => {
    const floor = priceForMargin(525, config.min_margin_pct, config.gateway_fee_pct)
    expect(maxSafeDiscountPct(floor - 1, 525, config.min_margin_pct, config.gateway_fee_pct)).toBe(0)
  })
})

describe('resolveDiscount (parity with the store coupon rules)', () => {
  it('caps a percentage coupon: 20% of 5000 capped at 750', () => {
    expect(resolveDiscount(5000, { type: 'percentage', discount_value: 20, max_discount_amount: 750 }).discount).toBe(750)
  })

  it('does nothing below min_order_amount', () => {
    const r = resolveDiscount(400, { type: 'percentage', discount_value: 20, min_order_amount: 499 })
    expect(r).toEqual({ discount: 0, free_shipping: false, applied: false })
  })

  it('clamps a flat coupon to the subtotal', () => {
    expect(resolveDiscount(100, { type: 'flat', discount_value: 500 }).discount).toBe(100)
  })

  it('free shipping discounts nothing and flags the waiver', () => {
    expect(resolveDiscount(900, { type: 'free_shipping', discount_value: 0 })).toEqual({ discount: 0, free_shipping: true, applied: true })
  })
})

describe('evaluateOrder', () => {
  const lines: BasketLine[] = [{ unit_price: 839, landed_cost: 525, quantity: 1 }]

  it('no coupon: revenue 959, cost 525 + 70 + gateway, margin about 35.6%', () => {
    const o = evaluateOrder(lines, null, config)
    expect(o.revenue).toBe(959)
    expect(o.cost).toBeCloseTo(617.63, 1)
    expect(o.margin_pct).toBeCloseTo(35.6, 1)
  })

  it('free shipping coupon: customer pays no fee and the waived Rs 120 is counted', () => {
    const o = evaluateOrder(lines, { type: 'free_shipping', discount_value: 0 }, config)
    expect(o.shipping_charged).toBe(0)
    expect(o.shipping_waived).toBe(120)
    expect(o.revenue).toBe(839)
  })

  it('20% coupon drops margin to about 22.4%', () => {
    const o = evaluateOrder(lines, { type: 'percentage', discount_value: 20, max_discount_amount: 750 }, config)
    expect(o.discount).toBeCloseTo(167.8, 1)
    expect(o.margin_pct).toBeCloseTo(22.4, 0)
    expect(o.below_floor).toBe(false)
  })

  it('threshold is tested on the pre-discount subtotal', () => {
    const big: BasketLine[] = [{ unit_price: 1300, landed_cost: 700, quantity: 1 }]
    const o = evaluateOrder(big, { type: 'flat', discount_value: 300 }, config)
    expect(o.shipping_charged).toBe(0)
  })

  it('maxSafePercentCoupon lands on the floor', () => {
    const pct = maxSafePercentCoupon(lines, config)
    const at = evaluateOrder(lines, { type: 'percentage', discount_value: pct }, config)
    expect(at.margin_pct).toBeGreaterThanOrEqual(config.min_margin_pct - 0.05)
    const over = evaluateOrder(lines, { type: 'percentage', discount_value: pct + 1 }, config)
    expect(over.below_floor).toBe(true)
  })

  it('maxSafePercentCoupon is 0 when the basket is already under the floor', () => {
    const thin: BasketLine[] = [{ unit_price: 600, landed_cost: 560, quantity: 1 }]
    expect(maxSafePercentCoupon(thin, config)).toBe(0)
  })
})

describe('simulateCampaign', () => {
  it('weights baskets and lists those under the floor', () => {
    const result = simulateCampaign([
      { label: 'healthy', weight: 3, lines: [{ unit_price: 839, landed_cost: 525, quantity: 1 }] },
      { label: 'thin', weight: 1, lines: [{ unit_price: 600, landed_cost: 520, quantity: 1 }] },
    ], { type: 'percentage', discount_value: 20 }, config)
    expect(result.baskets_below_floor).toEqual(['thin'])
    expect(result.expected_revenue).toBeGreaterThan(0)
    expect(result.expected_profit).toBeLessThan(result.expected_revenue)
  })
})

describe('planSale', () => {
  it('keeps compare-at at the regular price and checks the floor', () => {
    const plan = planSale(839, 20, 525, config)
    expect(plan.sale_price).toBe(672)
    expect(plan.compare_at_price).toBe(839)
    expect(plan.customer_saving_pct).toBeCloseTo(19.9, 0)
    expect(plan.floor_price).toBe(636)
    expect(plan.below_floor).toBe(false)
  })

  it('flags a sale below the floor', () => {
    expect(planSale(839, 30, 525, config).below_floor).toBe(true)
  })
})

describe('Step 5 export', () => {
  it('emits the wizard fields and a CSV row', () => {
    const ladder = buildLadder(525, tiers, config)
    const values = toStepFive(ladder, 500, 0)
    expect(values).toMatchObject({ cost_price: 500, base_price: 839, b2c_price: 839, b2b_price: 756, compare_at_price: 1099, gst_rate: 0 })
    expect(values.tiers[0]).toEqual({ min_quantity: 5, discount_pct: 10, tier_label: 'Starter' })
    const csv = toPriceSheetCsv([{ name: 'USB hub', values }])
    expect(csv.split('\n')[1]).toBe('"USB hub",500,839,839,756,1099,0,"5:10:Starter|25:25:Bulk"')
  })
})

describe('Core wizard import', () => {
  const ladder = buildLadder(525, tiers, config)
  const values = toStepFive(ladder, 500, 0)

  it('has the four fields the wizard requires, using the shorthand business key', () => {
    const j = toWizardImport(values, { name: 'USB hub', brand: 'kl', sku: ' KL-HUB-1 ' })
    expect(j).toMatchObject({ business_id: 'kl', product_type: 'physical', sku: 'KL-HUB-1', name: 'USB hub' })
    expect(toWizardImport(values, { name: 'x', brand: 'pw', sku: 's' }).business_id).toBe('pg')
  })

  it('carries cost, prices and GST, and leaves unknown fields to the wizard defaults', () => {
    const j = toWizardImport(values, { name: 'USB hub', brand: 'kl', sku: 'S' })
    expect(j).toMatchObject({ cost_price: 500, base_price: 839, b2c_price: 839, b2b_price: 756, compare_at_price: 1099, gst_rate: 0 })
    expect(j).not.toHaveProperty('hsn_code')
    expect(j).not.toHaveProperty('description')
  })

  it("gives tiers Core's max_quantity: next min - 1, last open", () => {
    const j = toWizardImport(values, { name: 'x', brand: 'kl', sku: 'S' })
    expect(j.price_tiers.map(t => [t.min_quantity, t.max_quantity])).toEqual([[5, 24], [25, null]])
  })

  it('only includes the BOM when asked', () => {
    const bom = [{ name: 'ESP32-S3', quantity: 1, unit_cost: 400 }]
    expect(toWizardImport(values, { name: 'x', brand: 'kl', sku: 'S' })).not.toHaveProperty('bom')
    expect(toWizardImport(values, { name: 'x', brand: 'kl', sku: 'S', bom }).bom).toEqual([{ component_sku: 'ESP32-S3', quantity: 1, unit_cost: 400 }])
  })
})

describe('buildVerificationPrompt', () => {
  const product = {
    id: 'x', name: 'ESP32 Smart Relay Board', brand: 'kl' as const,
    bom: [
      { name: 'ESP32-S3 module', quantity: 1, unit_cost: 350 },
      { name: 'Relay 5V', quantity: 4, unit_cost: 25 },
    ],
  }
  const { landed, ladder } = planProduct(product, tiers, config)
  const prompt = buildVerificationPrompt(product, landed, ladder, config)

  it('lists every component line with its total', () => {
    expect(prompt).toContain('| 1 | ESP32-S3 module | 1 | 350.00 | 350.00 |')
    expect(prompt).toContain('| 2 | Relay 5V | 4 | 25.00 | 100.00 |')
  })

  it('states the method and the claimed results to re-derive', () => {
    expect(prompt).toContain('## Method')
    expect(prompt).toContain(`- Landed cost: ₹${landed.landed_cost.toFixed(2)}`)
    expect(prompt).toContain(`- B2C price: ₹${ladder.b2c_price.toFixed(2)}`)
    expect(prompt).toContain('Treat the "Claimed results" section as claims to verify')
  })

  it('marks unconfirmed settings as placeholders, and confirmed ones not', () => {
    expect(prompt).toContain('Payment gateway fee: 2.36% of the selling price (placeholder, not yet confirmed)')
    const confirmed = buildVerificationPrompt(product, landed, ladder, { ...config, unconfirmed: [] })
    expect(confirmed).not.toContain('(placeholder, not yet confirmed)')
  })

  it('carries the planner issues, such as a tier under the floor', () => {
    expect(prompt).toContain('Issues the planner raised:')
  })
})
