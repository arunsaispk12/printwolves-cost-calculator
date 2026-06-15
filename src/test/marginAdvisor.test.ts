import { suggestMargin } from '@/engine/marginAdvisor'
import type { Material } from '@/types'

const pla: Material = { key: 'pla', name: 'PLA+', cost_per_kg: 1200, density_g_cm3: 1.24, description: '' }
const tpu: Material = { key: 'tpu', name: 'TPU', cost_per_kg: 2200, density_g_cm3: 1.21, description: '' }
const resin: Material = { key: 'resin', name: 'Resin', cost_per_kg: 2500, density_g_cm3: 1.10, description: '' }

describe('suggestMargin', () => {
  it('cheap material (< ₹1000/kg) + simple → 40%', () => {
    const cheap: Material = { ...pla, cost_per_kg: 900 }
    expect(suggestMargin(cheap, 'simple')).toBe(40)
  })
  it('PLA+ (< ₹1500/kg) + simple → 40%', () => {
    expect(suggestMargin(pla, 'simple')).toBe(40)
  })
  it('PLA+ (< ₹1500/kg) + complex → 45%', () => {
    expect(suggestMargin(pla, 'complex')).toBe(45)
  })
  it('TPU (< ₹2500/kg) + simple → 50%', () => {
    expect(suggestMargin(tpu, 'simple')).toBe(50)
  })
  it('Resin (≥ ₹2500/kg) + very_complex → capped at 65%', () => {
    expect(suggestMargin(resin, 'very_complex')).toBe(65)
  })
  it('never exceeds 65%', () => {
    const expensive: Material = { ...resin, cost_per_kg: 5000 }
    expect(suggestMargin(expensive, 'very_complex')).toBeLessThanOrEqual(65)
  })
})
