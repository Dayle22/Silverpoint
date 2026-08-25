import { describe, expect, test } from 'bun:test'

import { computed, ref } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { MixedValue } from '@open-pencil/vue'

import { createAppearanceState } from '#vue/controls/appearance/helpers'

import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function appearanceState(node: SceneNode, multi = false) {
  const selected = ref<SceneNode | null>(node)
  const nodes = ref<SceneNode[]>([node])
  const isMulti = ref(multi)

  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    const current = selected.value
    if (!current) throw new Error('Expected selected node')
    return current[key]
  }

  return createAppearanceState({
    node: computed(() => selected.value),
    nodes: computed(() => nodes.value),
    isMulti: computed(() => isMulti.value),
    merged
  })
}

function rectangle() {
  const graph = makeSceneGraph()
  return createRect(graph, firstPageId(graph))
}

describe('appearance control state', () => {
  test('keeps equal uniform corners collapsed', () => {
    const state = appearanceState(rectangle())
    expect(state.showIndependentCorners.value).toBe(false)
  })

  test('expands corners when the explicit independent flag is set', () => {
    const node = rectangle()
    node.independentCorners = true
    const state = appearanceState(node)
    expect(state.showIndependentCorners.value).toBe(true)
  })

  test('expands imported unequal corners when the explicit flag is stale', () => {
    const node = rectangle()
    node.independentCorners = false
    node.topLeftRadius = 4
    node.topRightRadius = 12
    const state = appearanceState(node)
    expect(state.showIndependentCorners.value).toBe(true)
  })

  test('leaves the per-corner editor collapsed for multi-selection', () => {
    const node = rectangle()
    node.independentCorners = true
    const state = appearanceState(node, true)
    expect(state.showIndependentCorners.value).toBe(false)
  })

  test('reports hasPointRadius true and hasCornerRadius false for POLYGON and STAR', () => {
    const graph = makeSceneGraph()
    const page = firstPageId(graph)
    const poly = graph.createNode('POLYGON', page)
    const star = graph.createNode('STAR', page)
    const rect = graph.createNode('RECTANGLE', page)

    const polyState = appearanceState(poly)
    expect(polyState.hasPointRadius.value).toBe(true)
    expect(polyState.hasCornerRadius.value).toBe(false)

    const starState = appearanceState(star)
    expect(starState.hasPointRadius.value).toBe(true)
    expect(starState.hasCornerRadius.value).toBe(false)

    const rectState = appearanceState(rect)
    expect(rectState.hasPointRadius.value).toBe(false)
    expect(rectState.hasCornerRadius.value).toBe(true)
  })

  test('gates hasPointRadius correctly for multi-selection', () => {
    const graph = makeSceneGraph()
    const page = firstPageId(graph)
    const poly = graph.createNode('POLYGON', page)
    const star = graph.createNode('STAR', page)
    const rect = graph.createNode('RECTANGLE', page)

    const selected = ref<SceneNode | null>(poly)
    const nodes = ref<SceneNode[]>([poly, star])
    const isMulti = ref(true)
    const state = createAppearanceState({
      node: computed(() => selected.value),
      nodes: computed(() => nodes.value),
      isMulti: computed(() => isMulti.value),
      merged: <K extends keyof SceneNode>(k: K) => poly[k]
    })
    expect(state.hasPointRadius.value).toBe(true)

    nodes.value = [poly, rect]
    expect(state.hasPointRadius.value).toBe(false)
  })
})

describe('corner smoothing state', () => {
  test('reports 0 for a fresh rectangle', () => {
    const state = appearanceState(rectangle())
    expect(state.cornerSmoothingPercent.value).toBe(0)
  })

  test('reports 60 for cornerSmoothing = 0.6', () => {
    const node = rectangle()
    node.cornerSmoothing = 0.6
    const state = appearanceState(node)
    expect(state.cornerSmoothingPercent.value).toBe(60)
  })

  test('reports 100 for cornerSmoothing = 1', () => {
    const node = rectangle()
    node.cornerSmoothing = 1
    const state = appearanceState(node)
    expect(state.cornerSmoothingPercent.value).toBe(100)
  })

  test('rounds 0.005 to 1, not truncated to 0', () => {
    const node = rectangle()
    node.cornerSmoothing = 0.005
    const state = appearanceState(node)
    expect(state.cornerSmoothingPercent.value).toBe(1)
  })

  test('clamps out-of-range values to 0 and 100', () => {
    const nodeHigh = rectangle()
    nodeHigh.cornerSmoothing = 1.8
    expect(appearanceState(nodeHigh).cornerSmoothingPercent.value).toBe(100)

    const nodeLow = rectangle()
    nodeLow.cornerSmoothing = -0.5
    expect(appearanceState(nodeLow).cornerSmoothingPercent.value).toBe(0)
  })
})
