import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, ShallowRef } from 'vue'

import { IS_BROWSER } from '@/constants'
import { panelLayout } from '@/app/shell/panels/layout'
import { containerOf } from '@/app/shell/panels/containers'
import {
  isFloatId,
  PANEL_CANVAS_MIN_WIDTH,
  PANEL_DOCK_MIN_WIDTH,
  PANEL_IDS,
  type LegacyPanelId,
  type PanelId,
  type PanelRect
} from '@/app/shell/panels/types'

/**
 * Each panel is mounted once and teleported into whichever host is currently
 * rendering it — the splitter slot when docked, the overlay window when
 * floating. Teleporting keeps the component instance alive across the move, so
 * open tabs, scroll positions and chat streams survive docking and floating.
 */
export type HostKind = 'parking' | 'docked' | 'floating'

type HostRefs = Record<HostKind, ShallowRef<HTMLElement | null>>

const hosts: Record<PanelId, HostRefs> = Object.fromEntries(
  PANEL_IDS.map((id) => ({
    id,
    hosts: {
      parking: shallowRef<HTMLElement | null>(null),
      docked: shallowRef<HTMLElement | null>(null),
      floating: shallowRef<HTMLElement | null>(null)
    }
  })).map(({ id, hosts }) => [id, hosts])
) as Record<PanelId, HostRefs>

/** Overlay root; floating panel coordinates are relative to this element. */
export const panelOverlayEl = shallowRef<HTMLElement | null>(null)

export const panelOverlaySize = ref({ width: 0, height: 0 })

/**
 * Vue calls a template ref with `null` when an element unmounts, but the
 * replacement host may already have registered itself. Only clear the slot
 * when the element we are holding has actually left the document.
 */
export function setPanelHost(id: LegacyPanelId, kind: HostKind) {
  const registeredId = id === 'properties' ? 'appearance' : id
  return (el: Element | { $el?: unknown } | null) => {
    const slot = hosts[registeredId][kind]
    if (el instanceof HTMLElement) {
      slot.value = el
      return
    }
    if (slot.value && !slot.value.isConnected) slot.value = null
  }
}

export function panelHost(id: LegacyPanelId): ComputedRef<HTMLElement | null> {
  const registeredId = id === 'properties' ? 'appearance' : id
  return computed(() => {
    const container = containerOf(panelLayout.value, registeredId)
    let kind: HostKind = 'parking'
    if (container !== null) kind = isFloatId(container) ? 'floating' : 'docked'
    return hosts[registeredId][kind].value
  })
}

export function measurePanelOverlay(): { width: number; height: number } {
  const el = panelOverlayEl.value
  if (!el) return { width: 0, height: 0 }
  const rect = el.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

/** Converts a client rect (e.g. a docked panel) into overlay coordinates. */
export function toOverlayRect(rect: DOMRect): PanelRect {
  const el = panelOverlayEl.value
  const origin = el?.getBoundingClientRect()
  return {
    x: rect.left - (origin?.left ?? 0),
    y: rect.top - (origin?.top ?? 0),
    width: rect.width,
    height: rect.height
  }
}

export function resetPanelHosts(): void {
  for (const id of PANEL_IDS) {
    hosts[id].parking.value = null
    hosts[id].docked.value = null
    hosts[id].floating.value = null
  }
}

/**
 * Rendered dock width per side: 0 when that dock has no docked members (an
 * emptied dock gives its space to the canvas), otherwise the stored width -
 * proportionally reduced, floored at `PANEL_DOCK_MIN_WIDTH`, when both
 * stored widths together would leave less than `PANEL_CANVAS_MIN_WIDTH` of
 * canvas at the current viewport. The stored `dockWidths` values themselves
 * are never overwritten by this reduction; only the rendered width is.
 */
export const effectiveDockWidths: ComputedRef<{ left: number; right: number }> = computed(() => {
  const layout = panelLayout.value
  const raw = {
    left: layout.docks.left.length > 0 ? layout.dockWidths.left : 0,
    right: layout.docks.right.length > 0 ? layout.dockWidths.right : 0
  }
  const available = panelOverlaySize.value.width > 0 ? panelOverlaySize.value.width : (IS_BROWSER ? window.innerWidth : 0)
  if (available <= 0) return raw
  const shortfall = raw.left + raw.right + PANEL_CANVAS_MIN_WIDTH - available
  if (shortfall <= 0) return raw
  const reducible = Math.max(0, raw.left - PANEL_DOCK_MIN_WIDTH) + Math.max(0, raw.right - PANEL_DOCK_MIN_WIDTH)
  if (reducible <= 0) return raw
  const scale = Math.max(0, Math.min(1, 1 - shortfall / reducible))
  const shrink = (width: number): number =>
    width > PANEL_DOCK_MIN_WIDTH ? Math.max(PANEL_DOCK_MIN_WIDTH, Math.round(PANEL_DOCK_MIN_WIDTH + (width - PANEL_DOCK_MIN_WIDTH) * scale)) : width
  return { left: raw.left > 0 ? shrink(raw.left) : 0, right: raw.right > 0 ? shrink(raw.right) : 0 }
})
