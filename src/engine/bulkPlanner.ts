import type { VolumeTier, BulkTierResult } from '@/types'
import { roundUpToRupee } from '@/lib/formatters'

export function computeBulkTiers(
  b2c_unit_price_ex_gst: number,
  tiers: VolumeTier[],
  gst_rate: number,
): BulkTierResult[] {
  const single_total = b2c_unit_price_ex_gst

  const rows: BulkTierResult[] = tiers.map(tier => {
    const unit_price_ex_gst = roundUpToRupee(b2c_unit_price_ex_gst * (1 - tier.discount_pct / 100))
    const total_ex_gst = unit_price_ex_gst * tier.min_qty
    const total_inc_gst = roundUpToRupee(total_ex_gst * (1 + gst_rate))
    const saving_vs_one = (single_total - unit_price_ex_gst) * tier.min_qty

    return {
      qty: tier.min_qty,
      label: tier.label,
      discount_pct: tier.discount_pct,
      unit_price_ex_gst,
      total_ex_gst,
      total_inc_gst,
      saving_vs_one: Math.max(0, saving_vs_one),
      is_best_value: false,
    }
  })

  // Best value: tier with highest saving_vs_one per qty ratio among qty > 1
  const candidates = rows.filter(r => r.qty > 1)
  if (candidates.length > 0) {
    let best = candidates[0]
    for (const row of candidates) {
      if (row.saving_vs_one / row.qty > best.saving_vs_one / best.qty) best = row
    }
    best.is_best_value = true
  }

  return rows
}
