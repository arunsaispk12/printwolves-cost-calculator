import type { PlannerConfig } from '@/types/planner'

// Shipping fee and free threshold mirror the store's legacy flat rule
// (KaspersLab-Ecommerce lib/delivery/constants.ts). Everything listed in
// `unconfirmed` is a placeholder, not a measured figure.
export const defaultPlannerConfig: PlannerConfig = {
  packaging_inr: 15,
  inbound_freight_pct: 2,
  gateway_fee_pct: 2.36,
  outbound_shipping_cost_inr: 70,
  customer_shipping_fee_inr: 120,
  free_shipping_threshold_inr: 1199,
  target_margin_pct: 35,
  min_margin_pct: 15,
  b2b_extra_discount_pct: 10,
  compare_at_multiplier: 1.3,
  gst_rate_pct: 0, // the business is not GST-registered; Core's own default is 18
  gift_wrap_fee_inr: 149, // the only figure found is a Core test fixture
  gift_wrap_cost_inr: 40,
  unconfirmed: [
    'packaging_inr',
    'inbound_freight_pct',
    'gateway_fee_pct',
    'outbound_shipping_cost_inr',
    'target_margin_pct',
    'min_margin_pct',
    'b2b_extra_discount_pct',
    'gift_wrap_fee_inr',
    'gift_wrap_cost_inr',
  ],
}
