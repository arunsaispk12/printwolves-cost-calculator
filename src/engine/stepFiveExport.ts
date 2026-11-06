import type { Brand, BomLine, CorePriceTier, PriceLadder } from '@/types/planner'

export interface StepFiveValues {
  cost_price: number
  base_price: number
  b2c_price: number
  b2b_price: number
  compare_at_price: number
  gst_rate: number
  tiers: CorePriceTier[]
}

// The fields Core admin Step 5 asks for. The planner never writes to Core:
// these values are shown with copy buttons or downloaded as a price sheet.
// base_price follows b2c_price, which is the store's fallback order.
export function toStepFive(ladder: PriceLadder, unit_cost: number, gst_rate: number): StepFiveValues {
  return {
    cost_price: unit_cost,
    base_price: ladder.b2c_price,
    b2c_price: ladder.b2c_price,
    b2b_price: ladder.b2b_price,
    compare_at_price: ladder.compare_at_price,
    gst_rate,
    tiers: ladder.tiers.map(t => ({ min_quantity: t.min_quantity, discount_pct: t.discount_pct, tier_label: t.tier_label })),
  }
}

export interface WizardImportOptions {
  name: string
  brand: Brand
  sku: string
  // BOM lines go in only when the component names are exact IPMS material SKUs;
  // a mistyped one becomes a BOM line that silently never deducts stock.
  bom?: BomLine[]
}

// JSON for the Core product wizard's "Import from AI" box. The wizard requires
// business_id, product_type, sku and name, and replaces the whole draft with
// INITIAL_DRAFT + this payload, so it only suits the start of a new product.
// Fields the planner does not know (hsn_code, descriptions, category) are left out
// so the wizard's own defaults apply. Tiers get Core's max_quantity (next min - 1).
export function toWizardImport(values: StepFiveValues, opts: WizardImportOptions) {
  const price_tiers = values.tiers.map((t, i) => ({
    min_quantity: t.min_quantity,
    max_quantity: i < values.tiers.length - 1 ? values.tiers[i + 1].min_quantity - 1 : null,
    discount_pct: t.discount_pct,
    tier_label: t.tier_label,
  }))
  return {
    business_id: opts.brand === 'kl' ? 'kl' : 'pg',
    product_type: 'physical',
    sku: opts.sku.trim(),
    name: opts.name,
    ...(opts.bom && opts.bom.length > 0
      ? { bom: opts.bom.map(l => ({ component_sku: l.name, quantity: l.quantity, unit_cost: l.unit_cost })) }
      : {}),
    cost_price: values.cost_price,
    base_price: values.base_price,
    b2c_price: values.b2c_price,
    b2b_price: values.b2b_price,
    compare_at_price: values.compare_at_price,
    gst_rate: values.gst_rate,
    price_tiers,
  }
}

export function toPriceSheetCsv(rows: Array<{ name: string; values: StepFiveValues }>): string {
  const header = 'name,cost_price,base_price,b2c_price,b2b_price,compare_at_price,gst_rate,tiers'
  const body = rows.map(({ name, values: v }) => {
    const tiers = v.tiers.map(t => `${t.min_quantity}:${t.discount_pct}:${t.tier_label}`).join('|')
    return [`"${name.replace(/"/g, '""')}"`, v.cost_price, v.base_price, v.b2c_price, v.b2b_price, v.compare_at_price, v.gst_rate, `"${tiers}"`].join(',')
  })
  return [header, ...body].join('\n')
}
