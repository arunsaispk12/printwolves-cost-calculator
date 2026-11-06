import type { BasketLine, CouponSpec, Offer, OrderOptions, OrderOutcome, PlannerConfig } from '@/types/planner'
import { evaluateOrder } from '@/engine/offers/coupon'
import { round2 } from '@/engine/landedCost'

export interface CampaignBasket {
  label: string
  lines: BasketLine[]
  // Share of campaign orders that look like this basket; weights are normalised.
  weight: number
}

export interface CampaignResult {
  baskets: Array<{ label: string; outcome: OrderOutcome }>
  expected_revenue: number
  expected_profit: number
  expected_margin_pct: number
  expected_discount: number
  expected_shipping_waived: number
  baskets_below_floor: string[]
}

// Weighted expectation per order across a basket mix, with the coupon applied.
export function simulateCampaign(
  baskets: CampaignBasket[],
  coupon: CouponSpec | Offer | null,
  config: PlannerConfig,
  opts: OrderOptions = {},
): CampaignResult {
  const total_weight = baskets.reduce((s, b) => s + b.weight, 0)
  const scored = baskets.map(b => ({
    label: b.label,
    share: total_weight > 0 ? b.weight / total_weight : 0,
    outcome: evaluateOrder(b.lines, coupon, config, opts),
  }))

  const expect = (pick: (o: OrderOutcome) => number) => round2(scored.reduce((s, b) => s + pick(b.outcome) * b.share, 0))
  const expected_revenue = expect(o => o.revenue)
  const expected_profit = expect(o => o.profit)

  return {
    baskets: scored.map(({ label, outcome }) => ({ label, outcome })),
    expected_revenue,
    expected_profit,
    expected_margin_pct: expected_revenue > 0 ? round2((expected_profit / expected_revenue) * 100) : 0,
    expected_discount: expect(o => o.discount),
    expected_shipping_waived: expect(o => o.shipping_waived),
    baskets_below_floor: scored.filter(b => b.outcome.below_floor).map(b => b.label),
  }
}
