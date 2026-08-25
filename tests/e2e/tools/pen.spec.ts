import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { getPageChildren, getSelectedIds } from '#tests/helpers/store'

const editor = useEditorSetupWithClear('/?test')

/** Screen-space distance, in canvas CSS pixels, that keeps the close affordance armed. */
const CLOSE_SCREEN_PX = 10

async function setZoom(zoom: number) {
  await editor.page.evaluate((value) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = value
    store.requestRender()
  }, zoom)
  await editor.canvas.waitForRender()
}

/** Places three pen vertices with plain clicks and leaves the path in progress. */
async function drawOpenTriangle(x: number, y: number, size = 100) {
  await editor.canvas.pressKey('p')
  await editor.canvas.click(x, y)
  await editor.canvas.waitForRender()
  await editor.canvas.click(x + size, y)
  await editor.canvas.waitForRender()
  await editor.canvas.click(x + size, y + size)
  await editor.canvas.waitForRender()
}

function readPenHover() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const canvasEl = document.querySelector('[data-test-id="canvas-element"]')
    return {
      intent: store.state.penHoverIntent ?? null,
      closingToFirst: store.state.penState?.closingToFirst ?? null,
      cursor: canvasEl ? getComputedStyle(canvasEl).cursor : null
    }
  })
}

function readUndoDepth() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.undo.undoDepth
  })
}

function readNodeEditState() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const es = store.state.nodeEditState
    if (!es) return null
    return {
      nodeId: es.nodeId,
      vertexCount: es.vertices.length,
      selected: [...es.selectedVertexIndices],
      mirroring: es.vertices.map((v) => v.handleMirroring)
    }
  })
}

/**
 * `CanvasHelper.undo()` only sends `Meta+z`, which the app's `$mod` binding
 * ignores off macOS, so drive undo through Playwright's platform-aware
 * modifier - the same idiom `tests/e2e/canvas/units.spec.ts` uses.
 */
async function undo() {
  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
}

/** Canvas-relative screen position of a node-edit vertex. */
function vertexScreenPoint(index: number) {
  return editor.page.evaluate((vertexIndex) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const es = store.state.nodeEditState
    if (!es) throw new Error('Not in node edit mode')
    // Node-edit vertices are already absolute document coordinates.
    const vertex = es.vertices[vertexIndex]
    return {
      x: vertex.x * store.state.zoom + store.state.panX,
      y: vertex.y * store.state.zoom + store.state.panY
    }
  }, index)
}

test('Pen tool draws an open vector path with 3 vertices on Enter', async () => {
  await drawOpenTriangle(100, 100)
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBeGreaterThan(0)
  const vector = vectors[vectors.length - 1]
  expect(vector.vectorNetwork?.vertices.length).toBe(3)
  expect(vector.vectorNetwork?.segments.length).toBe(2)
  editor.canvas.assertNoErrors()
})

test('Pen tool closes path when clicking start vertex of 3+ vertex path', async () => {
  await editor.canvas.pressKey('v')
  await drawOpenTriangle(300, 100)
  // Click back on the first vertex (300, 100) to close the loop
  await editor.canvas.click(300, 100)
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  const vector = vectors[vectors.length - 1]
  expect(vector.vectorNetwork?.vertices.length).toBe(3)
  // Closed triangle has 3 segments
  expect(vector.vectorNetwork?.segments.length).toBe(3)
  editor.canvas.assertNoErrors()
})

