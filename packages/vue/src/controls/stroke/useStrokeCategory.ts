import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { GradientStop, Stroke } from '@open-pencil/scene-graph'

export type StrokeCategory = 'SOLID' | 'GRADIENT'

export function strokeCategory(stroke: Stroke): StrokeCategory {
  return typeof stroke.type === 'string' && stroke.type.startsWith('GRADIENT')
    ? 'GRADIENT'
    : 'SOLID'
}

export interface StrokeCategoryActions {
  toSolid(): void
  toGradient(): void
}

/**
 * Stroke category state and immutable SOLID/GRADIENT conversion actions,
 * mirroring useFill's category logic for strokes. There is no IMAGE
 * category on Stroke, so there is no toImage().
 */
export function useStrokeCategory(
  stroke: Ref<Stroke>,
  onUpdate: (patch: Partial<Stroke>) => void
): { category: ComputedRef<StrokeCategory>; actions: StrokeCategoryActions } {
  const category = computed(() => strokeCategory(stroke.value))

  function toSolid() {
    if (category.value === 'SOLID') return
    const color = stroke.value.gradientStops?.[0]?.color ?? stroke.value.color
    onUpdate({ type: 'SOLID', color: { ...color } })
  }

  function toGradient() {
    if (category.value === 'GRADIENT') return
    const gradientStops: GradientStop[] = stroke.value.gradientStops?.length
      ? structuredClone(stroke.value.gradientStops)
      : [
          { color: { ...stroke.value.color }, position: 0 },
          { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
        ]
    onUpdate({
      type: 'GRADIENT_LINEAR',
      gradientStops,
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
    })
  }

  return { category, actions: { toSolid, toGradient } }
}
