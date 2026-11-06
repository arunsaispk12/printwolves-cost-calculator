import type { LandedCost, PlannerConfig, PlannerProduct, PriceLadder } from '@/types/planner'

const inr = (n: number) => `₹${n.toFixed(2)}`

// A self-contained prompt for any AI assistant to check an estimate independently:
// it gets the inputs, the settings, the exact method, and the planner's results
// (labelled as claims to be re-derived, not trusted). The app never calls an AI.
export function buildVerificationPrompt(
  product: PlannerProduct,
  landed: LandedCost,
  ladder: PriceLadder,
  config: PlannerConfig,
): string {
  const brand = product.brand === 'kl'
    ? 'KaspersLab (electronics: ESP32 modules, controllers, sensors)'
    : 'PrintWolves (3D printing)'
  const flag = (k: keyof PlannerConfig) => (config.unconfirmed.includes(k) ? ' (placeholder, not yet confirmed)' : '')

  const lines = product.bom.map((l, i) =>
    `| ${i + 1} | ${l.name || 'Unnamed'} | ${l.quantity} | ${l.unit_cost.toFixed(2)} | ${(l.quantity * l.unit_cost).toFixed(2)} |`)

  const tiers = ladder.tiers.map(t =>
    `| ${t.tier_label} | ${t.min_quantity}+ | ${t.discount_pct}% | ${inr(t.unit_price)} | ${t.margin_pct}% | ${t.below_floor ? 'below floor' : 'ok'} |`)

  return [
    'You are checking a product cost and pricing estimate before the product is published in an Indian online store.',
    'Recompute every number yourself from the inputs and method below, then report differences. Treat the "Claimed results" section as claims to verify, not as facts.',
    '',
    '## Product',
    `- Name: ${product.name}`,
    `- Brand: ${brand}`,
    '- Currency: INR. All prices are ex-GST.',
    '',
    '## Inputs: components and resources per unit',
    '| # | Item | Qty | Unit cost (₹) | Line (₹) |',
    '|---|---|---|---|---|',
    ...(lines.length > 0 ? lines : ['| - | (none entered) | - | - | - |']),
    '',
    '## Settings',
    `- Inbound freight: ${config.inbound_freight_pct}% of unit cost${flag('inbound_freight_pct')}`,
    `- Packaging per unit: ${inr(config.packaging_inr)}${flag('packaging_inr')}`,
    `- Payment gateway fee: ${config.gateway_fee_pct}% of the selling price${flag('gateway_fee_pct')}`,
    `- Target net margin: ${config.target_margin_pct}%${flag('target_margin_pct')}`,
    `- Margin floor: ${config.min_margin_pct}%${flag('min_margin_pct')}`,
    `- B2B extra discount: ${config.b2b_extra_discount_pct}%${flag('b2b_extra_discount_pct')}`,
    `- Compare-at multiplier: ${config.compare_at_multiplier}`,
    `- GST rate on the product: ${config.gst_rate_pct ?? 0}%`,
    '',
    '## Method',
    '1. Unit cost = sum of (qty × unit cost) over all lines.',
    '2. Landed cost = unit cost + unit cost × freight% + packaging.',
    '3. Net margin at price p = (p − landed − p × gateway%) / p.',
    '4. B2C price = landed / (1 − target margin − gateway fee), rounded UP to the next whole rupee.',
    '5. B2B price = B2C × (1 − B2B extra discount), rounded up to the next rupee.',
    '6. Compare-at = B2C × multiplier, then rounded up to the next step and minus 1. Step is 10 below ₹100, 50 below ₹500, 100 below ₹2000, else 500.',
    '7. Each quantity tier: unit price = B2C × (1 − tier discount), rounded up to the next rupee; flag it if its net margin is below the floor.',
    '8. Max safe discount = 1 − floor price / B2C, where floor price = landed / (1 − floor − gateway fee).',
    '',
    '## Claimed results',
    `- Unit cost: ${inr(landed.unit_cost)}`,
    `- Freight: ${inr(landed.freight_cost)}; packaging: ${inr(landed.packaging_cost)}`,
    `- Landed cost: ${inr(landed.landed_cost)}`,
    `- B2C price: ${inr(ladder.b2c_price)} at ${ladder.margin_pct}% net margin`,
    `- B2B price: ${inr(ladder.b2b_price)}`,
    `- Compare-at price: ${inr(ladder.compare_at_price)}`,
    ...(ladder.tiers.length > 0 ? [
      '',
      '| Tier | Min qty | Discount | Unit price | Net margin | Status |',
      '|---|---|---|---|---|---|',
      ...tiers,
    ] : []),
    ...(ladder.issues.length > 0 ? ['', 'Issues the planner raised:', ...ladder.issues.map(i => `- ${i}`)] : []),
    '',
    '## What to send back',
    '1. A table of every claimed number: claimed value, your value, match yes/no.',
    '2. Any arithmetic or method errors, with the corrected figure.',
    '3. A sanity check of each component cost for the Indian market in the current year: flag any that look far off and give a typical range. Say plainly when you are unsure instead of guessing.',
    '4. Cost items commonly needed for this kind of product that are missing from the list (for example testing, wastage, certification, firmware or design time, returns).',
    '5. Whether the settings above look reasonable for a small Indian online seller, especially any marked as placeholders.',
    'Keep the answer short and in that order.',
  ].join('\n')
}
