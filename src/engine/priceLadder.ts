import type { CorePriceTier, LadderTier, PlannerConfig, PriceLadder } from '@/types/planner'
import { roundPsych, roundUpToRupee } from '@/lib/formatters'
import { round2 } from '@/engine/landedCost'

// Margin is net of the payment gateway fee and measured on the selling price,
// matching the calculator's existing price-based margin convention.
export function netMarginPct(price: number, landed_cost: number, gateway_fee_pct: number): number {
  if (price <= 0) return 0
  const net = price - landed_cost - price * (gateway_fee_pct / 100)
  return round2((net / price) * 100)
}

// Lowest price that still clears `margin_pct` after cost and gateway fee.
export function priceForMargin(landed_cost: number, margin_pct: number, gateway_fee_pct: number): number {
  const denominator = 1 - margin_pct / 100 - gateway_fee_pct / 100
  if (denominator <= 0) return Infinity
  return landed_cost / denominator
}

// Largest percentage off `price` that keeps margin at or above `floor_pct`.
export function maxSafeDiscountPct(price: number, landed_cost: number, floor_pct: number, gateway_fee_pct: number): number {
  const floor_price = priceForMargin(landed_cost, floor_pct, gateway_fee_pct)
  if (!Number.isFinite(floor_price) || price <= 0) return 0
  return Math.max(0, round2((1 - floor_price / price) * 100))
}

// Quantity tiers are percentage discounts off the B2C price, like Core's
// product_price_tiers; the B2C unit price rounds up to the next rupee.
export function buildTierRows(
  b2c_price: number,
  landed_cost: number,
  tiers: CorePriceTier[],
  config: PlannerConfig,
): LadderTier[] {
  return tiers.map(t => {
    const unit_price = roundUpToRupee(b2c_price * (1 - t.discount_pct / 100))
    const margin_pct = netMarginPct(unit_price, landed_cost, config.gateway_fee_pct)
    return {
      min_quantity: t.min_quantity,
      tier_label: t.tier_label,
      discount_pct: t.discount_pct,
      unit_price,
      margin_pct,
      below_floor: margin_pct < config.min_margin_pct,
      max_safe_discount_pct: maxSafeDiscountPct(b2c_price, landed_cost, config.min_margin_pct, config.gateway_fee_pct),
    }
  })
}

export function buildLadder(
  landed_cost: number,
  tiers: CorePriceTier[],
  config: PlannerConfig,
): PriceLadder {
  const issues: string[] = []
  const raw = priceForMargin(landed_cost, config.target_margin_pct, config.gateway_fee_pct)

  if (landed_cost <= 0) issues.push('No cost data: add components with unit costs')
  if (!Number.isFinite(raw)) issues.push('Target margin plus gateway fee is 100% or more: no price can reach it')

  const b2c_price = Number.isFinite(raw) ? roundUpToRupee(raw) : 0
  // Core: B2B = b2c x (1 - (tier% + account extra%)); the base B2B rate uses the extra alone.
  const b2b_price = roundUpToRupee(b2c_price * (1 - config.b2b_extra_discount_pct / 100))
  const compare_at_price = b2c_price > 0 ? roundPsych(b2c_price * config.compare_at_multiplier) : 0
  const margin_pct = netMarginPct(b2c_price, landed_cost, config.gateway_fee_pct)

  const tier_rows = buildTierRows(b2c_price, landed_cost, tiers, config)
  for (const t of tier_rows) {
    if (t.below_floor) {
      issues.push(`Tier ${t.tier_label} (${t.min_quantity}+) sells at ${t.margin_pct}% margin, below the ${config.min_margin_pct}% floor; max safe discount is ${t.max_safe_discount_pct}%`)
    }
  }

  const b2b_margin = netMarginPct(b2b_price, landed_cost, config.gateway_fee_pct)
  if (b2c_price > 0 && b2b_margin < config.min_margin_pct) {
    issues.push(`B2B price gives ${b2b_margin}% margin, below the ${config.min_margin_pct}% floor`)
  }

  return { landed_cost, b2c_price, b2b_price, compare_at_price, margin_pct, tiers: tier_rows, issues }
}
