export type Brand = 'kl' | 'pw'

// One component or resource the product uses: a part, a material, an hour of labour.
export interface BomLine {
  name: string
  quantity: number
  unit_cost: number
}

export interface CorePriceTier {
  min_quantity: number
  discount_pct: number
  tier_label: string
}

// A product being estimated before it is published. Cost comes only from the lines;
// every price, tier and margin is generated. `id` is internal: the real SKU is
// assigned in Core when the product is created.
export interface PlannerProduct {
  id: string
  name: string
  brand: Brand
  bom: BomLine[]
}

// Values marked unconfirmed are placeholders until the owner supplies real figures.
export interface PlannerConfig {
  packaging_inr: number
  inbound_freight_pct: number
  gateway_fee_pct: number
  outbound_shipping_cost_inr: number
  customer_shipping_fee_inr: number
  free_shipping_threshold_inr: number
  target_margin_pct: number
  min_margin_pct: number
  b2b_extra_discount_pct: number
  compare_at_multiplier: number
  gst_rate_pct: number
  gift_wrap_fee_inr: number
  gift_wrap_cost_inr: number
  unconfirmed: Array<keyof PlannerConfig>
}

export interface LandedCost {
  unit_cost: number
  freight_cost: number
  packaging_cost: number
  landed_cost: number
  source: 'bom' | 'none'
}

export interface LadderTier {
  min_quantity: number
  tier_label: string
  discount_pct: number
  unit_price: number
  margin_pct: number
  below_floor: boolean
  max_safe_discount_pct: number
}

export interface PriceLadder {
  landed_cost: number
  b2c_price: number
  b2b_price: number
  compare_at_price: number
  margin_pct: number
  tiers: LadderTier[]
  issues: string[]
}

export type CouponType = 'percentage' | 'flat' | 'free_shipping'

export interface CouponSpec {
  type: CouponType
  discount_value: number
  max_discount_amount?: number | null
  min_order_amount?: number | null
}

// Every offer the planner can model. The first three are the store's coupon types;
// the rest are planning-only (the store cannot run them today).
export type OfferType =
  | CouponType
  | 'bundle_price'
  | 'buy_x_get_y'
  | 'nth_item_pct'
  | 'tiered_spend'
  | 'gift_with_purchase'
  | 'mix_match'
  | 'free_gift_wrap'

export interface SpendStep {
  min_order: number
  amount_off: number
}

// An item the offer refers to, priced and costed by the planner.
export interface OfferItem {
  id: string
  name: string
  unit_price: number
  landed_cost: number
}

export interface Offer {
  type: OfferType
  label: string
  discount_value: number
  max_discount_amount?: number | null
  min_order_amount?: number | null
  // bundle_price: price for the whole basket; mix_match: price for each group of bundle_size
  bundle_price?: number
  buy?: number
  get?: number
  // nth_item_pct: every nth unit of the same item gets nth_pct off
  nth?: number
  nth_pct?: number
  steps?: SpendStep[]
  // gift_with_purchase: the estimate given away, resolved to `gift` for the engine
  gift_product_id?: string
  gift?: OfferItem
  // mix_match: estimates in the pool, resolved to `pool` for the engine
  pool_ids?: string[]
  pool?: OfferItem[]
  bundle_size?: number
}

// Order-level choices that are not offers.
export interface OrderOptions {
  gift_wrap?: boolean
}

export interface BasketLine {
  // The estimate this line is, when known; mix-and-match pools match on it.
  id?: string
  unit_price: number
  landed_cost: number
  quantity: number
}

export interface OrderOutcome {
  subtotal: number
  discount: number
  shipping_charged: number
  shipping_waived: number
  gift_wrap_charged: number
  gift_wrap_waived: number
  // A free gift: what it costs you, and what the customer would have paid for it.
  gift_cost: number
  gift_value: number
  revenue: number
  cost: number
  profit: number
  margin_pct: number
  below_floor: boolean
  coupon_applied: boolean
}
