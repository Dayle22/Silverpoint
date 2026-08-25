import { readonly, ref, shallowRef } from 'vue'

import { measurePanelOverlay, panelOverlayEl, toOverlayRect } from '@/app/shell/panels/hosts'
import {
  clampRectToOverlay,
  containerGroups,
  floatContainer,
  floatGroup,
  floatPanel,
  moveGroup,
  movePanel,
  panelLayout,
  raiseFloat,
  setFloatRect,
  writePanelLayout
} from '@/app/shell/panels/layout'
import { resolveDropTarget, type ContainerGeometry, type DropTarget, type GroupGeometry } from '@/app/shell/panels/drop-target'
import { snapPanelRect, type SnapGuide } from '@/app/shell/panels/snap'
import {
  isFloatId,
  type ContainerId,
  type FloatId,
  type PanelId,
  type PanelLayout,
  type PanelRect
} from '@/app/shell/panels/types'

export type { ContainerId, DockSide } from '@/app/shell/panels/types'

/** Pointer travel before a press on a title bar or window frame becomes a drag. */
const DRAG_START_THRESHOLD = 4

const draggingId = shallowRef<PanelId | null>(null)
const draggingContainerId = shallowRef<ContainerId | null>(null)
const draggingGroupContainerId = shallowRef<ContainerId | null>(null)
const snapGuides = ref<SnapGuide[]>([])
const insertionTarget = ref<DropTarget | null>(null)

export const panelDraggingId = readonly(draggingId)
/** The container currently being dragged - the panel's own container while dragging a title bar, or the container itself while dragging a window frame. Drives which container should visually raise/highlight during a drag. */
export const draggingContainer = readonly(draggingContainerId)
export const panelDraggingGroupContainer = readonly(draggingGroupContainerId)
export const panelSnapGuides = readonly(snapGuides)
export const panelInsertionTarget = readonly(insertionTarget)

export function setPanelInsertionTarget(container: ContainerId, index: number): void {
  insertionTarget.value = { kind: 'group', container, groupIndex: index }
}
export function clearPanelInsertionTarget(): void {
  insertionTarget.value = null
}

function otherFloatRects(excludeId: ContainerId): PanelRect[] {
  return panelLayout.value.floats
    .filter((float) => float.id !== excludeId)
    .map((float) => ({ x: float.x, y: float.y, width: float.width, height: float.height }))
}

/**
 * Reads live container geometry out of the document: every
 * `[data-container-id]` element's own rect, plus each direct rendered
 * group (`[data-group-index]`), its rect, and its horizontal tab midpoints
 * (`[data-tab-id]`), with the dragged panel excluded so the result is
 * already a post-removal index space. Pure `resolveDropTarget()` in
 * drop-target.ts does the actual resolution; this is only the DOM-reading half.
 *
 * Floats are listed before docks, sorted by descending z (topmost first),
 * matching `resolveDropTarget()`'s documented precedence: a floating window
 * renders above the docks and can be dragged to overlap them, so whichever
 * container the user actually sees under the pointer should win.
 *
 * `excludeContainerId` must be the dragged panel's OWN just-created float
 * (see `liftedFloatId` in `startPanelDrag`), skipped entirely - not merely
 * excluded from its midpoints. That float visually tracks the pointer for
 * the whole drag, so without this a panel would resolve itself as a drop
 * target (and silently re-detach into a fresh standalone float on release)
 * for the entire gesture, not just the first frame.
 */
function containerGeometries(excludeId: PanelId, excludeContainerId: ContainerId | null): ContainerGeometry[] {
  const result: ContainerGeometry[] = []

  const floatsByZDesc = [...panelLayout.value.floats].sort((a, b) => b.z - a.z)
  for (const float of floatsByZDesc) {
    if (float.id === excludeContainerId) continue
    const el = document.querySelector<HTMLElement>(`[data-container-id="${float.id}"]`)
    if (!el) continue
    result.push(readContainerGeometry(el, float.id, excludeId))
  }
  for (const side of ['left', 'right'] as const) {
    const el = document.querySelector<HTMLElement>(`[data-container-id="${side}"]`)
    if (!el) continue
    result.push(readContainerGeometry(el, side, excludeId))
  }

  return result
}

function readContainerGeometry(containerEl: HTMLElement, id: ContainerId, excludeId: PanelId): ContainerGeometry {
  const rect = containerEl.getBoundingClientRect()
  const groups: GroupGeometry[] = []
  for (const groupEl of containerEl.querySelectorAll<HTMLElement>('[data-group-index]')) {
    const groupRect = groupEl.getBoundingClientRect()
    const tabMidpointsX: number[] = []
    for (const tab of groupEl.querySelectorAll<HTMLElement>('[data-tab-id]')) {
      if (tab.dataset.tabId === excludeId) continue
      const tabRect = tab.getBoundingClientRect()
      tabMidpointsX.push(tabRect.left + tabRect.width / 2)
    }
    groups.push({
      rect: { left: groupRect.left, top: groupRect.top, right: groupRect.right, bottom: groupRect.bottom },
      tabMidpointsX
    })
  }
  return { id, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, groups }
}

