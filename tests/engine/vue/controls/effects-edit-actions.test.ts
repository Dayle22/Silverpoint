import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { createEffectEditActions } from '#vue/controls/effects/helpers'
import { createRect, firstPageId } from '#tests/helpers/scene'

function setupTest() {
  const editor = createEditor()
  const pageId = firstPageId(editor.graph)
  const effectsBeforeScrub = ref<Map<string, Effect[]> | null>(null)
  const { scrubEffect, commitEffect } = createEffectEditActions(editor, effectsBeforeScrub)
  return { editor, pageId, effectsBeforeScrub, scrubEffect, commitEffect }
}

const shadowA: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.25 },
  offset: { x: 0, y: 4 },
  radius: 4,
  spread: 0,
  visible: true
}

const shadowB: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 1, g: 0, b: 0, a: 0.5 },
  offset: { x: 2, y: 8 },
  radius: 12,
  spread: 1,
  visible: true
}

describe('createEffectEditActions', () => {
  test('single node: scrubs live and commits single undo step', () => {
    const { editor, pageId, scrubEffect, commitEffect } = setupTest()
    const node = createRect(editor.graph, pageId)
    node.effects = [shadowA]

    // Scrub updates node live
    scrubEffect([node], 0, { radius: 20 })
    expect(node.effects[0].radius).toBe(20)

    // Commit applies change and records undo
    commitEffect([node], 0, { radius: 20 })
    expect(node.effects[0].radius).toBe(20)

    // Undo restores previous radius
    editor.undo.undo()
    expect(node.effects[0].radius).toBe(4)

    // Redo reapplies new radius
    editor.undo.redo()
    expect(node.effects[0].radius).toBe(20)
  })

  test('multi-node: scrubs live across all nodes and commits in one batched undo step', () => {
    const { editor, pageId, scrubEffect, commitEffect } = setupTest()
    const node1 = createRect(editor.graph, pageId, { name: 'Rect1' })
    node1.effects = [shadowA]
    const node2 = createRect(editor.graph, pageId, { name: 'Rect2' })
    node2.effects = [shadowB]

    const nodes: SceneNode[] = [node1, node2]

    // Scrub updates both nodes live
    scrubEffect(nodes, 0, { radius: 30 })
    expect(node1.effects[0].radius).toBe(30)
    expect(node2.effects[0].radius).toBe(30)
    // Other properties retained
    expect(node1.effects[0].offset.y).toBe(4)
    expect(node2.effects[0].offset.y).toBe(8)

    // Commit applies change and batches into one undo step
    commitEffect(nodes, 0, { radius: 30 })
    expect(node1.effects[0].radius).toBe(30)
    expect(node2.effects[0].radius).toBe(30)

    // Single undo step restores both nodes' own distinct prior states
    editor.undo.undo()
    expect(node1.effects[0].radius).toBe(4)
    expect(node2.effects[0].radius).toBe(12)

    // Redo restores both nodes
    editor.undo.redo()
    expect(node1.effects[0].radius).toBe(30)
    expect(node2.effects[0].radius).toBe(30)
  })
})
