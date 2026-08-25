import { describe, expect, test } from 'bun:test'

import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import {
  computeEffectsCompatibility,
  isNodeArrayMixed
} from '#vue/controls/node-props/helpers'
import { isEffectFieldMixed } from '#vue/controls/effects/helpers'
import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function makeNodeWithEffects(effects: Effect[]): SceneNode {
  const graph = makeSceneGraph()
  const node = createRect(graph, firstPageId(graph))
  node.effects = effects
  return node
}

const dropShadow1: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 4,
  spread: 0,
  visible: true
}

const dropShadow2: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.5 },
  offset: { x: 2, y: 8 },
  radius: 12,
  spread: 2,
  visible: true
}

const innerShadow: Effect = {
  type: 'INNER_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.2 },
  offset: { x: 0, y: 2 },
  radius: 4,
  spread: 0,
  visible: true
}

const layerBlur: Effect = {
  type: 'LAYER_BLUR',
  color: { r: 0, g: 0, b: 0, a: 0 },
  offset: { x: 0, y: 0 },
  radius: 8,
  spread: 0,
  visible: true
}

describe('computeEffectsCompatibility', () => {
  test('returns equal for empty nodes array or single node', () => {
    expect(computeEffectsCompatibility([])).toBe('equal')
    expect(computeEffectsCompatibility([makeNodeWithEffects([dropShadow1])])).toBe('equal')
  })

  test('returns equal when multiple nodes have deep-equal effect stacks', () => {
    const nodeA = makeNodeWithEffects([dropShadow1, layerBlur])
    const nodeB = makeNodeWithEffects([structuredClone(dropShadow1), structuredClone(layerBlur)])
    expect(computeEffectsCompatibility([nodeA, nodeB])).toBe('equal')
    expect(isNodeArrayMixed([nodeA, nodeB], 'effects')).toBe(false)
  })

  test('returns compatible when nodes share stack length and effect types but differ in values', () => {
    const nodeA = makeNodeWithEffects([dropShadow1])
    const nodeB = makeNodeWithEffects([dropShadow2])
    expect(computeEffectsCompatibility([nodeA, nodeB])).toBe('compatible')
    // isNodeArrayMixed treats this as mixed (true)
    expect(isNodeArrayMixed([nodeA, nodeB], 'effects')).toBe(true)
  })

  test('returns incompatible when nodes have different stack lengths', () => {
    const nodeA = makeNodeWithEffects([dropShadow1])
    const nodeB = makeNodeWithEffects([dropShadow1, layerBlur])
    expect(computeEffectsCompatibility([nodeA, nodeB])).toBe('incompatible')
  })

  test('returns incompatible when nodes have same length but different effect types at an index', () => {
    const nodeA = makeNodeWithEffects([dropShadow1, layerBlur])
    const nodeB = makeNodeWithEffects([dropShadow1, innerShadow])
    expect(computeEffectsCompatibility([nodeA, nodeB])).toBe('incompatible')
  })
})

describe('isEffectFieldMixed', () => {
  test('returns false for single node', () => {
    const node = makeNodeWithEffects([dropShadow1])
    expect(isEffectFieldMixed([node], 0, (e) => e.radius)).toBe(false)
  })

  test('returns false when all nodes have the same field value', () => {
    const nodeA = makeNodeWithEffects([dropShadow1])
    const nodeB = makeNodeWithEffects([dropShadow1])
    expect(isEffectFieldMixed([nodeA, nodeB], 0, (e) => e.radius)).toBe(false)
    expect(isEffectFieldMixed([nodeA, nodeB], 0, (e) => e.offset.x)).toBe(false)
  })

  test('returns true when nodes have differing field values', () => {
    const nodeA = makeNodeWithEffects([dropShadow1])
    const nodeB = makeNodeWithEffects([dropShadow2])
    expect(isEffectFieldMixed([nodeA, nodeB], 0, (e) => e.radius)).toBe(true)
    expect(isEffectFieldMixed([nodeA, nodeB], 0, (e) => e.offset.x)).toBe(true)
  })

  test('returns false when out of bounds or index missing', () => {
    const nodeA = makeNodeWithEffects([])
    const nodeB = makeNodeWithEffects([])
    expect(isEffectFieldMixed([nodeA, nodeB], 0, (e) => e.radius)).toBe(false)
  })
})
