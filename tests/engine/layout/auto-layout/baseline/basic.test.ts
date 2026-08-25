import { afterEach, describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph, setTextMeasurer } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('alignment - baseline auto-layout', () => {
  afterEach(() => {
    setTextMeasurer(null)
  })

  test('aligns text children by alphabetic baseline in horizontal layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Small text',
      width: 100,
      height: 24
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Large text',
      width: 150,
      height: 48
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 24, baseline: 16 }
      if (node.id === textB.id) return { width: 150, height: 48, baseline: 32 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childB.y).toBe(0)
    expect(childA.y).toBe(16)
    expect(childA.y + 16).toBe(childB.y + 32)
  })

  test('child layoutAlignSelf BASELINE aligns with other baseline children even if frame counterAxisAlign is MIN', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'MIN'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Child A',
      width: 100,
      height: 20,
      layoutAlignSelf: 'BASELINE'
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Child B',
      width: 120,
      height: 40,
      layoutAlignSelf: 'BASELINE'
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 20, baseline: 14 }
      if (node.id === textB.id) return { width: 120, height: 40, baseline: 28 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childB.y).toBe(0)
    expect(childA.y).toBe(14)
    expect(childA.y + 14).toBe(childB.y + 28)
  })

  test('child layoutAlignSelf MIN does not participate in baseline alignment in BASELINE frame', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Child A',
      width: 100,
      height: 20,
      layoutAlignSelf: 'MIN'
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Child B',
      width: 120,
      height: 40
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 20, baseline: 14 }
      if (node.id === textB.id) return { width: 120, height: 40, baseline: 28 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childA.y).toBe(0)
    expect(childB.y).toBe(0)
  })

  test('child without baseline metadata falls back safely to Yoga y without throwing', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Child A without baseline',
      width: 100,
      height: 20
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Child B with baseline',
      width: 120,
      height: 40
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 20 }
      if (node.id === textB.id) return { width: 120, height: 40, baseline: 28 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childA.y).toBe(0)
    expect(childB.y).toBe(0)
  })

  test('non-text child with layoutAlignSelf BASELINE does not participate and leaves position unchanged', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const rectangle = rect(graph, frame.id, 50, 50, {
      layoutAlignSelf: 'BASELINE'
    })
    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Text A',
      width: 100,
      height: 30
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 30, baseline: 22 }
      return null
    })

    computeLayout(graph, frame.id)

    const rectChild = getNodeOrThrow(graph, rectangle.id)
    const textChild = getNodeOrThrow(graph, textA.id)

    expect(rectChild.y).toBe(0)
    expect(textChild.y).toBe(0)
  })

  test('WRAP layout with counterAxisAlign BASELINE is unaffected and remains MIN-equivalent', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 200,
      layoutWrap: 'WRAP',
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Text A',
      width: 120,
      height: 24
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Text B',
      width: 120,
      height: 48
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 120, height: 24, baseline: 16 }
      if (node.id === textB.id) return { width: 120, height: 48, baseline: 32 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childA.y).toBe(0)
    expect(childB.y).toBe(24)
  })

  test('VERTICAL layout with counterAxisAlign BASELINE is unaffected and remains MIN-equivalent', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Text A',
      width: 100,
      height: 24
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Text B',
      width: 100,
      height: 48
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 24, baseline: 16 }
      if (node.id === textB.id) return { width: 100, height: 48, baseline: 32 }
      return null
    })

    computeLayout(graph, frame.id)

    const childA = getNodeOrThrow(graph, textA.id)
    const childB = getNodeOrThrow(graph, textB.id)

    expect(childA.y).toBe(0)
    expect(childB.y).toBe(24)
    expect(childA.x).toBe(0)
    expect(childB.x).toBe(0)
  })

  test('baseline alignment is idempotent across multiple computeLayout calls', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'BASELINE'
    })

    const textA = graph.createNode('TEXT', frame.id, {
      text: 'Small text',
      width: 100,
      height: 24
    })
    const textB = graph.createNode('TEXT', frame.id, {
      text: 'Large text',
      width: 150,
      height: 48
    })

    setTextMeasurer((node) => {
      if (node.id === textA.id) return { width: 100, height: 24, baseline: 16 }
      if (node.id === textB.id) return { width: 150, height: 48, baseline: 32 }
      return null
    })

    computeLayout(graph, frame.id)

    const yA1 = getNodeOrThrow(graph, textA.id).y
    const yB1 = getNodeOrThrow(graph, textB.id).y

    computeLayout(graph, frame.id)

    const yA2 = getNodeOrThrow(graph, textA.id).y
    const yB2 = getNodeOrThrow(graph, textB.id).y

    expect(yA2).toBe(yA1)
    expect(yB2).toBe(yB1)
  })
})
