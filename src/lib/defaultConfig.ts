import type { SettingsState } from '@/types'

export const defaultConfig: SettingsState = {
  materials: [
    { key: 'pla_standard', name: 'PLA+ Standard', cost_per_kg: 1200, density_g_cm3: 1.24, description: 'Most common, easy to print' },
    { key: 'pla_silk', name: 'PLA Silk', cost_per_kg: 1600, density_g_cm3: 1.24, description: 'Shiny silk finish' },
    { key: 'petg', name: 'PETG', cost_per_kg: 1400, density_g_cm3: 1.27, description: 'Food-safe, durable' },
    { key: 'abs', name: 'ABS', cost_per_kg: 1100, density_g_cm3: 1.04, description: 'Heat resistant, functional parts' },
    { key: 'tpu', name: 'TPU 95A', cost_per_kg: 2200, density_g_cm3: 1.21, description: 'Flexible, rubber-like' },
    { key: 'asa', name: 'ASA', cost_per_kg: 1800, density_g_cm3: 1.07, description: 'UV resistant, outdoor parts' },
    { key: 'resin_standard', name: 'Resin Standard', cost_per_kg: 2500, density_g_cm3: 1.10, description: 'High detail, SLA/MSLA' },
    { key: 'resin_abs_like', name: 'Resin ABS-Like', cost_per_kg: 3000, density_g_cm3: 1.10, description: 'Tough, impact resistant' },
  ],
  printer: {
    name: 'Bambu Lab X1 Carbon',
    purchase_price_inr: 120000,
    lifespan_hours: 5000,
    power_watts: 350,
    monthly_maintenance_inr: 2000,
    monthly_print_hours: 300,
    failure_rate_pct: 3,
  },
  labor: {
    setup_cost_per_print: 30,
    monitoring_rate_per_hour: 15,
    post_processing_rate_per_hour: 80,
  },
  post_processing_options: [
    { key: 'support_removal', label: 'Support Removal', fixed_cost: 0, time_hours: 0.25 },
    { key: 'sanding', label: 'Sanding', fixed_cost: 0, time_hours: 0.5 },
    { key: 'painting', label: 'Painting (single color)', fixed_cost: 50, time_hours: 1.0 },
    { key: 'assembly', label: 'Assembly', fixed_cost: 0, time_hours: 0.5 },
    { key: 'epoxy_coat', label: 'Epoxy Coating', fixed_cost: 80, time_hours: 0.75 },
  ],
  pricing_strategy: {
    target_retail_margin_pct: 45,
    min_margin_threshold_pct: 30,
    b2b_discount_pct: 15,
    gst_rate_pct: 18,
    compare_at_multiplier: 1.3,
  },
  volume_tiers: [
    { min_qty: 1, label: 'Single', discount_pct: 0 },
    { min_qty: 5, label: 'Small Batch', discount_pct: 5 },
    { min_qty: 10, label: 'Standard Batch', discount_pct: 10 },
    { min_qty: 25, label: 'Large Batch', discount_pct: 15 },
    { min_qty: 50, label: 'Production Run', discount_pct: 20 },
    { min_qty: 100, label: 'Wholesale', discount_pct: 25 },
  ],
  delivery_speeds: [
    { key: 'standard', label: 'Standard (5-7 days)', premium_pct: 0 },
    { key: 'express', label: 'Express (2-3 days)', premium_pct: 15 },
    { key: 'rush', label: 'Rush (24 hrs)', premium_pct: 30 },
  ],
  complexity_multipliers: {
    simple: 1.0,
    moderate: 1.15,
    complex: 1.35,
    very_complex: 1.6,
  },
  electricity: {
    rate_per_kwh: 8,
  },
}