function isInteractiveTarget(target: EventTarget | null, handle?: HTMLElement): boolean {
  if (!(target instanceof Element)) return false
  const interactive = target.closest('button, a, input, [role="button"]')
  return interactive !== null && interactive !== handle
}

/**
 * Drives a title-bar drag for ONE member panel. Pressing a title bar and
 * moving past the threshold detaches only that panel (`floatPanel`)
 * from wherever it currently sits - a dock or an existing float stack, alone
 * or with siblings - into a brand new single-member float positioned at the
 * panel's own measured DOM rect. The source container keeps its remaining
 * members and rebalances; a source stack member 2 of 3 leaves a valid
 * 2-member stack behind, never the whole stack.
 *
 * The resolved drop target is the single source of truth for both the
 * on-screen indicator (drawn from `panelInsertionTarget`) and the commit on
 * release - there is no separate decorative highlight. A resolved target
 * always wins over floating-to-floating snap, Alt or not: Alt disables only
 * that snap, never docking/merging.
 */
function measureInitialDragBounds(handle: HTMLElement, id: PanelId): { startRect: PanelRect | null; startWidth: number; startHeight: number } {
  const panelEl = handle.closest('[data-panel-id]') ?? handle.parentElement
  const startRect = panelEl instanceof HTMLElement ? toOverlayRect(panelEl.getBoundingClientRect()) : null
  const startWidth = startRect?.width ?? 280
  const fallbackHeight = panelLayout.value.panels[id]?.floatFallback?.height ?? 560
  const isFromDock =
    panelLayout.value.panels[id]?.container === 'left' ||
    panelLayout.value.panels[id]?.container === 'right'
  const startHeight = isFromDock ? fallbackHeight : (startRect?.height ?? fallbackHeight)
  return { startRect, startWidth, startHeight }
}

function computeDragStep(
  moveEvent: PointerEvent,
  liftedFloatId: FloatId,
  id: PanelId,
  grabX: number,
  grabY: number,
  overlay: { width: number; height: number },
  allowTab = true
): { proposed: PanelRect; target: DropTarget | null } {
  const origin = panelOverlayEl.value?.getBoundingClientRect()
  const current = floatContainer(liftedFloatId)
  if (!current) return { proposed: { x: 0, y: 0, width: 280, height: 200 }, target: null }
  const pointerX = moveEvent.clientX - (origin?.left ?? 0)
  const pointerY = moveEvent.clientY - (origin?.top ?? 0)

  const proposed: PanelRect = {
    x: pointerX - grabX,
    y: pointerY - grabY,
    width: current.width,
    height: current.height
  }

  const overlayClientLeft = origin?.left ?? 0
  const overlayClientRight = origin ? origin.left + origin.width : overlay.width
  const target = resolveDropTarget(
    { x: moveEvent.clientX, y: moveEvent.clientY },
    containerGeometries(id, liftedFloatId),
    { left: overlayClientLeft, right: overlayClientRight },
    { allowTab }
  )
  return { proposed, target }
}

