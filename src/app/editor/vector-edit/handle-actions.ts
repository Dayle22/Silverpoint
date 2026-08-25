import type { Editor } from '@open-pencil/core/editor'
import { findAllHandles, findOppositeHandle, mirrorHandle } from '@open-pencil/core/vector'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { constrainContinuousTangent } from './handles'
import { getLiveNetwork } from './network'
import type { NodeEditState } from './types'

type GetNodeEditState = () => NodeEditState | null

export function createVectorEditHandleActions(editor: Editor, getNodeEditState: GetNodeEditState) {
  function nodeEditSetHandle(
    segmentIndex: number,
    tangentField: 'tangentStart' | 'tangentEnd',
    newTangent: Vector,
    options?: {
      breakMirroring?: boolean
      continuous?: boolean
      lockDirection?: boolean
    }
  ) {
    const es = getNodeEditState()
    if (!es) return
    const seg = es.segments[segmentIndex]

    const breakMirroring = options?.breakMirroring ?? false
    const continuous = options?.continuous ?? false
    const lockDirection = options?.lockDirection ?? false
    const vertexIndex = tangentField === 'tangentStart' ? seg.start : seg.end
    const vertex = es.vertices[vertexIndex]
    const live = getLiveNetwork(es)

    const all = findAllHandles(live, vertexIndex)
    const active = all.find(
      (h) => h.segmentIndex === segmentIndex && h.tangentField === tangentField
    )

    let applied = { x: newTangent.x, y: newTangent.y }
    if (continuous && active) {
      applied =
        constrainContinuousTangent(
          es,
          newTangent,
          active,
          all,
          seg,
          tangentField,
          vertexIndex,
          vertex
        ) ?? applied
    }

    seg[tangentField] = applied
    const mode = vertex.handleMirroring ?? 'NONE'
    if (lockDirection && mode === 'NONE') {
      seg[tangentField] = { x: newTangent.x, y: newTangent.y }
      editor.requestRepaint()
      return
    }
    if (breakMirroring) {
      vertex.handleMirroring = 'NONE'
      editor.requestRepaint()
      return
    }
    if (mode === 'NONE') {
      editor.requestRepaint()
      return
    }

    const opposite = findOppositeHandle(live, vertexIndex, segmentIndex)
    if (!opposite) {
      editor.requestRepaint()
      return
    }

    const oppositeSeg = es.segments[opposite.segmentIndex]
    const oppositeCurrent = oppositeSeg[opposite.tangentField]
    const oppositeLength =
      mode === 'ANGLE' ? Math.hypot(oppositeCurrent.x, oppositeCurrent.y) : undefined
    const mirrored = mirrorHandle(applied, mode, oppositeLength)
    if (mirrored) {
      oppositeSeg[opposite.tangentField] = mirrored
    }
    editor.requestRepaint()
  }

  function nodeEditBendHandle(
    vertexIndex: number,
    dx: number,
    dy: number,
    independent: boolean,
    targetSegmentIndex: number | null,
    targetTangentField: 'tangentStart' | 'tangentEnd' | null
  ) {
    const es = getNodeEditState()
    if (!es) return
    if (targetSegmentIndex == null || targetTangentField == null) return
    const live = getLiveNetwork(es)
    const handles = findAllHandles(live, vertexIndex)
    if (handles.length === 0) return

    const effectiveTargets = handles.filter(
      (h) => h.segmentIndex === targetSegmentIndex && h.tangentField === targetTangentField
    )
    if (effectiveTargets.length === 0) return

    const primary = { x: dx, y: dy }
    const opposite = independent ? { x: dx, y: dy } : { x: -dx, y: -dy }

    const first = effectiveTargets[0]
    es.segments[first.segmentIndex][first.tangentField] = primary
    for (let i = 1; i < effectiveTargets.length; i++) {
      const h = effectiveTargets[i]
      es.segments[h.segmentIndex][h.tangentField] = primary
    }
    if (!independent) {
      for (const h of handles) {
        if (effectiveTargets.includes(h)) continue
        es.segments[h.segmentIndex][h.tangentField] = opposite
      }
    }

    es.vertices[vertexIndex].handleMirroring = independent ? 'NONE' : 'ANGLE_AND_LENGTH'
    editor.requestRepaint()
  }

  function nodeEditZeroVertexHandles(vertexIndex: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const handles = findAllHandles(live, vertexIndex)
    for (const h of handles) {
      es.segments[h.segmentIndex][h.tangentField] = { x: 0, y: 0 }
    }
    es.vertices[vertexIndex].handleMirroring = 'NONE'
    editor.requestRepaint()
  }

  function nodeEditSetMirroring(mode: 'NONE' | 'ANGLE_AND_LENGTH' | 'ANGLE') {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size === 0) return

    const prevVertices = es.vertices.map((v) => ({ ...v }))
    const prevSegments = es.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    }))

    for (const vi of es.selectedVertexIndices) {
      es.vertices[vi].handleMirroring = mode

      if (mode === 'NONE') {
        continue
      }

      const live = getLiveNetwork(es)
      const handles = findAllHandles(live, vi)
      if (handles.length >= 2) {
        const primary = handles[0]
        const opposite = handles[1]
        const primarySeg = es.segments[primary.segmentIndex]
        const oppositeSeg = es.segments[opposite.segmentIndex]
        const primaryTangent = primarySeg[primary.tangentField]
        const oppositeTangent = oppositeSeg[opposite.tangentField]

        if (primaryTangent.x !== 0 || primaryTangent.y !== 0) {
          const oppLen =
            mode === 'ANGLE' ? Math.hypot(oppositeTangent.x, oppositeTangent.y) : undefined
          const mirrored = mirrorHandle(primaryTangent, mode, oppLen)
          if (mirrored) {
            oppositeSeg[opposite.tangentField] = mirrored
          }
        } else if (oppositeTangent.x !== 0 || oppositeTangent.y !== 0) {
          const primLen =
            mode === 'ANGLE' ? Math.hypot(primaryTangent.x, primaryTangent.y) : undefined
          const mirrored = mirrorHandle(oppositeTangent, mode, primLen)
          if (mirrored) {
            primarySeg[primary.tangentField] = mirrored
          }
        }
      }
    }

    const nextVertices = es.vertices.map((v) => ({ ...v }))
    const nextSegments = es.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    }))

    editor.undo.push({
      label: 'Change handle mirroring',
      forward: () => {
        const curEs = getNodeEditState()
        if (curEs && curEs.nodeId === es.nodeId) {
          curEs.vertices = nextVertices.map((v) => ({ ...v }))
          curEs.segments = nextSegments.map((s) => ({
            ...s,
            tangentStart: { ...s.tangentStart },
            tangentEnd: { ...s.tangentEnd }
          }))
          editor.requestRepaint()
        }
      },
      inverse: () => {
        const curEs = getNodeEditState()
        if (curEs && curEs.nodeId === es.nodeId) {
          curEs.vertices = prevVertices.map((v) => ({ ...v }))
          curEs.segments = prevSegments.map((s) => ({
            ...s,
            tangentStart: { ...s.tangentStart },
            tangentEnd: { ...s.tangentEnd }
          }))
          editor.requestRepaint()
        }
      }
    })

    editor.requestRepaint()
  }

  return {
    nodeEditSetHandle,
    nodeEditBendHandle,
    nodeEditZeroVertexHandles,
    nodeEditSetMirroring
  }
}
