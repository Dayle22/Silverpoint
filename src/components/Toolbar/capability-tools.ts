import type { EditorToolDef } from '@open-pencil/core/editor'

/**
 * Derives a simplified 6-entry tool set for the Essential persona.
 * Specialized tools are grouped into flyouts to keep the primary strip minimal.
 */
export function essentialToolSet(tools: EditorToolDef[]): EditorToolDef[] {
  const byKey = new Map(tools.map((t) => [t.key, t]))
  const result: EditorToolDef[] = []

  const select = byKey.get('SELECT')
  if (select) result.push({ ...select })

  const frame = byKey.get('FRAME')
  if (frame) result.push({ ...frame })

  const rect = byKey.get('RECTANGLE')
  if (rect) result.push({ ...rect })

  const text = byKey.get('TEXT')
  if (text) result.push({ ...text })

  const hand = byKey.get('HAND')
  if (hand) result.push({ ...hand })

  const pen = byKey.get('PEN')
  if (pen) {
    result.push({
      ...pen,
      flyout: ['PEN', 'PENCIL', 'BRUSH', 'SHAPE_BUILDER', 'BARCODE', 'BARCODE_EAN13']
    })
  }

  return result
}

