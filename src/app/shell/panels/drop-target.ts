/**
 * Pure geometric resolution of where a dragged panel would land (T-031b,
 * generalised to containers in T-031c).
 *
 * Deliberately DOM-free so it is unit-testable without a browser: `drag.ts`
 * reads live rects out of the document and hands them here as plain data.
 * The returned target is the same object that must be committed on release
 * - there is no separate "decorative" highlight anywhere in the app.
 */

import type { Vector } from '@open-pencil/scene-graph/primitives'

import { PANEL_SEAM_ZONE, type ContainerId, type DockSide } from '@/app/shell/panels/types'

/** Distance from the overlay's left/right edge that still counts as a dock target when the pointer is over open canvas rather than a dock aside (e.g. an emptied dock collapsed to zero width). */
export const PANEL_EDGE_DOCK_WIDTH = 96

export type DropTarget =
  | { kind: 'tab'; container: ContainerId; groupIndex: number; tabIndex: number }
  | { kind: 'group'; container: ContainerId; groupIndex: number }

export interface GroupGeometry {
  rect: { left: number; top: number; right: number; bottom: number }
  /** Horizontal tab-button midpoints in order, excluding the dragged panel's tab. */
  tabMidpointsX: number[]
}

export interface ContainerGeometry {
  id: ContainerId
  rect: { left: number; top: number; right: number; bottom: number }
  groups: GroupGeometry[]
}

/**
 * Returns the count of midpoints strictly less than the pointer coordinate:
 * 0 before the first item, `midpoints.length` after the last, and the
 * seam index anywhere in between. Reused across both axes (Y for group
 * vertical midpoints, X for tab horizontal midpoints).
 */
export function resolveDropIndex(pointerCoord: number, midpoints: number[]): number {
  let index = 0
  for (const midpoint of midpoints) {
    if (midpoint < pointerCoord) index++
  }
  return index
}

function containsPoint(
  rect: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number
): boolean {
  if (rect.right <= rect.left || rect.bottom <= rect.top) return false
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

/**
 * Resolves the single drop target for the current pointer position, in this
 * exact order:
 *
 * 1. A container whose rect contains the pointer wins. Callers must pass
 *    `containers` with float windows ordered before docks, floats sorted by
 *    DESCENDING z (topmost first).
 * 2. In a contained group of height at least 56 px, distances <= 28 from
 *    the top/bottom resolve to seam i/i+1; 29 px enters the body.
 * 3. A contained body with allowTab: true resolves tabIndex via resolveDropIndex.
 * 4. With allowTab: false, a body resolves to the nearer seam; an exact midpoint
 *    tie goes upward.
 * 5. A group shorter than 56 px is entirely seam-only, split at its midpoint;
 *    equality goes upward.
 * 6. Container whitespace uses resolveDropIndex(pointer.y, group vertical midpoints);
 *    empty container -> index 0.
 * 7. If no container contains the pointer, a present left/right dock within
 *    the existing 96 px edge band resolves to a group append at groups.length;
 *    floats never participate.
 * 8. Otherwise return null.
 */
export function resolveDropTarget(
  pointer: Vector,
  containers: ContainerGeometry[],
  overlay: { left: number; right: number },
  options: { allowTab: boolean } = { allowTab: true }
): DropTarget | null {
  for (const container of containers) {
    if (!containsPoint(container.rect, pointer.x, pointer.y)) continue

    for (let i = 0; i < container.groups.length; i++) {
      const group = container.groups[i]
      if (!containsPoint(group.rect, pointer.x, pointer.y)) continue

      const height = group.rect.bottom - group.rect.top
      if (height >= 56) {
        const distFromTop = pointer.y - group.rect.top
        const distFromBottom = group.rect.bottom - pointer.y
        if (distFromTop <= PANEL_SEAM_ZONE) {
          return { kind: 'group', container: container.id, groupIndex: i }
        }
        if (distFromBottom <= PANEL_SEAM_ZONE) {
          return { kind: 'group', container: container.id, groupIndex: i + 1 }
        }
        if (options.allowTab) {
          return {
            kind: 'tab',
            container: container.id,
            groupIndex: i,
            tabIndex: resolveDropIndex(pointer.x, group.tabMidpointsX)
          }
        }
        const midY = group.rect.top + height / 2
        return {
          kind: 'group',
          container: container.id,
          groupIndex: pointer.y <= midY ? i : i + 1
        }
      }

      const midY = group.rect.top + height / 2
      return {
        kind: 'group',
        container: container.id,
        groupIndex: pointer.y <= midY ? i : i + 1
      }
    }

    const midpointsY = container.groups.map((g) => g.rect.top + (g.rect.bottom - g.rect.top) / 2)
    return {
      kind: 'group',
      container: container.id,
      groupIndex: resolveDropIndex(pointer.y, midpointsY)
    }
  }

  const left = containers.find((entry) => entry.id === 'left')
  const right = containers.find((entry) => entry.id === 'right')

  if (left && pointer.x <= overlay.left + PANEL_EDGE_DOCK_WIDTH) {
    return { kind: 'group', container: 'left', groupIndex: left.groups.length }
  }
  if (right && pointer.x >= overlay.right - PANEL_EDGE_DOCK_WIDTH) {
    return { kind: 'group', container: 'right', groupIndex: right.groups.length }
  }

  return null
}

export type { DockSide }
