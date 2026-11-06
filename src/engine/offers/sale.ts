import type { PlannerConfig } from '@/types/planner'
import { netMarginPct, priceForMargin } from '@/engine/priceLadder'
import { round2 } from '@/engine/landedCost'
import { roundUpToRupee } from '@/lib/formatters'

export interface SalePlan {
  sale_price: number
  compare_at_price: number
  customer_saving_pct: number
  margin_pct: number
  floor_price: number
  below_floor: boolean
}

// Sale pricing: the strike-through (compare-at) stays at the regular price and the
// sale price is checked against the lowest price that still clears the margin floor.
export function planSale(regular_price: number, sale_discount_pct: number, landed_cost: number, config: PlannerConfig): SalePlan {
  const sale_price = roundUpToRupee(regular_price * (1 - sale_discount_pct / 100))
  const floor_price = priceForMargin(landed_cost, config.min_margin_pct, config.gateway_fee_pct)
  const margin_pct = netMarginPct(sale_price, landed_cost, config.gateway_fee_pct)
  return {
    sale_price,
    compare_at_price: regular_price,
    customer_saving_pct: round2(((regular_price - sale_price) / regular_price) * 100),
    margin_pct,
    floor_price: Number.isFinite(floor_price) ? roundUpToRupee(floor_price) : 0,
    below_floor: margin_pct < config.min_margin_pct,
  }
}
