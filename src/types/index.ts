export type Complexity = 'simple' | 'moderate' | 'complex' | 'very_complex'

export interface Material {
  key: string
  name: string
  cost_per_kg: number
  density_g_cm3: number
  description: string
}

export interface PrinterProfile {
  name: string
  purchase_price_inr: number
  lifespan_hours: number
  power_watts: number
  monthly_maintenance_inr: number
  monthly_print_hours: number
  failure_rate_pct: number
}

export interface LaborRates {
  setup_cost_per_print: number
  monitoring_rate_per_hour: number
  post_processing_rate_per_hour: number
}

export interface PostProcessingOption {
  key: string
  label: string
  fixed_cost: number
  time_hours: number
}

export interface PricingStrategy {
  target_retail_margin_pct: number
  min_margin_threshold_pct: number
  b2b_discount_pct: number
  gst_rate_pct: number
  compare_at_multiplier: number
}

export interface VolumeTier {
  min_qty: number
  label: string
  discount_pct: number
}

export interface DeliverySpeed {
  key: string
  label: string
  premium_pct: number
}

export interface ComplexityMultiplier {
  simple: number
  moderate: number
  complex: number
  very_complex: number
}

export interface ElectricitySettings {
  rate_per_kwh: number
}

export interface JobInputs {
  material_key: string
  weight_g: number
  print_hours: number
  complexity: Complexity
  quantity: number
  post_processing_keys: string[]
  delivery_key: string
}

export interface CostBreakdown {
  material_cost: number
  energy_cost: number
  depreciation_cost: number
  maintenance_cost: number
  setup_labor_cost: number
  monitoring_labor_cost: number
  post_proc_labor_cost: number
  failure_buffer: number
  production_cost: number
}

export interface PricingResult {
  breakdown: CostBreakdown
  b2c_price_ex_gst: number
  b2b_price_ex_gst: number
  gst_amount: number
  b2c_inc_gst: number
  b2b_inc_gst: number
  compare_at_suggested: number
  actual_margin_pct: number
  margin_status: 'healthy' | 'warning' | 'danger'
  suggested_margin_pct: number
}

export interface BulkTierResult {
  qty: number
  label: string
  discount_pct: number
  unit_price_ex_gst: number
  total_ex_gst: number
  total_inc_gst: number
  saving_vs_one: number
  is_best_value: boolean
}

export interface TierProgressBarProps {
  tiers: VolumeTier[]
  currentQty: number
  baseUnitPrice: number
  theme: 'dark' | 'light'
  onSuggestionClick?: (qty: number) => void
}

export interface SettingsState {
  materials: Material[]
  printer: PrinterProfile
  labor: LaborRates
  post_processing_options: PostProcessingOption[]
  pricing_strategy: PricingStrategy
  volume_tiers: VolumeTier[]
  delivery_speeds: DeliverySpeed[]
  complexity_multipliers: ComplexityMultiplier
  electricity: ElectricitySettings
}