test('Close cursor and boosted first anchor arm within 10 screen px at 200% and 50% zoom', async () => {
  // The close threshold is expressed in document units scaled by 1/zoom, so the
  // armed radius must stay a constant ~10 CSS pixels on screen at every zoom.
  for (const zoom of [2, 0.5]) {
    await editor.canvas.pressKey('v')
    await setZoom(zoom)
    await drawOpenTriangle(300, 300, 120)

    await editor.canvas.hover(300 + CLOSE_SCREEN_PX - 4, 300)
    const armed = await readPenHover()
    expect(armed.intent).toBe('close')
    expect(armed.closingToFirst).toBe(true)
    expect(armed.cursor).toContain('svg+xml')

    await editor.canvas.hover(300 + CLOSE_SCREEN_PX + 10, 300)
    const disarmed = await readPenHover()
    expect(disarmed.intent).toBeNull()
    expect(disarmed.closingToFirst).toBe(false)
    expect(disarmed.cursor).toBe('crosshair')

    await editor.canvas.pressKey('Escape')
    await editor.canvas.waitForRender()
  }

  await setZoom(1)
  editor.canvas.assertNoErrors()
})

test('Shift-dragging a pen handle constrains the tangent to a 45 degree step', async () => {
  await editor.canvas.pressKey('v')
  await editor.canvas.pressKey('p')
  await editor.canvas.click(100, 300)
  await editor.canvas.waitForRender()

  // Second vertex sits due east of the first, so only the drag itself is
  // constrained: (50, 20) is ~21.8 degrees and must snap down to 0.
  await editor.canvas.shiftDrag(250, 300, 300, 320)
  await editor.canvas.click(400, 300)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  const children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  const network = vectors[vectors.length - 1].vectorNetwork
  expect(network?.segments.length).toBe(2)

  const tangent = network?.segments[1].tangentStart
  if (!tangent) throw new Error('Expected an outgoing tangent on the second segment')
  expect(Math.hypot(tangent.x, tangent.y)).toBeGreaterThan(0)

  const angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI
  const remainder = Math.abs(((angle % 45) + 45) % 45)
  expect(Math.min(remainder, 45 - remainder)).toBeLessThan(0.5)
  // The unconstrained drag would have produced ~21.8 degrees.
  expect(Math.abs(angle)).toBeLessThan(0.5)

  editor.canvas.assertNoErrors()
})

test('Vector point section controls handle mirroring in node edit mode', async () => {
  await editor.canvas.pressKey('v')
  await drawOpenTriangle(300, 100)
  await editor.canvas.click(300, 100)
  await editor.canvas.waitForRender()

  // Enter node edit mode on the closed triangle and select its first vertex.
  await editor.canvas.dblclick(350, 150)
  await editor.canvas.waitForRender()
  await editor.canvas.click(300, 100)
  await editor.canvas.waitForRender()

  const entered = await readNodeEditState()
  expect(entered).not.toBeNull()
  expect(entered?.selected.length).toBe(1)

  const pointSection = editor.page.locator('[data-property="vector-point-mirroring"]')
  await expect(pointSection).toBeVisible()
  await editor.page
    .locator('[data-property="vector-point-mirroring"]')
    .getByRole('button', { name: 'Smooth' })
    .click()
  await editor.canvas.waitForRender()

  const afterSmooth = await readNodeEditState()
  const selectedIndex = afterSmooth?.selected[0] ?? 0
  expect(afterSmooth?.mirroring[selectedIndex]).toBe('ANGLE_AND_LENGTH')

  // Exit node edit mode on Escape
  await editor.canvas.pressKey('Escape')
  await editor.canvas.waitForRender()
  expect(await readNodeEditState()).toBeNull()
  editor.canvas.assertNoErrors()
})

test('Pen closing works across different zoom levels (50% and 200%)', async () => {
  await editor.canvas.pressKey('v')
  await setZoom(2)

  // Draw 3 vertices at 200% zoom and close on start vertex
  await drawOpenTriangle(500, 100)
  await editor.canvas.click(500, 100)
  await editor.canvas.waitForRender()

  let children = await getPageChildren(editor.page)
  let vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors[vectors.length - 1].vectorNetwork?.segments.length).toBe(3)

  await setZoom(0.5)
  await drawOpenTriangle(700, 100)
  await editor.canvas.click(700, 100)
  await editor.canvas.waitForRender()

  children = await getPageChildren(editor.page)
  vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors[vectors.length - 1].vectorNetwork?.segments.length).toBe(3)

  await setZoom(1)
  editor.canvas.assertNoErrors()
})

