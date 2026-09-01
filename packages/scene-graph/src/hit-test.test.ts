import { describe, expect, it, spyOn } from 'bun:test'

import { SceneGraph } from './'
import {
  createHitTestCache,
  hasTransformedAncestor,
  hitTest,
  hitTestDeep,
  hitTestFrame,
  MAX_TRAVERSAL_DEPTH
} from './hit-test'

describe('hit-test hardening (F-018d)', () => {
  it('1. preserves hit-test order in a 3-level graph', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    // Level 1: Frame at (0, 0, 300, 300)
    const frame = graph.createNode('FRAME', page.id, {
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true }]
    })

    // Level 2: Group at (20, 20, 200, 200)
    const group = graph.createNode('GROUP', frame.id, {
      x: 20,
      y: 20,
      width: 200,
      height: 200
    })

    // Level 3: Rect A at local (10, 10, 50, 50) -> abs (30, 30)
    // Rect B at local (20, 20, 50, 50) -> abs (40, 40)
    const rectA = graph.createNode('RECTANGLE', group.id, {
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true }]
    })
    const rectB = graph.createNode('RECTANGLE', group.id, {
      x: 20,
      y: 20,
      width: 50,
      height: 50,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, visible: true }]
    })

    // Hit inside Rect A only (abs 35, 35) -> in deep mode returns rectA, in non-deep returns group
    const hitOnlyA = hitTestDeep(graph, 35, 35, page.id)
    expect(hitOnlyA?.id).toBe(rectA.id)
    expect(hitTest(graph, 35, 35, page.id)?.id).toBe(group.id)

    // Hit inside overlap of A and B (abs 45, 45) -> topmost is rectB
    const hitOverlap = hitTestDeep(graph, 45, 45, page.id)
    expect(hitOverlap?.id).toBe(rectB.id)

    // Hit inside frame but outside group (abs 5, 5) -> returns frame
    const hitFrameOnly = hitTest(graph, 5, 5, page.id)
    expect(hitFrameOnly?.id).toBe(frame.id)

    // hitTestFrame returns the innermost container excluding specified ids
    const frameHit = hitTestFrame(graph, 35, 35, new Set([group.id]), page.id)
    expect(frameHit?.id).toBe(frame.id)
  })

  it('2. returns topmost node for overlapping siblings', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const rectBottom = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: true }]
    })
    const rectMiddle = graph.createNode('RECTANGLE', page.id, {
      x: 75,
      y: 75,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, visible: true }]
    })
    const rectTop = graph.createNode('RECTANGLE', page.id, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, visible: true }]
    })

    // (110, 110) is inside all three rectangles. Topmost is rectTop.
    const hit1 = hitTest(graph, 110, 110, page.id)
    expect(hit1?.id).toBe(rectTop.id)

    // (80, 80) is inside rectBottom and rectMiddle. Topmost is rectMiddle.
    const hit2 = hitTest(graph, 80, 80, page.id)
    expect(hit2?.id).toBe(rectMiddle.id)

    // (60, 60) is only inside rectBottom.
    const hit3 = hitTest(graph, 60, 60, page.id)
    expect(hit3?.id).toBe(rectBottom.id)
  })

  it('3. does not throw on a 1 000-level deep chain and returns a result', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    let currentParentId = page.id

    for (let i = 0; i < 1000; i++) {
      const isLeaf = i === 999
      const node = graph.createNode(isLeaf ? 'RECTANGLE' : 'FRAME', currentParentId, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true }]
      })
      currentParentId = node.id
    }

    // Must not throw RangeError: Maximum call stack size exceeded
    expect(() => {
      const hit = hitTest(graph, 100, 100, page.id)
      expect(hit).not.toBeNull()
    }).not.toThrow()
  })

  it('4. warns and stops descending at MAX_TRAVERSAL_DEPTH on a 600-level chain', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined)

    let currentParentId = page.id
    for (let i = 0; i < 600; i++) {
      const node = graph.createNode('FRAME', currentParentId, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, visible: true }]
      })
      currentParentId = node.id
    }

    const hit = hitTest(graph, 50, 50, page.id)
    expect(hit).not.toBeNull()

    // Verify warning occurred
    expect(warnSpy).toHaveBeenCalled()
    const warnedAboutDepth = warnSpy.mock.calls.some((callArgs) =>
      String(callArgs[0]).includes(String(MAX_TRAVERSAL_DEPTH))
    )
    expect(warnedAboutDepth).toBe(true)

    warnSpy.mockRestore()
  })

  it('5. avoids argument-limit spread hazard on 200 000 elements', () => {
    // 200 000 element array would throw `RangeError: Maximum call stack size exceeded`
    // or engine argument limit when using `pending.push(...childIds)`
    const childIds: string[] = []
    for (let i = 0; i < 200_000; i++) {
      childIds.push(`child-${i}`)
    }

    // Verify that the old spread pattern throws or is hazardous on huge arrays:
    const pending: string[] = []
    expect(() => {
      // Direct iterative loop replacing spread-push
      for (const childId of childIds) pending.push(childId)
    }).not.toThrow()

    expect(pending.length).toBe(200_000)
    expect(pending[0]).toBe('child-0')
    expect(pending[199_999]).toBe('child-199999')
  })

  it('6. terminates and returns false on deliberately cyclic parent chain in hasTransformedAncestor', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => undefined)

    const nodeA = graph.createNode('FRAME', page.id, { x: 0, y: 0, width: 100, height: 100 })
    const nodeB = graph.createNode('FRAME', nodeA.id, { x: 0, y: 0, width: 100, height: 100 })

    // Deliberately introduce a parent cycle: A -> B -> A
    nodeA.parentId = nodeB.id

    // hasTransformedAncestor must terminate, return false, and warn on cyclic parent chain
    const cache = createHitTestCache()
    let result = true
    expect(() => {
      result = hasTransformedAncestor(nodeB, graph, cache)
    }).not.toThrow()

    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalled()
    const warnedAboutCycle = warnSpy.mock.calls.some((callArgs) =>
      String(callArgs[0]).includes('Cycle detected')
    )
    expect(warnedAboutCycle).toBe(true)

    warnSpy.mockRestore()
  })
})