export function startPanelDrag(id: PanelId, event: PointerEvent): void {
  if (event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  const handle: HTMLElement = event.currentTarget
  if (isInteractiveTarget(event.target, handle)) return
  event.stopPropagation()

  const beforeLayout: PanelLayout = structuredClone(panelLayout.value)
  const startClientX = event.clientX
  const startClientY = event.clientY
  const { startRect, startWidth, startHeight } = measureInitialDragBounds(handle, id)

  const origin = panelOverlayEl.value?.getBoundingClientRect()
  let grabX = startRect ? startClientX - (origin?.left ?? 0) - startRect.x : 0
  let grabY = startRect ? startClientY - (origin?.top ?? 0) - startRect.y : 0

  let active = false
  let liftedFloatId: FloatId | null = null
  let frame = 0
  let latest: PointerEvent | null = null
  const overlay = measurePanelOverlay()

  function apply(moveEvent: PointerEvent): void {
    if (!liftedFloatId) return
    const { proposed, target } = computeDragStep(moveEvent, liftedFloatId, id, grabX, grabY, overlay)
    const snapped = snapPanelRect(proposed, otherFloatRects(liftedFloatId), overlay, {
      enabled: !moveEvent.altKey && target === null
    })
    snapGuides.value = snapped.guides
    const clamped = clampRectToOverlay({ ...proposed, x: snapped.x, y: snapped.y }, overlay)
    setFloatRect(liftedFloatId, { x: clamped.x, y: clamped.y })
    insertionTarget.value = target
  }

  function schedule(): void {
    if (frame !== 0 || !latest) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const event = latest
      if (!event) return
      latest = null
      apply(event)
    })
  }

  function onMove(moveEvent: PointerEvent): void {
    if (!active) {
      const travelled = Math.hypot(
        moveEvent.clientX - startClientX,
        moveEvent.clientY - startClientY
      )
      if (travelled < DRAG_START_THRESHOLD) return
      active = true
      draggingId.value = id

      // Detach exactly this panel into a brand new float, lifted from
      // exactly where it already sits - whether that was a dock or an
      // existing (possibly multi-member) float stack.
      const lifted = startRect
        ? clampRectToOverlay(
            { x: startRect.x, y: startRect.y, width: startWidth, height: startHeight },
            overlay
          )
        : clampRectToOverlay({ x: 0, y: 0, width: startWidth, height: startHeight }, overlay)
      grabX = Math.min(grabX, lifted.width - 8)
      grabY = Math.min(grabY, lifted.height - 8)
      floatPanel(id, lifted)
      liftedFloatId = panelLayout.value.floats.find((float) => float.members.includes(id))?.id ?? null
      draggingContainerId.value = liftedFloatId
    }

    latest = moveEvent
    schedule()
  }

  function finish(cancelled: boolean): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (latest) {
      apply(latest)
      latest = null
    }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeydown, true)
    handle.releasePointerCapture(event.pointerId)

    const target = insertionTarget.value
    draggingId.value = null
    draggingContainerId.value = null
    snapGuides.value = []
    clearPanelInsertionTarget()

    if (cancelled) {
      writePanelLayout(beforeLayout)
      return
    }

    if (active && target !== null) {
      movePanel(id, target)
    }
  }

  function onUp(): void {
    finish(false)
  }

  function onCancel(): void {
    finish(true)
  }

  function onKeydown(keyEvent: KeyboardEvent): void {
    if (keyEvent.key !== 'Escape') return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    finish(true)
  }

  handle.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeydown, true)
}

/**
 * Drives a drag of an ENTIRE panel group from the empty area of its tab
 * strip - never a tab button, never a group control, never a float
 * title bar (those remain `startPanelDrag`/`startContainerDrag`
 * respectively). On first movement past the threshold, lifts the whole
 * group intact into a brand new float via `floatGroup()` (same lift
 * primitive `startPanelDrag` uses via `floatPanel()` for one panel),
 * then resolves every frame with `{ allowTab: false }` so only
 * `kind: 'group'` targets are ever shown or committed - a group drag
 * can never produce or land on a tab ring/caret.
 */
export function startGroupDrag(container: ContainerId, groupIndex: number, event: PointerEvent): void {
  if (event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  const handle: HTMLElement = event.currentTarget
  if (isInteractiveTarget(event.target, handle)) return
  event.stopPropagation()

  const beforeLayout: PanelLayout = structuredClone(panelLayout.value)
  const startClientX = event.clientX
  const startClientY = event.clientY

  const sectionEl = handle.closest<HTMLElement>('[data-group-index]')
  const startRect = sectionEl instanceof HTMLElement ? toOverlayRect(sectionEl.getBoundingClientRect()) : null
  const startWidth = startRect?.width ?? 280
  const startHeight = startRect?.height ?? 200

  const origin = panelOverlayEl.value?.getBoundingClientRect()
  let grabX = startRect ? startClientX - (origin?.left ?? 0) - startRect.x : 0
  let grabY = startRect ? startClientY - (origin?.top ?? 0) - startRect.y : 0

  let active = false
  let liftedFloatId: FloatId | null = null
  let firstMember: PanelId | null = null
  let frame = 0
  let latest: PointerEvent | null = null
  const overlay = measurePanelOverlay()

  function apply(moveEvent: PointerEvent): void {
    if (!liftedFloatId || !firstMember) return
    const { proposed, target } = computeDragStep(moveEvent, liftedFloatId, firstMember, grabX, grabY, overlay, false)
    const snapped = snapPanelRect(proposed, otherFloatRects(liftedFloatId), overlay, {
      enabled: !moveEvent.altKey && target === null
    })
    snapGuides.value = snapped.guides
    const clamped = clampRectToOverlay({ ...proposed, x: snapped.x, y: snapped.y }, overlay)
    setFloatRect(liftedFloatId, { x: clamped.x, y: clamped.y })
    insertionTarget.value = target
  }

  function schedule(): void {
    if (frame !== 0 || !latest) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const event = latest
      if (!event) return
      latest = null
      apply(event)
    })
  }

  function onMove(moveEvent: PointerEvent): void {
    if (!active) {
      const travelled = Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY)
      if (travelled < DRAG_START_THRESHOLD) return
      active = true

      const currentGroups = containerGroups(container)
      if (groupIndex < 0 || groupIndex >= currentGroups.length) return
      const group = currentGroups[groupIndex]
      firstMember = group.members[0]

      const lifted = startRect
        ? clampRectToOverlay({ x: startRect.x, y: startRect.y, width: startWidth, height: startHeight }, overlay)
        : clampRectToOverlay({ x: 0, y: 0, width: startWidth, height: startHeight }, overlay)
      grabX = Math.min(grabX, lifted.width - 8)
      grabY = Math.min(grabY, lifted.height - 8)
      floatGroup(container, groupIndex, lifted)
      const afterContainer = panelLayout.value.panels[firstMember]?.container ?? null
      liftedFloatId = afterContainer && isFloatId(afterContainer) ? afterContainer : null
      draggingGroupContainerId.value = liftedFloatId
      draggingContainerId.value = liftedFloatId
    }

    latest = moveEvent
    schedule()
  }

  function finish(cancelled: boolean): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (latest) {
      apply(latest)
      latest = null
    }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeydown, true)
    handle.releasePointerCapture(event.pointerId)

    const target = insertionTarget.value
    draggingGroupContainerId.value = null
    draggingContainerId.value = null
    snapGuides.value = []
    clearPanelInsertionTarget()

    if (cancelled) {
      writePanelLayout(beforeLayout)
      return
    }

    if (active && liftedFloatId && target?.kind === 'group') {
      moveGroup(liftedFloatId, 0, target)
    }
  }

  function onUp(): void {
    finish(false)
  }

  function onCancel(): void {
    finish(true)
  }

  function onKeydown(keyEvent: KeyboardEvent): void {
    if (keyEvent.key !== 'Escape') return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    finish(true)
  }

  handle.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeydown, true)
}