test('Node edit by double-click: marquee two vertices, convert to Smooth, delete one, undo twice', async () => {
  await editor.canvas.pressKey('v')
  await drawOpenTriangle(300, 300, 120)
  await editor.canvas.click(300, 300)
  await editor.canvas.waitForRender()

  // Enter node edit mode through the real double-click affordance.
  await editor.canvas.dblclick(360, 360)
  await editor.canvas.waitForRender()
  const entered = await readNodeEditState()
  expect(entered).not.toBeNull()
  expect(entered?.vertexCount).toBe(3)
  const depthAfterEnter = await readUndoDepth()

  // Marquee across the two vertices on the top edge, from empty canvas space.
  const first = await vertexScreenPoint(0)
  const second = await vertexScreenPoint(1)
  await editor.canvas.marquee(
    Math.min(first.x, second.x) - 30,
    Math.min(first.y, second.y) - 30,
    Math.max(first.x, second.x) + 30,
    Math.min(first.y, second.y) + 20
  )

  const marqueed = await readNodeEditState()
  expect(marqueed?.selected.length).toBe(2)
  // A selection change mutates no geometry and must push no undo entry.
  expect(await readUndoDepth()).toBe(depthAfterEnter)

  await editor.page
    .locator('[data-property="vector-point-mirroring"]')
    .getByRole('button', { name: 'Smooth' })
    .click()
  await editor.canvas.waitForRender()

  const smoothed = await readNodeEditState()
  for (const index of smoothed?.selected ?? []) {
    expect(smoothed?.mirroring[index]).toBe('ANGLE_AND_LENGTH')
  }
  // One mirroring change across two vertices is exactly one undo entry.
  expect(await readUndoDepth()).toBe(depthAfterEnter + 1)

  // Delete one vertex: clicking a vertex outside the marquee selection replaces
  // it with that single vertex (clicking one already selected keeps the group).
  const third = await vertexScreenPoint(2)
  await editor.canvas.click(third.x, third.y)
  await editor.canvas.waitForRender()
  expect((await readNodeEditState())?.selected).toEqual([2])

  await editor.canvas.pressKey('Delete')
  await editor.canvas.waitForRender()
  expect((await readNodeEditState())?.vertexCount).toBe(2)
  expect(await readUndoDepth()).toBe(depthAfterEnter + 2)

  // Undo the deletion, then the mirroring conversion.
  await undo()
  expect((await readNodeEditState())?.vertexCount).toBe(3)

  await undo()
  const rolledBack = await readNodeEditState()
  // Pen-placed vertices carry no explicit mirroring until one is chosen.
  expect(rolledBack?.mirroring.every((m) => (m ?? 'NONE') === 'NONE')).toBe(true)
  expect(await readUndoDepth()).toBe(depthAfterEnter)

  await editor.canvas.pressKey('Escape')
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
})

test('Switching from Pen to Select with V exits stale node-edit state and deselects on blank click', async () => {
  await editor.canvas.pressKey('v')
  await drawOpenTriangle(300, 300, 120)
  await editor.canvas.click(300, 300)
  await editor.canvas.waitForRender()

  // Enter node edit mode while Pen is still the active tool - this is the
  // exact route (T-024 segment-gated insertion) that leaves nodeEditState
  // set going into a tool switch.
  await editor.canvas.dblclick(360, 360)
  await editor.canvas.waitForRender()
  expect(await readNodeEditState()).not.toBeNull()
  expect(await getSelectedIds(editor.page)).toBe(1)
  const depthBeforeLeave = await readUndoDepth()

  // Leave via the V shortcut, not Escape/Enter - this is the route that
  // used to leave nodeEditState stale.
  await editor.canvas.pressKey('v')
  await editor.canvas.waitForRender()
  expect(await readNodeEditState()).toBeNull()
  // Exiting node-edit mode with no vertex edits pushes no undo entry,
  // matching Escape's existing behaviour.
  expect(await readUndoDepth()).toBe(depthBeforeLeave)

  // Blank-canvas click must deselect exactly as a fresh Select tool does.
  await editor.canvas.click(700, 700)
  await editor.canvas.waitForRender()
  expect(await getSelectedIds(editor.page)).toBe(0)
  editor.canvas.assertNoErrors()
})

