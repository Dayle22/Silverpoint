import { describe, expect, test } from 'bun:test'

import {
  PEN_CLOSE_THRESHOLD,
  PEN_DRAG_DEAD_ZONE,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS
} from '@open-pencil/core/constants'
import { createEditor } from '@open-pencil/core/editor'
import { constrainToAngleStep, encodeVectorNetworkBlob } from '@open-pencil/core/vector'

import { createPenActions } from '@/app/editor/pen'
import {
  CLOSE_CURSOR,
  CONTINUE_CURSOR,
  INSERT_CURSOR,
  penCursor,
  updatePenHover
} from '#vue/canvas/pen-input/use'
import type { NodeEditState } from '#vue/shared/input/node-edit'
import { expectDefined } from '#tests/helpers/assert'

describe('constrainToAngleStep', () => {
  test('zero vector returns (0, 0)', () => {
    expect(constrainToAngleStep(0, 0, 45)).toEqual({ x: 0, y: 0 })
  })

  test('exact cardinal and diagonal directions preserve direction and length', () => {
    // 0 degrees (East)
    const e0 = constrainToAngleStep(100, 0, 45)
    expect(e0.x).toBeCloseTo(100, 5)
    expect(e0.y).toBeCloseTo(0, 5)

    // 45 degrees (South-East)
    const e45 = constrainToAngleStep(100, 100, 45)
    const len45 = Math.hypot(100, 100)
    expect(Math.hypot(e45.x, e45.y)).toBeCloseTo(len45, 5)
    expect(e45.x).toBeCloseTo(len45 * Math.cos(Math.PI / 4), 5)
    expect(e45.y).toBeCloseTo(len45 * Math.sin(Math.PI / 4), 5)

    // 90 degrees (South)
    const e90 = constrainToAngleStep(0, 50, 45)
    expect(e90.x).toBeCloseTo(0, 5)
    expect(e90.y).toBeCloseTo(50, 5)

    // 180 degrees (West)
    const e180 = constrainToAngleStep(-80, 0, 45)
    expect(e180.x).toBeCloseTo(-80, 5)
    expect(e180.y).toBeCloseTo(0, 5)

    // -90 / 270 degrees (North)
    const e270 = constrainToAngleStep(0, -60, 45)
    expect(e270.x).toBeCloseTo(0, 5)
    expect(e270.y).toBeCloseTo(-60, 5)
  })

  test('snaps angles < 22.5 deg to 0 deg and >= 22.5 deg to 45 deg', () => {
    // 15 degrees (~0.26 rad) -> snaps to 0
    const rad15 = (15 * Math.PI) / 180
    const s15 = constrainToAngleStep(100 * Math.cos(rad15), 100 * Math.sin(rad15), 45)
    expect(s15.x).toBeCloseTo(100, 5)
    expect(s15.y).toBeCloseTo(0, 5)

    // 30 degrees (~0.52 rad) -> snaps to 45
    const rad30 = (30 * Math.PI) / 180
    const s30 = constrainToAngleStep(100 * Math.cos(rad30), 100 * Math.sin(rad30), 45)
    expect(s30.x).toBeCloseTo(100 * Math.cos(Math.PI / 4), 5)
    expect(s30.y).toBeCloseTo(100 * Math.sin(Math.PI / 4), 5)
    expect(Math.hypot(s30.x, s30.y)).toBeCloseTo(100, 5)
  })
})

describe('pen sizing constants', () => {
  test('constants match specification', () => {
    expect(PEN_VERTEX_RADIUS).toBe(4)
    expect(PEN_HANDLE_RADIUS).toBe(3.5)
    expect(PEN_CLOSE_THRESHOLD).toBe(10)
    expect(PEN_DRAG_DEAD_ZONE).toBe(3)
  })
})

