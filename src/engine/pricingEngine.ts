import type { JobInputs, PricingResult, SettingsState } from '@/types'
import { roundUpToRupee, roundPsych } from '@/lib/formatters'

export function computePrice(inputs: JobInputs, settings: SettingsState): PricingResult {
  const material = settings.materials.find(m => m.key === inputs.material_key)
  if (!material) throw new Error(`Material not found: ${inputs.material_key}`)

  const delivery = settings.delivery_speeds.find(d => d.key === inputs.delivery_key)
  if (!delivery) throw new Error(`Delivery speed not found: ${inputs.delivery_key}`)

  const multiplier = settings.complexity_multipliers[inputs.complexity]
  const adjusted_hours = inputs.print_hours * multiplier

  const material_cost = (inputs.weight_g / 1000) * material.cost_per_kg

  const energy_cost = adjusted_hours * (settings.printer.power_watts / 1000) * settings.electricity.rate_per_kwh

  const depreciation_cost = adjusted_hours * (settings.printer.purchase_price_inr / settings.printer.lifespan_hours)

  const maintenance_cost = adjusted_hours * (settings.printer.monthly_maintenance_inr / settings.printer.monthly_print_hours)

  const post_proc_options = inputs.post_processing_keys
    .map(k => settings.post_processing_options.find(p => p.key === k))
    .filter((p): p is NonNullable<typeof p> => p != null)

  const post_proc_labor_cost = post_proc_options.reduce(
    (sum, opt) => sum + opt.fixed_cost + opt.time_hours * settings.labor.post_processing_rate_per_hour,
    0
  )

  const setup_labor_cost = settings.labor.setup_cost_per_print
  const monitoring_labor_cost = adjusted_hours * settings.labor.monitoring_rate_per_hour

  const base_for_failure = material_cost + energy_cost + depreciation_cost + maintenance_cost
  const failure_buffer = base_for_failure * (settings.printer.failure_rate_pct / 100)

  const production_cost = material_cost + energy_cost + depreciation_cost + maintenance_cost +
    setup_labor_cost + monitoring_labor_cost + post_proc_labor_cost + failure_buffer

  const delivery_factor = 1 + delivery.premium_pct / 100
  const margin = settings.pricing_strategy.target_retail_margin_pct / 100

  const b2c_price_ex_gst = roundUpToRupee((production_cost / (1 - margin)) * delivery_factor)
  const b2b_price_ex_gst = roundUpToRupee(b2c_price_ex_gst * (1 - settings.pricing_strategy.b2b_discount_pct / 100))

  const gst_rate = settings.pricing_strategy.gst_rate_pct / 100
  const gst_amount = b2c_price_ex_gst * gst_rate
  const b2c_inc_gst = roundUpToRupee(b2c_price_ex_gst * (1 + gst_rate))
  const b2b_inc_gst = roundUpToRupee(b2b_price_ex_gst * (1 + gst_rate))

  const compare_at_suggested = roundPsych(b2c_price_ex_gst * settings.pricing_strategy.compare_at_multiplier)

  const actual_margin_pct = ((b2c_price_ex_gst - production_cost) / b2c_price_ex_gst) * 100
  const min = settings.pricing_strategy.min_margin_threshold_pct
  const margin_status: 'healthy' | 'warning' | 'danger' =
    actual_margin_pct >= min + 10 ? 'healthy' :
    actual_margin_pct >= min ? 'warning' : 'danger'

  const suggested_margin_pct = margin * 100

  return {
    breakdown: {
      material_cost,
      energy_cost,
      depreciation_cost,
      maintenance_cost,
      setup_labor_cost,
      monitoring_labor_cost,
      post_proc_labor_cost,
      failure_buffer,
      production_cost,
    },
    b2c_price_ex_gst,
    b2b_price_ex_gst,
    gst_amount,
    b2c_inc_gst,
    b2b_inc_gst,
    compare_at_suggested,
    actual_margin_pct,
    margin_status,
    suggested_margin_pct,
  }
}
