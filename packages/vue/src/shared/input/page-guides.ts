import type { PageGuide, PageGuideAxis } from '@open-pencil/core/editor'

export function getPageGuideAxisFromRuler(
  sx: number,
  sy: number,
  rulerSize: number
): PageGuideAxis | null {
  if (sy >= 0 && sy < rulerSize && sx >= rulerSize) return 'Y'
  if (sx >= 0 && sx < rulerSize && sy >= rulerSize) return 'X'
  return null
}

export function getPageGuideOffset(
  axis: PageGuideAxis,
  sx: number,
  sy: number,
  pan: number,
  zoom: number
): number {
  return (axis === 'X' ? sx - pan : sy - pan) / zoom
}

export function findPageGuideAtScreenPoint(
  guides: PageGuide[],
  axis: PageGuideAxis,
  sx: number,
  sy: number,
  panX: number,
  panY: number,
  zoom: number,
  hitRadius = 6
): number | null {
  const screenOffset = axis === 'X' ? sx : sy
  const pan = axis === 'X' ? panX : panY
  return (
    guides
      .map((guide, index) => ({
        index,
        axis: guide.axis,
        distance: Math.abs(guide.offset * zoom + pan - screenOffset)
      }))
      .filter((candidate) => candidate.axis === axis && candidate.distance <= hitRadius)
      .sort((a, b) => a.distance - b.distance)[0]?.index ?? null
  )
}
