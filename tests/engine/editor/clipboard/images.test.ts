import { describe, expect, test } from 'bun:test'

import { createDefaultEditorState } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import { UndoManager } from '@open-pencil/scene-graph/undo'

import { createClipboardImageActions } from '#core/editor/clipboard/images'
import type { EditorContext } from '#core/editor/types'

function makeContext() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const state = createDefaultEditorState(pageId)
  const undo = new UndoManager()
  const ctx = {
    graph,
    state,
    undo,
    getCk: () =>
      ({
        MakeImageFromEncoded: (bytes: Uint8Array) => {
          if (bytes[0] === 0) return null
          return {
            width: () => bytes[0],
            height: () => bytes[1],
            delete: () => undefined
          }
        }
      }) as never,
    getViewportSize: () => ({ width: 800, height: 600 }),
    getRenderer: () => null,
    getTextEditor: () => null,
    loadFont: async () => null,
    requestRender: () => undefined,
    requestRepaint: () => undefined,
    emitEditorEvent: () => undefined,
    setSelectedIds: (ids: Set<string>) => {
      state.selectedIds = ids
    },
    setActiveTool: () => undefined,
    runLayoutForNode: () => undefined,
    subscribeToGraph: () => undefined
  } as EditorContext

  return { graph, pageId, state, undo, actions: createClipboardImageActions(ctx) }
}

function imageFile(name: string, type: string, width = 40, height = 20) {
  return new File([new Uint8Array([width, height])], name, { type })
}

describe('clipboard image placement', () => {
  test('uses one atomic history entry and restores selection, IDs, and image bytes', async () => {
    const { graph, pageId, state, undo, actions } = makeContext()
    const previous = graph.createNode('RECTANGLE', pageId, { name: 'Previous' })
    state.selectedIds = new Set([previous.id])

    await actions.placeImageFiles(
      [imageFile('one.png', 'image/png'), imageFile('two.png', 'image/png')],
      200,
      100
    )

    const createdIds = [...state.selectedIds]
    expect(createdIds).toHaveLength(2)
    expect(undo.undoLabel).toBe('Place image')

    const hashes = createdIds.map((id) => {
      const node = graph.getNode(id)
      if (!node) throw new Error('created image node missing')
      const fill = node.fills[0]
      if (fill.type !== 'IMAGE' || !fill.imageHash) throw new Error('image fill missing')
      return fill.imageHash
    })

    undo.undo()
    expect(state.selectedIds).toEqual(new Set([previous.id]))
    expect(createdIds.every((id) => !graph.getNode(id))).toBe(true)
    expect(hashes.every((hash) => graph.images.has(hash))).toBe(true)

    undo.redo()
    expect(state.selectedIds).toEqual(new Set(createdIds))
    expect(createdIds.every((id) => graph.getNode(id))).toBe(true)
    expect(hashes.every((hash) => graph.images.has(hash))).toBe(true)
  })

  test('maps the drop centre into a transformed selected container', async () => {
    const { graph, pageId, state, actions } = makeContext()
    const frame = graph.createNode('FRAME', pageId, {
      x: 120,
      y: 80,
      width: 240,
      height: 160,
      rotation: 25
    })
    state.selectedIds = new Set([frame.id])
    const dropPoint = Matrix.mapPoint(getWorldMatrix(frame, graph), { x: 60, y: 45 })

    await actions.placeImageFiles([imageFile('rotated.png', 'image/png', 40, 20)], dropPoint.x, dropPoint.y)

    const image = graph.getChildren(frame.id)[0]
    if (!image) throw new Error('image node missing')
    const worldCentre = Matrix.mapPoint(getWorldMatrix(image, graph), {
      x: image.width / 2,
      y: image.height / 2
    })
    expect(worldCentre.x).toBeCloseTo(dropPoint.x)
    expect(worldCentre.y).toBeCloseTo(dropPoint.y)
  })

  test('retains shared image bytes when undoing one of two identical drops', async () => {
    const { graph, state, undo, actions } = makeContext()
    const file = imageFile('shared.png', 'image/png')

    await actions.placeImageFiles([file], 100, 100)
    const firstId = [...state.selectedIds][0]
    const first = graph.getNode(firstId)
    if (!first || first.fills[0].type !== 'IMAGE' || !first.fills[0].imageHash) {
      throw new Error('first image missing')
    }
    const hash = first.fills[0].imageHash

    await actions.placeImageFiles([file], 200, 200)
    const secondId = [...state.selectedIds][0]
    undo.undo()

    expect(graph.getNode(firstId)).toBeTruthy()
    expect(graph.getNode(secondId)).toBeUndefined()
    expect(graph.images.has(hash)).toBe(true)
  })
})
