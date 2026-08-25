import type { Editor, Tool } from '@open-pencil/core/editor'
import type { SceneGraph, VectorSegment } from '@open-pencil/scene-graph'

import {
  absoluteVertices,
  cloneSegments,
  createResumedPenState,
  walkChainOrdered,
  walkChainToEnd,
  type PenState
} from '@/app/editor/pen/resume'

export function createPenActions(editor: Editor, graph: SceneGraph, state: PenState) {
  function setTool(tool: Tool) {
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    editor.setTool(tool)
  }

  function penResumeOnPath(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    state.penState = createResumedPenState(
      node,
      absoluteVertices(node, node.vectorNetwork.vertices),
      cloneSegments(node.vectorNetwork.segments)
    )

    graph.deleteNode(nodeId)
    editor.clearSelection()
    editor.setTool('PEN')
    editor.requestRender()
  }

  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = absoluteVertices(node, node.vectorNetwork.vertices)
    const absSegments = cloneSegments(node.vectorNetwork.segments)
    const otherEnd = walkChainToEnd(absSegments, endpointVertexIndex)
    const { orderedVertices, orderedSegments } = walkChainOrdered(
      absVertices,
      absSegments,
      otherEnd
    )

    state.penState = createResumedPenState(node, orderedVertices, orderedSegments)
    graph.deleteNode(nodeId)
    editor.clearSelection()
    editor.setTool('PEN')
    editor.requestRender()
  }

  function penLinkToEndpoint(nodeId: string, endpointVertexIndex: number) {
    const ps = state.penState
    if (!ps || ps.vertices.length === 0) return

    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = absoluteVertices(node, node.vectorNetwork.vertices)
    const absSegments = cloneSegments(node.vectorNetwork.segments)
    const { orderedVertices, orderedSegments } = walkChainOrdered(
      absVertices,
      absSegments,
      endpointVertexIndex
    )

    const offset = ps.vertices.length
    const joinSegment: VectorSegment = {
      start: offset - 1,
      end: offset,
      tangentStart: ps.dragTangent ? { ...ps.dragTangent } : { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    }
    const shiftedSegments: VectorSegment[] = orderedSegments.map((s) => ({
      ...s,
      start: s.start + offset,
      end: s.end + offset
    }))

    ps.vertices = [...ps.vertices, ...orderedVertices]
    ps.segments = [...ps.segments, joinSegment, ...shiftedSegments]
    ps.dragTangent = null
    ps.oppositeDragTangent = null
    ps.pendingClose = false
    ps.closingToFirst = false

    graph.deleteNode(nodeId)
    editor.penCommit(false)
  }

  return { setTool, penResumeOnPath, penResumeFromEndpoint, penLinkToEndpoint }
}
