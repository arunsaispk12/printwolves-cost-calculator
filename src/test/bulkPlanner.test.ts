import { computeBulkTiers } from '@/engine/bulkPlanner'
import { defaultConfig } from '@/lib/defaultConfig'

describe('computeBulkTiers', () => {
  const b2c = 274
  const gst_rate = 0.18

  it('returns a row for each volume tier', () => {
    const rows = computeBulkTiers(b2c, defaultConfig.volume_tiers, gst_rate)
    expect(rows).toHaveLength(defaultConfig.volume_tiers.length)
  })

  it('single unit row has 0% discount and unit_price = b2c', () => {
    const rows = computeBulkTiers(b2c, defaultConfig.volume_tiers, gst_rate)
    const single = rows.find(r => r.qty === 1)!
    expect(single.discount_pct).toBe(0)
    expect(single.unit_price_ex_gst).toBe(b2c)
  })

  it('10-unit tier applies 10% discount', () => {
    const rows = computeBulkTiers(b2c, defaultConfig.volume_tiers, gst_rate)
    const tier10 = rows.find(r => r.qty === 10)!
    expect(tier10.unit_price_ex_gst).toBeCloseTo(b2c * 0.90, 0)
  })

  it('saving_vs_one is positive for bulk tiers', () => {
    const rows = computeBulkTiers(b2c, defaultConfig.volume_tiers, gst_rate)
    rows.filter(r => r.qty > 1).forEach(r => {
      expect(r.saving_vs_one).toBeGreaterThan(0)
    })
  })

  it('marks exactly one row as best_value', () => {
    const rows = computeBulkTiers(b2c, defaultConfig.volume_tiers, gst_rate)
    const best = rows.filter(r => r.is_best_value)
    expect(best).toHaveLength(1)
  })
})
