import type {
  Material,
  PrinterProfile,
  LaborRates,
  PostProcessingOption,
  PricingStrategy,
  VolumeTier,
  DeliverySpeed,
  Complexity,
  JobInputs,
  PricingResult,
  TierProgressBarProps,
} from '@/types'

it('types compile correctly', () => {
  const m: Material = {
    key: 'pla',
    name: 'PLA+',
    cost_per_kg: 1200,
    density_g_cm3: 1.24,
    description: 'Standard PLA+',
  }
  const complexity: Complexity = 'simple'
  expect(m.key).toBe('pla')
  expect(complexity).toBe('simple')
})
