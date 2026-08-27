import { describe, expect, it } from 'bun:test'
import { ref } from 'vue'

import type { Stroke } from '@open-pencil/scene-graph'
import {
  getStrokeCategory,
  strokeToGradient,
  strokeToSolid,
  useStrokePaintCategory
} from '#vue/controls/stroke/helpers'

describe('stroke gradient helpers and controls', () => {
  const solidStroke: Stroke = {
    color: { r: 1, g: 0, b: 0, a: 1 },
    weight: 2,
    opacity: 1,
    visible: true,
    align: 'CENTER'
  }

  const gradientStroke: Stroke = {
    type: 'GRADIENT_LINEAR',
    color: { r: 1, g: 0, b: 0, a: 1 },
    weight: 2,
    opacity: 1,
    visible: true,
    align: 'CENTER',
    gradientStops: [
      { color: { r: 0, g: 1, b: 0, a: 1 }, position: 0 },
      { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }
    ],
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
  }

  it('correctly categorizes solid vs gradient strokes', () => {
    expect(getStrokeCategory(solidStroke)).toBe('SOLID')
    expect(getStrokeCategory({ ...solidStroke, type: 'SOLID' })).toBe('SOLID')
    expect(getStrokeCategory(gradientStroke)).toBe('GRADIENT')
    expect(getStrokeCategory({ ...solidStroke, type: 'GRADIENT_RADIAL' })).toBe('GRADIENT')
    expect(getStrokeCategory({ ...solidStroke, type: 'GRADIENT_ANGULAR' })).toBe('GRADIENT')
    expect(getStrokeCategory({ ...solidStroke, type: 'GRADIENT_DIAMOND' })).toBe('GRADIENT')
  })

  it('converts solid stroke to gradient stroke with default stops and transform', () => {
    const converted = strokeToGradient(solidStroke)
    expect(converted.type).toBe('GRADIENT_LINEAR')
    expect(converted.gradientStops).toBeDefined()
    expect(converted.gradientStops?.length).toBe(2)
    expect(converted.gradientStops?.[0].position).toBe(0)
    expect(converted.gradientStops?.[0].color).toEqual(solidStroke.color)
    expect(converted.gradientStops?.[1].position).toBe(1)
    expect(converted.gradientTransform).toBeDefined()
  })

  it('converts gradient stroke to solid stroke using first stop color', () => {
    const converted = strokeToSolid(gradientStroke)
    expect(converted.type).toBe('SOLID')
    expect(converted.color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
  })

  it('useStrokePaintCategory composable updates stroke category correctly', () => {
    let currentStroke = { ...solidStroke }
    const strokeRef = ref(currentStroke)
    const { category, toGradient, toSolid } = useStrokePaintCategory(strokeRef, (updated) => {
      currentStroke = updated
      strokeRef.value = updated
    })

    expect(category.value).toBe('SOLID')
    toGradient()
    expect(category.value).toBe('GRADIENT')
    expect(currentStroke.type).toBe('GRADIENT_LINEAR')

    toSolid()
    expect(category.value).toBe('SOLID')
    expect(currentStroke.type).toBe('SOLID')
  })
})
