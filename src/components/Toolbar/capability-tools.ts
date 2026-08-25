/**
 * Capability-filtered tool sets.
 *
 * NOTE / TRAP WARNING:
 * Do not import or use `CORE_TOOLS` or `EXTENDED_TOOLS` from `packages/core/src/tools/registry.ts`.
 * Those definitions belong to the AI/MCP agent tool registry (consumed by `src/app/ai/tools/index.ts`)
 * and have nothing to do with the canvas editor toolbar.
 *
 * The canvas tool set is derived dynamically from `EditorToolDef[]` (from `@open-pencil/core/editor`).
 */

import type { EditorToolDef, Tool } from '@open-pencil/core/editor'

/**
 * Builds the simplified tool set for "Simple" capability mode.
 *
 * Reduces the top-level tool strip to six entries:
 * 1. SELECT (plain button)
 * 2. FRAME (keeps full flyout: FRAME, SECTION, SLICE — protects T-027 FramePresetPopover)
 * 3. RECTANGLE (keeps full flyout: RECTANGLE, LINE, ELLIPSE, POLYGON, STAR)
 * 4. TEXT (plain button)
 * 5. HAND (plain button)
 * 6. PEN (collecting "More" flyout: PEN, PENCIL, BRUSH, SHAPE_BUILDER, BARCODE, BARCODE_EAN13)
 *
 * Every field (key, label, shortcut, flyout) is derived from the input array.
 */
export function simpleToolSet(tools: EditorToolDef[]): EditorToolDef[] {
  const selectDef = tools.find((t) => t.key === 'SELECT')
  const frameDef = tools.find((t) => t.key === 'FRAME')
  const rectDef = tools.find((t) => t.key === 'RECTANGLE')
  const textDef = tools.find((t) => t.key === 'TEXT')
  const handDef = tools.find((t) => t.key === 'HAND')
  const penDef = tools.find((t) => t.key === 'PEN')
  const shapeBuilderDef = tools.find((t) => t.key === 'SHAPE_BUILDER')
  const barcodeDef = tools.find((t) => t.key === 'BARCODE')

  const hiddenFlyout: Tool[] = []
  if (penDef) {
    hiddenFlyout.push(...(penDef.flyout ?? [penDef.key]))
  }
  if (shapeBuilderDef) {
    hiddenFlyout.push(...(shapeBuilderDef.flyout ?? [shapeBuilderDef.key]))
  }
  if (barcodeDef) {
    hiddenFlyout.push(...(barcodeDef.flyout ?? [barcodeDef.key]))
  }

  const result: EditorToolDef[] = []

  if (selectDef) {
    result.push({ ...selectDef })
  }
  if (frameDef) {
    result.push({ ...frameDef })
  }
  if (rectDef) {
    result.push({ ...rectDef })
  }
  if (textDef) {
    result.push({ ...textDef })
  }
  if (handDef) {
    result.push({ ...handDef })
  }
  if (penDef) {
    result.push({
      ...penDef,
      flyout: hiddenFlyout
    })
  }

  return result
}
