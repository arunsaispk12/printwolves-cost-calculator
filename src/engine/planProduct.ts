import type { CorePriceTier, PlannerConfig, PlannerProduct } from '@/types/planner'
import type { VolumeTier } from '@/types'
import { computeLandedCost } from '@/engine/landedCost'
import { buildLadder } from '@/engine/priceLadder'

// Quantity tiers come from the calculator's volume tiers (Settings); the 1-unit row is the base price.
export function volumeTiersToCore(volume: VolumeTier[]): CorePriceTier[] {
  return volume
    .filter(t => t.min_qty > 1)
    .map(t => ({ min_quantity: t.min_qty, discount_pct: t.discount_pct, tier_label: t.label }))
}

// Everything the planner generates for one estimate. `cost_shift_pct` is the what-if
// change applied to landed cost.
export function planProduct(product: Pick<PlannerProduct, 'bom'>, tiers: CorePriceTier[], config: PlannerConfig, cost_shift_pct = 0) {
  const landed = computeLandedCost(product, config)
  const shifted = landed.landed_cost * (1 + cost_shift_pct / 100)
  return { landed, shifted, ladder: buildLadder(shifted, tiers, config) }
}
