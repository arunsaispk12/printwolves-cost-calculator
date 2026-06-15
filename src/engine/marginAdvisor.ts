import type { Material, Complexity } from '@/types'

export function suggestMargin(material: Material, complexity: Complexity): number {
  const base =
    material.cost_per_kg < 1000 ? 40 :
    material.cost_per_kg < 1500 ? 40 :
    material.cost_per_kg < 2000 ? 45 :
    material.cost_per_kg < 2500 ? 50 : 57

  const uplift =
    complexity === 'simple' ? 0 :
    complexity === 'moderate' ? 2 :
    complexity === 'complex' ? 5 : 8

  return Math.min(base + uplift, 65)
}
