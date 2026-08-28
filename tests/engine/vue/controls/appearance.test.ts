import { describe, expect, test } from 'bun:test'

import { computed, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import { MIXED, type MixedValue } from '@open-pencil/vue'

import { createAppearanceActions, createAppearanceState } from '#vue/controls/appearance/helpers'

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

  test('presents normalized corner smoothing as a percentage', () => {
    const node = rectangle()
    node.cornerSmoothing = 0.735
    const state = appearanceState(node)
    expect(state.cornerSmoothingPercent.value).toBe(74)
  })

  test('recognises corner-capable node types including boolean operations', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)

    for (const type of [
      'RECTANGLE',
      'ROUNDED_RECTANGLE',
      'FRAME',
      'COMPONENT',
      'INSTANCE',
      'BOOLEAN_OPERATION'
    ] as const) {
      const node = graph.createNode(type, pageId)
      const state = appearanceState(node)
      expect(state.hasCornerRadius.value).toBe(true)
    }

    for (const type of ['ELLIPSE', 'LINE', 'TEXT', 'GROUP', 'SECTION'] as const) {
      const node = graph.createNode(type, pageId)
      const state = appearanceState(node)
      expect(state.hasCornerRadius.value).toBe(false)
    }
  })

  test('clamps and rounds corner smoothing percentage cleanly', () => {
    const node = rectangle()

    node.cornerSmoothing = 0
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(0)

    node.cornerSmoothing = 1
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(100)

    node.cornerSmoothing = 0.5
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(50)

    node.cornerSmoothing = 0.004
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(0)

    node.cornerSmoothing = 0.006
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(1)

    node.cornerSmoothing = -0.25
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(0)

    node.cornerSmoothing = 1.35
    expect(appearanceState(node).cornerSmoothingPercent.value).toBe(100)
  })

  test('handles mixed corner smoothing gracefully', () => {
    const selected = ref<SceneNode | null>(null)
    const nodes = ref<SceneNode[]>([])
    const isMulti = ref(true)

    const state = createAppearanceState({
      node: computed(() => selected.value),
      nodes: computed(() => nodes.value),
      isMulti: computed(() => isMulti.value),
      merged: () => MIXED
    })

    expect(state.cornerSmoothingPercent.value).toBe(MIXED)
  })

  test('updates and commits each of the 4 independent corners with undo/redo', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect = graph.createNode('RECTANGLE', pageId, {
      independentCorners: true,
      topLeftRadius: 4,
      topRightRadius: 8,
      bottomRightRadius: 12,
      bottomLeftRadius: 16
    })
    const editor = createEditor({ graph })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => graph.getNode(rect.id) ?? null),
      nodes: computed(() => []),
      isMulti: computed(() => false),
      merged: (key) => graph.getNode(rect.id)?.[key] ?? MIXED
    })

    const corners = [
      { key: 'topLeftRadius' as const, from: 4, to: 10 },
      { key: 'topRightRadius' as const, from: 8, to: 20 },
      { key: 'bottomRightRadius' as const, from: 12, to: 30 },
      { key: 'bottomLeftRadius' as const, from: 16, to: 40 }
    ]

    for (const { key, from, to } of corners) {
      actions.updateCornerProp(key, to)
      expect(graph.getNode(rect.id)?.[key]).toBe(to)
      actions.commitCornerProp(key, to, from)

      editor.undo.undo()
      expect(graph.getNode(rect.id)?.[key]).toBe(from)

      editor.undo.redo()
      expect(graph.getNode(rect.id)?.[key]).toBe(to)
    }
  })

  test('toggles from uniform to independent corner radii and populates all 4 corners', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect = graph.createNode('RECTANGLE', pageId, {
      cornerRadius: 15,
      independentCorners: false
    })
    const editor = createEditor({ graph })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => graph.getNode(rect.id) ?? null),
      nodes: computed(() => []),
      isMulti: computed(() => false),
      merged: (key) => graph.getNode(rect.id)?.[key] ?? MIXED
    })

    actions.toggleIndependentCorners()
    const nodeAfterToggle = graph.getNode(rect.id)
    expect(nodeAfterToggle?.independentCorners).toBe(true)
    expect(nodeAfterToggle?.topLeftRadius).toBe(15)
    expect(nodeAfterToggle?.topRightRadius).toBe(15)
    expect(nodeAfterToggle?.bottomRightRadius).toBe(15)
    expect(nodeAfterToggle?.bottomLeftRadius).toBe(15)

    editor.undo.undo()
    const nodeAfterUndo = graph.getNode(rect.id)
    expect(nodeAfterUndo?.independentCorners).toBe(false)
  })

  test('toggles from independent back to uniform corner radius using topLeftRadius', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect = graph.createNode('RECTANGLE', pageId, {
      independentCorners: true,
      topLeftRadius: 10,
      topRightRadius: 20,
      bottomRightRadius: 30,
      bottomLeftRadius: 40
    })
    const editor = createEditor({ graph })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => graph.getNode(rect.id) ?? null),
      nodes: computed(() => []),
      isMulti: computed(() => false),
      merged: (key) => graph.getNode(rect.id)?.[key] ?? MIXED
    })

    actions.toggleIndependentCorners()
    const nodeAfterToggle = graph.getNode(rect.id)
    expect(nodeAfterToggle?.independentCorners).toBe(false)
    expect(nodeAfterToggle?.cornerRadius).toBe(10)
    expect(nodeAfterToggle?.topLeftRadius).toBe(10)
    expect(nodeAfterToggle?.topRightRadius).toBe(10)
    expect(nodeAfterToggle?.bottomRightRadius).toBe(10)
    expect(nodeAfterToggle?.bottomLeftRadius).toBe(10)

    editor.undo.undo()
    const nodeAfterUndo = graph.getNode(rect.id)
    expect(nodeAfterUndo?.independentCorners).toBe(true)
    expect(nodeAfterUndo?.topRightRadius).toBe(20)
  })

  test('toggles independent corners across multi-selection in one undo step', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect1 = graph.createNode('RECTANGLE', pageId, {
      cornerRadius: 12,
      independentCorners: false
    })
    const rect2 = graph.createNode('RECTANGLE', pageId, {
      cornerRadius: 24,
      independentCorners: false
    })
    const editor = createEditor({ graph })
    const nodes = computed(() => {
      const selected = [graph.getNode(rect1.id), graph.getNode(rect2.id)]
      return selected.filter((v): v is SceneNode => v !== undefined)
    })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => null),
      nodes,
      isMulti: computed(() => true),
      merged: () => MIXED
    })

    actions.toggleIndependentCorners()
    expect(graph.getNode(rect1.id)?.independentCorners).toBe(true)
    expect(graph.getNode(rect1.id)?.topLeftRadius).toBe(12)
    expect(graph.getNode(rect2.id)?.independentCorners).toBe(true)
    expect(graph.getNode(rect2.id)?.topLeftRadius).toBe(24)

    editor.undo.undo()
    expect(graph.getNode(rect1.id)?.independentCorners).toBe(false)
    expect(graph.getNode(rect2.id)?.independentCorners).toBe(false)
  })

  test('keeps independent corner preview and undo behavior', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect = graph.createNode('RECTANGLE', pageId, {
      independentCorners: true,
      topLeftRadius: 8
    })
    const editor = createEditor({ graph })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => graph.getNode(rect.id) ?? null),
      nodes: computed(() => []),
      isMulti: computed(() => false),
      merged: (key) => graph.getNode(rect.id)?.[key] ?? MIXED
    })

    actions.updateCornerProp('topLeftRadius', 20)
    actions.commitCornerProp('topLeftRadius', 20, 8)
    expect(graph.getNode(rect.id)?.topLeftRadius).toBe(20)
    editor.undo.undo()
    expect(graph.getNode(rect.id)?.topLeftRadius).toBe(8)
  })

  test('restores each mixed smoothing value in one undo step', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const first = graph.createNode('RECTANGLE', pageId, { cornerSmoothing: 0.2 })
    const second = graph.createNode('RECTANGLE', pageId, { cornerSmoothing: 0.8 })
    const editor = createEditor({ graph })
    const nodes = computed(() => {
      const selected = [graph.getNode(first.id), graph.getNode(second.id)]
      return selected.filter((value): value is SceneNode => value !== undefined)
    })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => null),
      nodes,
      isMulti: computed(() => true),
      merged: () => MIXED
    })

    actions.updateCornerProp('cornerSmoothing', 1.4)
    expect(graph.getNode(first.id)?.cornerSmoothing).toBe(1)
    expect(graph.getNode(second.id)?.cornerSmoothing).toBe(1)
    actions.commitCornerProp('cornerSmoothing', 1, 0)

    editor.undo.undo()
    expect(graph.getNode(first.id)?.cornerSmoothing).toBe(0.2)
    expect(graph.getNode(second.id)?.cornerSmoothing).toBe(0.8)
  })
})
