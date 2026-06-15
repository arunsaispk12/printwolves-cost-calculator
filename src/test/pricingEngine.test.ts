import { computePrice } from '@/engine/pricingEngine'
import { defaultConfig } from '@/lib/defaultConfig'
import type { JobInputs } from '@/types'

const baseInputs: JobInputs = {
  material_key: 'pla_standard',
  weight_g: 45,
  print_hours: 2.5,
  complexity: 'simple',
  quantity: 1,
  post_processing_keys: [],
  delivery_key: 'standard',
}

describe('computePrice — material cost', () => {
  it('computes material cost: 45g at ₹1200/kg = ₹54', () => {
    const result = computePrice(baseInputs, defaultConfig)
    expect(result.breakdown.material_cost).toBeCloseTo(54, 1)
  })
})

describe('computePrice — energy cost', () => {
  it('computes energy: 2.5h × 350W × ₹8/kWh = ₹7', () => {
    const result = computePrice(baseInputs, defaultConfig)
    expect(result.breakdown.energy_cost).toBeCloseTo(7, 1)
  })
})

describe('computePrice — depreciation', () => {
  it('computes depreciation: 2.5h × (₹120000 / 5000h) = ₹60', () => {
    const result = computePrice(baseInputs, defaultConfig)
    expect(result.breakdown.depreciation_cost).toBeCloseTo(60, 1)
  })
})

describe('computePrice — maintenance', () => {
  it('computes maintenance: 2.5h × (₹2000 / 300h) = ₹16.67', () => {
    const result = computePrice(baseInputs, defaultConfig)
    expect(result.breakdown.maintenance_cost).toBeCloseTo(16.67, 1)
  })
})

describe('computePrice — labor', () => {
  it('computes labor: ₹30 setup + 2.5h × ₹15 monitoring = ₹67.50', () => {
    const result = computePrice(baseInputs, defaultConfig)
    const expected = 30 + 2.5 * 15
    expect(result.breakdown.setup_labor_cost + result.breakdown.monitoring_labor_cost).toBeCloseTo(expected, 1)
  })
})

describe('computePrice — failure buffer', () => {
  it('computes failure buffer on material+energy+depreciation+maintenance × 3%', () => {
    const result = computePrice(baseInputs, defaultConfig)
    const base = result.breakdown.material_cost + result.breakdown.energy_cost +
      result.breakdown.depreciation_cost + result.breakdown.maintenance_cost
    expect(result.breakdown.failure_buffer).toBeCloseTo(base * 0.03, 2)
  })
})

describe('computePrice — B2C price formula', () => {
  it('b2c = production_cost / (1 - 0.45) at standard delivery', () => {
    const result = computePrice(baseInputs, defaultConfig)
    const expected = result.breakdown.production_cost / (1 - 0.45)
    expect(result.b2c_price_ex_gst).toBeCloseTo(expected, 0)
  })
})

describe('computePrice — B2B price', () => {
  it('b2b = b2c × (1 - 0.15)', () => {
    const result = computePrice(baseInputs, defaultConfig)
    expect(result.b2b_price_ex_gst).toBeCloseTo(result.b2c_price_ex_gst * 0.85, 0)
  })
})

describe('computePrice — express delivery premium', () => {
  it('express adds 15% to b2c price', () => {
    const expressInputs = { ...baseInputs, delivery_key: 'express' }
    const std = computePrice(baseInputs, defaultConfig)
    const exp = computePrice(expressInputs, defaultConfig)
    expect(exp.b2c_price_ex_gst).toBeCloseTo(std.b2c_price_ex_gst * 1.15, 0)
  })
})

describe('computePrice — complexity multiplier', () => {
  it('complex multiplies adjusted_hours by 1.35', () => {
    const complexInputs = { ...baseInputs, complexity: 'complex' as const }
    const simple = computePrice(baseInputs, defaultConfig)
    const complex = computePrice(complexInputs, defaultConfig)
    expect(complex.breakdown.energy_cost).toBeCloseTo(simple.breakdown.energy_cost * 1.35, 1)
  })
})

describe('computePrice — post processing', () => {
  it('adds sanding time to post_proc_labor_cost: 0.5h × ₹80 = ₹40', () => {
    const inputs = { ...baseInputs, post_processing_keys: ['sanding'] }
    const result = computePrice(inputs, defaultConfig)
    expect(result.breakdown.post_proc_labor_cost).toBeCloseTo(40, 1)
  })
  it('adds painting fixed cost ₹50 + 1h × ₹80 = ₹130', () => {
    const inputs = { ...baseInputs, post_processing_keys: ['painting'] }
    const result = computePrice(inputs, defaultConfig)
    expect(result.breakdown.post_proc_labor_cost).toBeCloseTo(130, 1)
  })
})

describe('computePrice — actual margin', () => {
  it('actual_margin = (b2c - production_cost) / b2c × 100', () => {
    const result = computePrice(baseInputs, defaultConfig)
    const expected = ((result.b2c_price_ex_gst - result.breakdown.production_cost) / result.b2c_price_ex_gst) * 100
    expect(result.actual_margin_pct).toBeCloseTo(expected, 1)
  })
})
