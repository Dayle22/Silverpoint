import type { SceneNode } from './'
import { rotatedBBox } from './geometry'
import type { Rect } from './primitives'

export const SNAP_THRESHOLD = 5

export interface AlignmentSnapGuide {
  kind: 'alignment'
  axis: 'x' | 'y'
  position: number
  from: number
  to: number
}

export interface SpacingSnapGuide {
  kind: 'spacing'
  axis: 'x' | 'y'
  position: number
  from: number
  to: number
  gap: number
  segments: [{ from: number; to: number }, { from: number; to: number }]
}

export type SnapGuide = AlignmentSnapGuide | SpacingSnapGuide

export interface SnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

type Candidate = {
  delta: number
  guide: SnapGuide
  priority: 0 | 1
  order: number
}

function getEdges(node: SceneNode) {
  return rotatedBBox(node.x, node.y, node.width, node.height, node.rotation)
}

function isBetterCandidate(candidate: Candidate, current: Candidate | null): boolean {
  if (!current) return true
  const distance = Math.abs(candidate.delta)
  const currentDistance = Math.abs(current.delta)
  if (distance !== currentDistance) return distance < currentDistance
  if (candidate.priority !== current.priority) return candidate.priority < current.priority
  return candidate.order < current.order
}

function chooseCandidate(candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null
  for (const candidate of candidates) {
    if (Math.abs(candidate.delta) >= SNAP_THRESHOLD) continue
    if (isBetterCandidate(candidate, best)) best = candidate
  }
  return best
}

function alignmentCandidates(
  movingBounds: Rect,
  targets: SceneNode[],
  axis: 'x' | 'y'
): Candidate[] {
  const m = {
    left: movingBounds.x,
    right: movingBounds.x + movingBounds.width,
    centerX: movingBounds.x + movingBounds.width / 2,
    top: movingBounds.y,
    bottom: movingBounds.y + movingBounds.height,
    centerY: movingBounds.y + movingBounds.height / 2
  }
  const candidates: Candidate[] = []
  let order = 0

  for (const target of targets) {
    const t = getEdges(target)
    const pairs: [number, number][] =
      axis === 'x'
        ? [
            [m.left, t.left],
            [m.left, t.right],
            [m.right, t.left],
            [m.right, t.right],
            [m.centerX, t.centerX]
          ]
        : [
            [m.top, t.top],
            [m.top, t.bottom],
            [m.bottom, t.top],
            [m.bottom, t.bottom],
            [m.centerY, t.centerY]
          ]

    for (const [moving, targetValue] of pairs) {
      const delta = targetValue - moving
      candidates.push({
        delta,
        priority: 0,
        order: order++,
        guide:
          axis === 'x'
            ? {
                kind: 'alignment',
                axis,
                position: targetValue,
                from: Math.min(m.top, t.top),
                to: Math.max(m.bottom, t.bottom)
              }
            : {
                kind: 'alignment',
                axis,
                position: targetValue,
                from: Math.min(m.left, t.left),
                to: Math.max(m.right, t.right)
              }
      })
    }
  }
  return candidates
}

function spacingCandidates(movingBounds: Rect, targets: SceneNode[], axis: 'x' | 'y'): Candidate[] {
  const m = {
    left: movingBounds.x,
    right: movingBounds.x + movingBounds.width,
    top: movingBounds.y,
    bottom: movingBounds.y + movingBounds.height
  }
  const edges = targets.map((target, index) => ({ index, ...getEdges(target) }))
  const candidates: Candidate[] = []
  let order = 0

  for (const first of edges) {
    for (const second of edges) {
      if (first.index === second.index) continue
      const firstEnd = axis === 'x' ? first.right : first.bottom
      const secondStart = axis === 'x' ? second.left : second.top
      const movingStart = axis === 'x' ? m.left : m.top
      const movingEnd = axis === 'x' ? m.right : m.bottom
      const firstGap = movingStart - firstEnd
      const secondGap = secondStart - movingEnd
      if (firstGap < 0 || secondGap < 0) continue

      const delta = (firstGap - secondGap) / 2
      const gap = (firstGap + secondGap) / 2
      candidates.push({
        delta,
        priority: 1,
        order: order++,
        guide:
          axis === 'x'
            ? {
                kind: 'spacing',
                axis,
                position: m.bottom + 12,
                from: firstEnd,
                to: secondStart,
                gap,
                segments: [
                  { from: firstEnd, to: movingStart },
                  { from: movingEnd, to: secondStart }
                ]
              }
            : {
                kind: 'spacing',
                axis,
                position: m.right + 12,
                from: firstEnd,
                to: secondStart,
                gap,
                segments: [
                  { from: firstEnd, to: movingStart },
                  { from: movingEnd, to: secondStart }
                ]
              }
      })
    }
  }
  return candidates
}

export function computeSnap(
  movingIds: Set<string>,
  movingBounds: Rect,
  allNodes: SceneNode[]
): SnapResult {
  const targets = allNodes.filter((node) => !movingIds.has(node.id))
  if (targets.length === 0) return { dx: 0, dy: 0, guides: [] }

  const x = chooseCandidate([
    ...alignmentCandidates(movingBounds, targets, 'x'),
    ...spacingCandidates(movingBounds, targets, 'x')
  ])
  const y = chooseCandidate([
    ...alignmentCandidates(movingBounds, targets, 'y'),
    ...spacingCandidates(movingBounds, targets, 'y')
  ])

  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guides: [x?.guide, y?.guide].filter((guide): guide is SnapGuide => guide !== undefined)
  }
}

export function computeSelectionBounds(nodes: SceneNode[]): Rect | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    const edges = getEdges(node)
    minX = Math.min(minX, edges.left)
    minY = Math.min(minY, edges.top)
    maxX = Math.max(maxX, edges.right)
    maxY = Math.max(maxY, edges.bottom)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
