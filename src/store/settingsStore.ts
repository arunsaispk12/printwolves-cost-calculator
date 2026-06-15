import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SettingsState, Material, PrinterProfile, LaborRates,
  PricingStrategy, VolumeTier, DeliverySpeed, ComplexityMultiplier,
  ElectricitySettings, PostProcessingOption } from '@/types'
import { defaultConfig } from '@/lib/defaultConfig'

interface SettingsStore extends SettingsState {
  updateMaterial: (key: string, updates: Partial<Material>) => void
  addMaterial: (material: Material) => void
  removeMaterial: (key: string) => void
  updatePrinter: (updates: Partial<PrinterProfile>) => void
  updateLabor: (updates: Partial<LaborRates>) => void
  updatePricingStrategy: (updates: Partial<PricingStrategy>) => void
  updateVolumeTiers: (tiers: VolumeTier[]) => void
  updateDeliverySpeeds: (speeds: DeliverySpeed[]) => void
  updateComplexityMultipliers: (multipliers: Partial<ComplexityMultiplier>) => void
  updateElectricity: (updates: Partial<ElectricitySettings>) => void
  updatePostProcessingOption: (key: string, updates: Partial<PostProcessingOption>) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultConfig,

      updateMaterial: (key, updates) =>
        set(s => ({ materials: s.materials.map(m => m.key === key ? { ...m, ...updates } : m) })),

      addMaterial: (material) =>
        set(s => ({ materials: [...s.materials, material] })),

      removeMaterial: (key) =>
        set(s => ({ materials: s.materials.filter(m => m.key !== key) })),

      updatePrinter: (updates) =>
        set(s => ({ printer: { ...s.printer, ...updates } })),

      updateLabor: (updates) =>
        set(s => ({ labor: { ...s.labor, ...updates } })),

      updatePricingStrategy: (updates) =>
        set(s => ({ pricing_strategy: { ...s.pricing_strategy, ...updates } })),

      updateVolumeTiers: (tiers) => set({ volume_tiers: tiers }),

      updateDeliverySpeeds: (speeds) => set({ delivery_speeds: speeds }),

      updateComplexityMultipliers: (multipliers) =>
        set(s => ({ complexity_multipliers: { ...s.complexity_multipliers, ...multipliers } })),

      updateElectricity: (updates) =>
        set(s => ({ electricity: { ...s.electricity, ...updates } })),

      updatePostProcessingOption: (key, updates) =>
        set(s => ({
          post_processing_options: s.post_processing_options.map(p => p.key === key ? { ...p, ...updates } : p)
        })),

      resetToDefaults: () => set({ ...defaultConfig }),
    }),
    { name: 'pw-calculator-settings' }
  )
)
