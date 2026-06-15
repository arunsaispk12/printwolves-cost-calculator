import { create } from 'zustand'
import type { JobInputs, PricingResult } from '@/types'

interface CalculatorStore {
  inputs: JobInputs
  result: PricingResult | null
  setInputs: (updates: Partial<JobInputs>) => void
  setResult: (result: PricingResult) => void
  togglePostProcessing: (key: string) => void
}

const defaultInputs: JobInputs = {
  material_key: 'pla_standard',
  weight_g: 45,
  print_hours: 2.5,
  complexity: 'simple',
  quantity: 1,
  post_processing_keys: [],
  delivery_key: 'standard',
}

export const useCalculatorStore = create<CalculatorStore>()((set) => ({
  inputs: defaultInputs,
  result: null,

  setInputs: (updates) =>
    set(s => ({ inputs: { ...s.inputs, ...updates } })),

  setResult: (result) => set({ result }),

  togglePostProcessing: (key) =>
    set(s => {
      const keys = s.inputs.post_processing_keys
      const next = keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]
      return { inputs: { ...s.inputs, post_processing_keys: next } }
    }),
}))