/**
 * Drags a float container's own frame (its border or the empty area outside
 * every member's title bar, never a member title bar itself) - moves the
 * whole stack as a unit via `setFloatRect`. No member detaches, and there is
 * no drop targeting: a container is never dropped "into" another container,
 * only individual panels are.
 */
export function startContainerDrag(id: FloatId, event: PointerEvent): void {
  if (event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  const handle: HTMLElement = event.currentTarget
  if (isInteractiveTarget(event.target, handle)) return

  const initial = floatContainer(id)
  if (!initial) return
  // Captured as a plain PanelRect (not the live FloatContainer reference) so
  // the nested apply() closure below keeps a definite, non-optional type.
  const start: PanelRect = { x: initial.x, y: initial.y, width: initial.width, height: initial.height }
  const startX = event.clientX
  const startY = event.clientY
  const beforeLayout: PanelLayout = structuredClone(panelLayout.value)

  raiseFloat(id)
  const activeId = panelLayout.value.floats.at(-1)?.id ?? id
  draggingContainerId.value = activeId
  const overlay = measurePanelOverlay()

  let frame = 0
  let latest: PointerEvent | null = null

  function apply(moveEvent: PointerEvent): void {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY
    const proposed: PanelRect = { x: start.x + deltaX, y: start.y + deltaY, width: start.width, height: start.height }
    const snapped = snapPanelRect(proposed, otherFloatRects(activeId), overlay, { enabled: !moveEvent.altKey })
    snapGuides.value = snapped.guides
    const clamped = clampRectToOverlay({ ...proposed, x: snapped.x, y: snapped.y }, overlay)
    setFloatRect(activeId, { x: clamped.x, y: clamped.y })
  }

  function schedule(): void {
    if (frame !== 0 || !latest) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const event = latest
      if (!event) return
      latest = null
      apply(event)
    })
  }

  function onMove(moveEvent: PointerEvent): void {
    latest = moveEvent
    schedule()
  }

  function finish(cancelled: boolean): void {
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (latest) {
      apply(latest)
      latest = null
    }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeydown, true)
    handle.releasePointerCapture(event.pointerId)
    draggingContainerId.value = null
    snapGuides.value = []
    if (cancelled) writePanelLayout(beforeLayout)
  }

  function onUp(): void {
    finish(false)
  }

  function onCancel(): void {
    finish(true)
  }

  function onKeydown(keyEvent: KeyboardEvent): void {
    if (keyEvent.key !== 'Escape') return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    finish(true)
  }

  handle.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeydown, true)
}

/** Keyboard equivalent of dragging a window frame, for a focused title bar - nudges the panel's whole container. */
export function nudgePanel(id: PanelId, dx: number, dy: number): void {
  const container = panelLayout.value.panels[id].container
  if (container === 'left' || container === 'right') return
  const current = floatContainer(container)
  if (!current) return
  const overlay = measurePanelOverlay()
  const clamped = clampRectToOverlay({ ...current, x: current.x + dx, y: current.y + dy }, overlay)
  setFloatRect(container, { x: clamped.x, y: clamped.y })
}
