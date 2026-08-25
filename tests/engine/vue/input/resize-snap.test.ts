import { describe, expect, test } from 'bun:test'

import type { SceneNode } from '@open-pencil/scene-graph'

import { computeResizeSnap } from '#vue/shared/input/resize'

function node(overrides: Partial<SceneNode> & { id: string }): SceneNode {
  return { x: 0, y: 0, width: 40, height: 40, rotation: 0, ...overrides } as SceneNode
}

describe('resize snapping', () => {
  test('snaps the active east edge of one unrotated node to a sibling edge', () => {
    const result = computeResizeSnap(
      { x: 100, y: 100, width: 53, height: 50 },
      'e',
      node({ id: 'moving', x: 100, y: 100, width: 53, height: 50 }),
      [node({ id: 'target', x: 155, y: 100 })]
    )

    expect(result.rect).toMatchObject({ x: 100, y: 100, width: 55, height: 50 })
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: 'alignment', axis: 'x' }))
  })

  test('does not resize-snap a rotated node', () => {
    const result = computeResizeSnap(
      { x: 100, y: 100, width: 53, height: 50 },
      'e',
      node({ id: 'moving', x: 100, y: 100, width: 53, height: 50, rotation: 15 }),
      [node({ id: 'target', x: 155, y: 100 })]
    )

    expect(result.rect).toEqual({ x: 100, y: 100, width: 53, height: 50 })
    expect(result.guides).toEqual([])
  })
})
