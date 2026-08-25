import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  evalCubic,
  removeVertex,
  segmentToAbsolute,
  splitSegmentAt
} from '@open-pencil/core/vector'
import type { VectorNetwork } from '@open-pencil/scene-graph'

import { createVectorEditActions } from '@/app/editor/vector-edit'
import { hitTestEditSegment, type NodeEditState } from '#vue/shared/input/node-edit'
import { expectDefined } from '#tests/helpers/assert'

describe('hitTestEditSegment', () => {
  test('hits straight line segment within threshold', () => {
    const editor = createEditor()
    editor.state.nodeEditState = {
      nodeId: 'node-1',
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

    const hit = hitTestEditSegment(editor, 50, 4)
    expect(hit).not.toBeNull()
    expect(hit?.segmentIndex).toBe(0)
    expect(hit?.t).toBeCloseTo(0.5, 2)
    expect(hit?.point.x).toBeCloseTo(50, 1)
    expect(hit?.point.y).toBeCloseTo(0, 1)

    // Outside threshold (10px at zoom=1)
    const miss = hitTestEditSegment(editor, 50, 15)
    expect(miss).toBeNull()
  })

  test('hits curved bezier segment within threshold', () => {
    const editor = createEditor()
    editor.state.nodeEditState = {
      nodeId: 'node-1',
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: -50 }, tangentEnd: { x: 0, y: -50 } }
      ],
      selectedVertexIndices: new Set(),
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }

    // Near the apex of the curve (y is negative)
    const hit = hitTestEditSegment(editor, 50, -35)
    expect(hit).not.toBeNull()
    expect(hit?.segmentIndex).toBe(0)
  })
})

describe('splitSegmentAt and removeVertex geometry operations', () => {
  test('insertion via splitSegmentAt at parameter t preserves curve geometry within tolerance', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 50 }, tangentEnd: { x: 0, y: 50 } }
      ],
      regions: []
    }

    const { p0, cp1, cp2, p3 } = segmentToAbsolute(network, 0)
    const t = 0.4
    const originalMid = evalCubic(p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y, t)

    const split = splitSegmentAt(network, 0, t)
    expect(split.network.vertices.length).toBe(3)
    expect(split.network.segments.length).toBe(2)

    // The inserted vertex position must match evalCubic at t
    const newVertex = split.network.vertices[split.newVertexIndex]
    expect(newVertex.x).toBeCloseTo(originalMid.x, 3)
    expect(newVertex.y).toBeCloseTo(originalMid.y, 3)
  })

  test('removeVertex re-bridges connected segments and re-indexes regions', () => {
    const network: VectorNetwork = {
      vertices: [
        { x: 0, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 0, handleMirroring: 'NONE' },
        { x: 100, y: 100, handleMirroring: 'NONE' }
      ],
      segments: [
        { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
        { start: 2, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
      ],
      regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
    }

    const updated = removeVertex(network, 1)
    expect(updated).not.toBeNull()
    expect(updated?.vertices.length).toBe(2)
    // Segments 0 and 1 merged into a single segment between 0 and 2
    expect(updated?.segments.length).toBe(2)
    expect(updated?.regions.length).toBe(1)
  })
})

function setupVectorEdit() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const initialNetwork: VectorNetwork = {
    vertices: [
      { x: 0, y: 0, handleMirroring: 'NONE' },
      { x: 50, y: 0, handleMirroring: 'NONE' },
      { x: 100, y: 0, handleMirroring: 'NONE' }
    ],
    segments: [
      { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: -10, y: -10 } },
      { start: 1, end: 2, tangentStart: { x: 20, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    ],
    regions: []
  }

  const node = editor.graph.createNode('VECTOR', pageId, {
    name: 'Test Vector',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    vectorNetwork: initialNetwork
  })

  const state = {
    nodeEditState: null as NodeEditState | null,
    zoom: 1
  }

  const vectorEdit = createVectorEditActions(editor, editor.graph, state)
  vectorEdit.enterNodeEditMode(node.id)

  return { editor, vectorEdit, node }
}

