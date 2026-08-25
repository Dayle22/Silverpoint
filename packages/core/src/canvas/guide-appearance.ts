export interface GuideAppearanceStyle {
  color: string
  opacity: number
}

export interface CanvasGuideAppearance {
  pageGuides: GuideAppearanceStyle
  margins: GuideAppearanceStyle
  bleed: GuideAppearanceStyle
}

export const DEFAULT_CANVAS_GUIDE_APPEARANCE: CanvasGuideAppearance = {
  pageGuides: { color: '#3B82F5', opacity: 0.65 },
  margins: { color: '#00BFFF', opacity: 0.9 },
  bleed: { color: '#FF3333', opacity: 0.9 }
}

function normaliseStyle(value: unknown, fallback: GuideAppearanceStyle): GuideAppearanceStyle {
  const record = value && typeof value === 'object' ? (value as Partial<GuideAppearanceStyle>) : {}
  const color = typeof record.color === 'string' && /^#[0-9a-f]{6}$/i.test(record.color)
    ? record.color.toUpperCase()
    : fallback.color
  const opacity = typeof record.opacity === 'number' && Number.isFinite(record.opacity)
    ? Math.min(1, Math.max(0.05, record.opacity))
    : fallback.opacity
  return { color, opacity }
}

export function normalizeCanvasGuideAppearance(value: unknown): CanvasGuideAppearance {
  const record = value && typeof value === 'object' ? (value as Partial<CanvasGuideAppearance>) : {}
  return {
    pageGuides: normaliseStyle(record.pageGuides, DEFAULT_CANVAS_GUIDE_APPEARANCE.pageGuides),
    margins: normaliseStyle(record.margins, DEFAULT_CANVAS_GUIDE_APPEARANCE.margins),
    bleed: normaliseStyle(record.bleed, DEFAULT_CANVAS_GUIDE_APPEARANCE.bleed)
  }
}