describe('penCursor and hover intent', () => {
  test('returns crosshair by default when idle', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    expect(penCursor(editor, 50, 50)).toBe('crosshair')
  })

  test('returns close cursor when hovering start vertex of 3+ vertex path within threshold', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    editor.state.penState = {
      vertices: [
        { x: 10, y: 10, handleMirroring: 'NONE' },
        { x: 100, y: 10, handleMirroring: 'NONE' },
        { x: 100, y: 100, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      dragTangent: null,
      oppositeDragTangent: null,
      closingToFirst: false
    }

    // At zoom = 1, threshold is 10px
    expect(penCursor(editor, 14, 10)).toBe(CLOSE_CURSOR)
    expect(penCursor(editor, 25, 10)).toBe('crosshair')

    // At zoom = 2, threshold is 10 / 2 = 5px
    editor.state.zoom = 2
    expect(penCursor(editor, 14, 10)).toBe(CLOSE_CURSOR)
    expect(penCursor(editor, 16, 10)).toBe('crosshair')

    // updatePenHover updates editor.state.penHoverIntent
    updatePenHover(14, 10, editor)
    expect(editor.state.penHoverIntent).toBe('close')

    updatePenHover(50, 50, editor)
    expect(editor.state.penHoverIntent).toBe(null)
  })

  test('does not return close cursor if path has fewer than 3 vertices', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    editor.state.penState = {
      vertices: [
        { x: 10, y: 10, handleMirroring: 'NONE' },
        { x: 100, y: 10, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      dragTangent: null,
      oppositeDragTangent: null,
      closingToFirst: false
    }

    expect(penCursor(editor, 12, 10)).toBe('crosshair')
  })

  test('returns continue cursor when hovering open endpoint of existing vector', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    const pageId = editor.state.currentPageId
    editor.graph.createNode('VECTOR', pageId, {
      name: 'Path',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      vectorNetwork: {
        vertices: [
          { x: 20, y: 20, handleMirroring: 'NONE' },
          { x: 80, y: 80, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    expect(penCursor(editor, 22, 20)).toBe(CONTINUE_CURSOR)
    expect(penCursor(editor, 81, 80)).toBe(CONTINUE_CURSOR)
    expect(penCursor(editor, 50, 50)).toBe('crosshair')
  })

  test('returns continue cursor when hovering endpoint in node-edit mode', () => {
    const editor = createEditor()
    const mockEditState: NodeEditState = {
      nodeId: 'v1',
      vertices: [
        { x: 10, y: 10, handleMirroring: 'NONE' },
        { x: 50, y: 50, handleMirroring: 'NONE' },
        { x: 90, y: 90, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      selectedVertexIndices: new Set(),
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }
    editor.state.nodeEditState = mockEditState

    // Vertex 0 is an endpoint -> CONTINUE_CURSOR
    expect(penCursor(editor, 11, 10)).toBe(CONTINUE_CURSOR)
    // Vertex 2 is an endpoint -> CONTINUE_CURSOR
    expect(penCursor(editor, 89, 90)).toBe(CONTINUE_CURSOR)
    // Vertex 1 has 2 connected segments (not an endpoint) -> segment hit or crosshair
    expect(penCursor(editor, 50, 50)).not.toBe(CONTINUE_CURSOR)

    updatePenHover(11, 10, editor)
    expect(editor.state.penHoverIntent).toBe('continue')
    expect(editor.state.penHoverEndpoint).toEqual({ nodeId: 'v1', vertexIndex: 0 })

    updatePenHover(50, 50, editor)
    expect(editor.state.penHoverEndpoint).toBeNull()
  })

  test('returns insert cursor when hovering segment in node-edit mode', () => {
    const editor = createEditor()
    const mockEditState: NodeEditState = {
      nodeId: 'v1',
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      selectedVertexIndices: new Set(),
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }
    editor.state.nodeEditState = mockEditState

    // Point (50, 2) is 2px from line (0,0)-(100,0) -> within threshold (10px) -> INSERT_CURSOR
    expect(penCursor(editor, 50, 2)).toBe(INSERT_CURSOR)

    // Point (50, 30) is 30px away -> 'crosshair'
    expect(penCursor(editor, 50, 30)).toBe('crosshair')
  })
})

describe('pen lifecycle and actions', () => {
  test('anchor placement without Shift places at exact coordinates', () => {
    const editor = createEditor()
    editor.penAddVertex(10, 20)
    editor.penAddVertex(55, 65)
    expect(editor.state.penState?.vertices).toEqual([
      { x: 10, y: 20 },
      { x: 55, y: 65 }
    ])
  })

  test('anchor placement with 45-degree constraint snaps to nearest 45 degree ray', () => {
    const last = { x: 0, y: 0 }
    const rawDx = 100
    const rawDy = 20 // ~11 degrees -> should snap to 0 degrees (East)
    const snapped = constrainToAngleStep(rawDx - last.x, rawDy - last.y, 45)
    expect(snapped.x).toBeCloseTo(Math.hypot(100, 20), 4)
    expect(snapped.y).toBeCloseTo(0, 4)
  })

  test('commit of an open path creates a VECTOR node with no regions and 1 undo entry', () => {
    const editor = createEditor()
    const initialUndoLength = editor.undo.undoDepth

    editor.penAddVertex(0, 0)
    editor.penAddVertex(100, 0)
    editor.penAddVertex(100, 100)
    editor.penCommit(false)

    expect(editor.undo.undoDepth - initialUndoLength).toBe(1)
    expect(editor.state.penState).toBeNull()

    const selectedId = expectDefined([...editor.state.selectedIds][0], 'committed pen node id')
    const node = editor.graph.getNode(selectedId)
    expect(node?.type).toBe('VECTOR')
    expect(node?.vectorNetwork?.vertices.length).toBe(3)
    expect(node?.vectorNetwork?.segments.length).toBe(2)
    expect(node?.vectorNetwork?.regions.length).toBe(0)
  })

  test('identical pen input commits to byte-identical VectorNetwork blobs', () => {
    const commitNetwork = () => {
      const editor = createEditor()
      editor.penAddVertex(0, 0)
      editor.penAddVertex(100, 25)
      editor.penAddVertex(150, 100)
      editor.penCommit(false)
      const selectedId = [...editor.state.selectedIds][0]
      const node = selectedId ? editor.graph.getNode(selectedId) : undefined
      if (!node?.vectorNetwork) throw new Error('Expected committed pen network')
      return encodeVectorNetworkBlob(node.vectorNetwork)
    }

    expect(commitNetwork()).toEqual(commitNetwork())
  })

  test('commit of a closed path creates a VECTOR node with NONZERO region', () => {
    const editor = createEditor()
    editor.penAddVertex(0, 0)
    editor.penAddVertex(100, 0)
    editor.penAddVertex(100, 100)
    editor.penSetPendingClose(true)
    editor.penCommit(true)

    expect(editor.state.penState).toBeNull()
    const selectedId = expectDefined([...editor.state.selectedIds][0], 'committed pen node id')
    const node = editor.graph.getNode(selectedId)
    expect(node?.type).toBe('VECTOR')
    expect(node?.vectorNetwork?.vertices.length).toBe(3)
    expect(node?.vectorNetwork?.segments.length).toBe(3)
    expect(node?.vectorNetwork?.regions.length).toBe(1)
    expect(node?.vectorNetwork?.regions[0].windingRule).toBe('NONZERO')
  })

  test('penCancel leaves no node in the graph and resets pen state', () => {
    const editor = createEditor()
    const nodeCountBefore = editor.graph.getChildren(editor.state.currentPageId).length
    editor.penAddVertex(10, 10)
    editor.penAddVertex(50, 50)
    editor.penCancel()

    expect(editor.state.penState).toBeNull()
    expect(editor.graph.getChildren(editor.state.currentPageId).length).toBe(nodeCountBefore)
  })

  test('single-click path creates no zero-dimension vector on commit', () => {
    const editor = createEditor()
    const nodeCountBefore = editor.graph.getChildren(editor.state.currentPageId).length
    editor.penAddVertex(10, 10)
    editor.penCommit(false)

    expect(editor.state.penState).toBeNull()
    expect(editor.graph.getChildren(editor.state.currentPageId).length).toBe(nodeCountBefore)
  })
})

describe('penLinkToEndpoint and mid-draw continue', () => {
  test('returns continue cursor when hovering open endpoint of another vector while drawing', () => {
    const editor = createEditor()
    editor.setTool('PEN')
    const pageId = editor.state.currentPageId
    editor.graph.createNode('VECTOR', pageId, {
      name: 'Target Path',
      x: 800,
      y: 500,
      width: 100,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, handleMirroring: 'NONE' },
          { x: 100, y: 0, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    // Start drawing a new path with 1 vertex at (700, 500)
    editor.penAddVertex(700, 500)
    expect(editor.state.penState).not.toBeNull()

    // Hover near endpoint 1 of target path: absolute (900, 500)
    expect(penCursor(editor, 902, 500)).toBe(CONTINUE_CURSOR)
    // Hover near endpoint 0 of target path: absolute (800, 500)
    expect(penCursor(editor, 801, 500)).toBe(CONTINUE_CURSOR)
    // Hover far away
    expect(penCursor(editor, 750, 600)).toBe('crosshair')

    updatePenHover(902, 500, editor)
    expect(editor.state.penHoverIntent).toBe('continue')
    expect(editor.state.penHoverEndpoint).toEqual(expect.objectContaining({ vertexIndex: 1 }))
  })

  test('joins in-progress pen path to target open vector endpoint and commits', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const targetNode = editor.graph.createNode('VECTOR', pageId, {
      name: 'Target Path',
      x: 800,
      y: 500,
      width: 100,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, handleMirroring: 'NONE' },
          { x: 100, y: 0, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    editor.setTool('PEN')
    editor.penAddVertex(900, 650)
    expect(editor.state.penState?.vertices.length).toBe(1)

    const penActions = createPenActions(editor, editor.graph, editor.state)
    penActions.penLinkToEndpoint(targetNode.id, 1)

    const children = editor.graph.getChildren(pageId)
    const vectors = children.filter((n) => n.type === 'VECTOR')
    expect(vectors.length).toBe(1)

    const merged = vectors[0]
    expect(merged.id).not.toBe(targetNode.id)
    expect(merged.vectorNetwork?.vertices.length).toBe(3)
    expect(merged.vectorNetwork?.segments.length).toBe(2)
    expect(editor.state.penState).toBeNull()
  })

  test('joins to start endpoint (index 0) preserving chain ordering', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const targetNode = editor.graph.createNode('VECTOR', pageId, {
      name: 'Target Path',
      x: 800,
      y: 500,
      width: 100,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, handleMirroring: 'NONE' },
          { x: 100, y: 0, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    editor.setTool('PEN')
    editor.penAddVertex(700, 500)

    const penActions = createPenActions(editor, editor.graph, editor.state)
    penActions.penLinkToEndpoint(targetNode.id, 0)

    const children = editor.graph.getChildren(pageId)
    const vectors = children.filter((n) => n.type === 'VECTOR')
    expect(vectors.length).toBe(1)

    const merged = vectors[0]
    expect(merged.vectorNetwork?.vertices.length).toBe(3)
    expect(merged.vectorNetwork?.segments.length).toBe(2)
    expect(editor.state.penState).toBeNull()
  })

  test('preserves dragTangent on join segment if pen had active drag tangent', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const targetNode = editor.graph.createNode('VECTOR', pageId, {
      name: 'Target Path',
      x: 800,
      y: 500,
      width: 100,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, handleMirroring: 'NONE' },
          { x: 100, y: 0, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    editor.setTool('PEN')
    editor.penAddVertex(700, 500)
    if (editor.state.penState) {
      editor.state.penState.dragTangent = { x: 10, y: -20 }
    }

    const penActions = createPenActions(editor, editor.graph, editor.state)
    penActions.penLinkToEndpoint(targetNode.id, 0)

    const children = editor.graph.getChildren(pageId)
    const vectors = children.filter((n) => n.type === 'VECTOR')
    expect(vectors.length).toBe(1)
    const merged = vectors[0]
    expect(merged.vectorNetwork?.segments[0].tangentStart).toEqual({ x: 10, y: -20 })
  })

  test('no-ops safely if penState is missing or target is invalid', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const targetNode = editor.graph.createNode('VECTOR', pageId, {
      name: 'Target Path',
      x: 800,
      y: 500,
      width: 100,
      height: 0,
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, handleMirroring: 'NONE' },
          { x: 100, y: 0, handleMirroring: 'NONE' }
        ],
        segments: [
          { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
        ],
        regions: []
      }
    })

    const penActions = createPenActions(editor, editor.graph, editor.state)
    // No pen state
    penActions.penLinkToEndpoint(targetNode.id, 0)
    expect(editor.graph.getChildren(pageId).length).toBe(1)

    // Nonexistent node ID
    editor.penAddVertex(100, 100)
    penActions.penLinkToEndpoint('nonexistent', 0)
    expect(editor.state.penState?.vertices.length).toBe(1)
  })
})