test('Idle Pen tool to Select with V still deselects on blank click', async () => {
  await editor.canvas.pressKey('v')
  await drawOpenTriangle(600, 600, 80)
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()
  expect(await getSelectedIds(editor.page)).toBe(1)

  // Pen commit already returns to Select with nothing in progress; go back
  // to Pen (idle - no penState, no nodeEditState) and then to Select again,
  // matching the packet's "idle Pen state" acceptance case.
  await editor.canvas.pressKey('p')
  await editor.canvas.pressKey('v')
  await editor.canvas.waitForRender()

  await editor.canvas.click(100, 100)
  await editor.canvas.waitForRender()
  expect(await getSelectedIds(editor.page)).toBe(0)
  editor.canvas.assertNoErrors()
})

test('Pen tool idle click on open endpoint resumes drawing that path', async () => {
  await editor.canvas.pressKey('v')
  await editor.canvas.pressKey('p')
  await editor.canvas.click(100, 100)
  await editor.canvas.waitForRender()
  await editor.canvas.click(200, 100)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  let children = await getPageChildren(editor.page)
  let vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBe(1)
  expect(vectors[0].vectorNetwork?.vertices.length).toBe(2)

  // Switch to SELECT and back to PEN to ensure pen is idle
  await editor.canvas.pressKey('v')
  await editor.canvas.pressKey('p')

  // Hover and click the open endpoint at (200, 100) to resume
  await editor.canvas.hover(200, 100)
  const hover = await readPenHover()
  expect(hover.intent).toBe('continue')

  await editor.canvas.click(200, 100)
  await editor.canvas.waitForRender()

  // Add third vertex and finish
  await editor.canvas.click(200, 200)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  children = await getPageChildren(editor.page)
  vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBe(1)
  expect(vectors[0].vectorNetwork?.vertices.length).toBe(3)
  expect(vectors[0].vectorNetwork?.segments.length).toBe(2)
  editor.canvas.assertNoErrors()
})

test('Pen tool links in-progress path to another open vector endpoint', async () => {
  await editor.canvas.pressKey('v')
  // First path: (400, 100) to (500, 100)
  await editor.canvas.pressKey('p')
  await editor.canvas.click(400, 100)
  await editor.canvas.waitForRender()
  await editor.canvas.click(500, 100)
  await editor.canvas.waitForRender()
  await editor.canvas.pressKey('Enter')
  await editor.canvas.waitForRender()

  let children = await getPageChildren(editor.page)
  expect(children.filter((n) => n.type === 'VECTOR').length).toBe(1)

  // Second path: start at (400, 250)
  await editor.canvas.pressKey('p')
  await editor.canvas.click(400, 250)
  await editor.canvas.waitForRender()

  // Hover over the first path's endpoint at (500, 100)
  await editor.canvas.hover(500, 100)
  const hover = await readPenHover()
  expect(hover.intent).toBe('continue')

  // Click to link the in-progress path to the first path
  await editor.canvas.click(500, 100)
  await editor.canvas.waitForRender()

  children = await getPageChildren(editor.page)
  const vectors = children.filter((n) => n.type === 'VECTOR')
  expect(vectors.length).toBe(1)
  expect(vectors[0].vectorNetwork?.vertices.length).toBe(3)
  expect(vectors[0].vectorNetwork?.segments.length).toBe(2)
  editor.canvas.assertNoErrors()
})
