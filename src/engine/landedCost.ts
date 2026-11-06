import type { LandedCost, PlannerConfig, PlannerProduct } from '@/types/planner'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Unit cost is the sum of the component and resource lines. Landed cost adds inbound
// freight and packaging; the gateway fee depends on the selling price, so the ladder
// applies it.
export function computeLandedCost(product: Pick<PlannerProduct, 'bom'>, config: PlannerConfig): LandedCost {
  const unit_cost = product.bom.reduce((sum, l) => sum + l.unit_cost * l.quantity, 0)
  if (unit_cost <= 0) return { unit_cost: 0, freight_cost: 0, packaging_cost: 0, landed_cost: 0, source: 'none' }

  const freight_cost = unit_cost * (config.inbound_freight_pct / 100)
  return {
    unit_cost: round2(unit_cost),
    freight_cost: round2(freight_cost),
    packaging_cost: config.packaging_inr,
    landed_cost: round2(unit_cost + freight_cost + config.packaging_inr),
    source: 'bom',
  }
}