describe('nodeEditSetMirroring', () => {
  test('sets mirroring mode to ANGLE_AND_LENGTH (Smooth) and mirrors opposite tangent', () => {
    const { editor, vectorEdit } = setupVectorEdit()
    const es = vectorEdit.getNodeEditState()
    expect(es).not.toBeNull()

    // Select vertex 1 (the middle vertex connecting both segments)
    vectorEdit.nodeEditSelectVertex(1, false)

    const undoCountBefore = editor.undo.undoDepth
    vectorEdit.nodeEditSetMirroring('ANGLE_AND_LENGTH')
    const undoCountAfter = editor.undo.undoDepth

    expect(undoCountAfter - undoCountBefore).toBe(1)
    expect(es.vertices[1].handleMirroring).toBe('ANGLE_AND_LENGTH')

    // Handle 0 is seg0.tangentEnd = {-10, -10}. Mode ANGLE_AND_LENGTH mirrors it onto seg1.tangentStart = {10, 10}
    const seg0 = es.segments[0]
    const seg1 = es.segments[1]
    expect(seg0.tangentEnd.x).toBeCloseTo(-10, 2)
    expect(seg0.tangentEnd.y).toBeCloseTo(-10, 2)
    expect(seg1.tangentStart.x).toBeCloseTo(10, 2)
    expect(seg1.tangentStart.y).toBeCloseTo(10, 2)

    // Undo reverts mirroring and tangents
    editor.undo.undo()
    expect(es.vertices[1].handleMirroring).toBe('NONE')
    expect(es.segments[1].tangentStart.x).toBeCloseTo(20, 2)
    expect(es.segments[1].tangentStart.y).toBeCloseTo(0, 2)

    // Redo re-applies
    editor.undo.redo()
    expect(es.vertices[1].handleMirroring).toBe('ANGLE_AND_LENGTH')
    expect(es.segments[1].tangentStart.x).toBeCloseTo(10, 2)
  })

  test('sets mirroring mode to ANGLE (Disjoint) preserving independent handle lengths', () => {
    const { vectorEdit } = setupVectorEdit()
    const es = expectDefined(vectorEdit.getNodeEditState(), 'node edit state')

    vectorEdit.nodeEditSelectVertex(1, false)

    // Before: seg0 tangentEnd is {-10, -10}, seg1 tangentStart is {20, 0} (length 20)
    vectorEdit.nodeEditSetMirroring('ANGLE')

    expect(es.vertices[1].handleMirroring).toBe('ANGLE')
    // seg0 tangentEnd is unchanged: {-10, -10} (angle -135)
    // seg1 tangentStart gets mirrored angle (+45) while preserving its original length (20)
    const seg0 = es.segments[0]
    const seg1 = es.segments[1]
    expect(seg0.tangentEnd.x).toBeCloseTo(-10, 2)
    expect(seg0.tangentEnd.y).toBeCloseTo(-10, 2)

    const expectedLen = 20
    const expectedAngle = Math.PI / 4
    expect(seg1.tangentStart.x).toBeCloseTo(expectedLen * Math.cos(expectedAngle), 2)
    expect(seg1.tangentStart.y).toBeCloseTo(expectedLen * Math.sin(expectedAngle), 2)
  })
})

describe('undo count per gesture', () => {
  test('vertex selection does not create undo entries', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('VECTOR', pageId, {
      name: 'Test Vector',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
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

    const state = { nodeEditState: null as NodeEditState | null, zoom: 1 }
    const vectorEdit = createVectorEditActions(editor, editor.graph, state)
    vectorEdit.enterNodeEditMode(node.id)

    const initialStack = editor.undo.undoDepth
    vectorEdit.nodeEditSelectVertex(0, false)
    vectorEdit.nodeEditSelectVertex(1, true)
    expect(editor.undo.undoDepth).toBe(initialStack)
  })

  test('vertex addition, removal, and deletion each push exactly one undo entry', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const node = editor.graph.createNode('VECTOR', pageId, {
      name: 'Test Vector',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
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

    const state = { nodeEditState: null as NodeEditState | null, zoom: 1 }
    const vectorEdit = createVectorEditActions(editor, editor.graph, state)
    vectorEdit.enterNodeEditMode(node.id)

    // Add vertex on segment
    const count0 = editor.undo.undoDepth
    vectorEdit.nodeEditAddVertex(50, 0)
    expect(editor.undo.undoDepth - count0).toBe(1)

    // Remove vertex
    const count1 = editor.undo.undoDepth
    vectorEdit.nodeEditRemoveVertex(2)
    expect(editor.undo.undoDepth - count1).toBe(1)

    // Delete selected
    vectorEdit.nodeEditSelectVertex(0, false)
    const count2 = editor.undo.undoDepth
    vectorEdit.nodeEditDeleteSelected()
    expect(editor.undo.undoDepth - count2).toBe(1)
  })

  test('mirroring conversion across multi-vertex selection is exactly one undo entry', () => {
    const { editor, vectorEdit } = setupVectorEdit()
    const es = vectorEdit.getNodeEditState()
    expect(es).not.toBeNull()

    // Select vertex 0 and vertex 1
    vectorEdit.nodeEditSelectVertex(0, false)
    vectorEdit.nodeEditSelectVertex(1, true)

    const initialUndo = editor.undo.undoDepth
    vectorEdit.nodeEditSetMirroring('ANGLE_AND_LENGTH')
    const finalUndo = editor.undo.undoDepth

    expect(finalUndo - initialUndo).toBe(1)
    expect(es?.vertices[0].handleMirroring).toBe('ANGLE_AND_LENGTH')
    expect(es?.vertices[1].handleMirroring).toBe('ANGLE_AND_LENGTH')
  })
})
