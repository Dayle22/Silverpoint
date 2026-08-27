import type { PluginDataEntry, SceneGraph } from '@open-pencil/scene-graph'

export type DocumentUnit = 'px' | 'mm' | 'cm' | 'in'

export interface DocumentUnits {
  unit: DocumentUnit
  dpi: number
}

export const DEFAULT_DOCUMENT_UNITS: DocumentUnits = { unit: 'px', dpi: 300 }

export const DOCUMENT_UNITS_PLUGIN_ID = 'open-pencil'
export const DOCUMENT_UNITS_PLUGIN_KEY = 'documentUnits'

interface RawDocumentUnitsPayload {
  unit?: unknown
  dpi?: unknown
}

function isDocumentUnitsPayload(value: unknown): value is RawDocumentUnitsPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeDocumentUnits(raw: unknown): DocumentUnits {
  if (!isDocumentUnitsPayload(raw)) {
    return structuredClone(DEFAULT_DOCUMENT_UNITS)
  }
  const unit = raw.unit
  const dpi = raw.dpi
  const validUnit: DocumentUnit =
    unit === 'px' || unit === 'mm' || unit === 'cm' || unit === 'in'
      ? unit
      : DEFAULT_DOCUMENT_UNITS.unit
  let validDpi: number = DEFAULT_DOCUMENT_UNITS.dpi
  if (typeof dpi === 'number' && Number.isFinite(dpi)) {
    validDpi = Math.max(1, Math.min(2400, Math.round(dpi)))
  }
  return { unit: validUnit, dpi: validDpi }
}

export function parseDocumentUnits(pluginData?: PluginDataEntry[]): DocumentUnits {
  const entries = Array.isArray(pluginData) ? pluginData : []
  const entry = entries.find(
    (candidate) =>
      candidate.pluginId === DOCUMENT_UNITS_PLUGIN_ID &&
      candidate.key === DOCUMENT_UNITS_PLUGIN_KEY
  )
  if (!entry) return structuredClone(DEFAULT_DOCUMENT_UNITS)
  try {
    const value = JSON.parse(entry.value) as unknown
    return normalizeDocumentUnits(value)
  } catch {
    return structuredClone(DEFAULT_DOCUMENT_UNITS)
  }
}

export function upsertDocumentUnits(
  pluginData: PluginDataEntry[],
  units: DocumentUnits
): PluginDataEntry[] {
  const normalized = normalizeDocumentUnits(units)
  const preserved = pluginData.filter(
    (entry) =>
      !(
        entry.pluginId === DOCUMENT_UNITS_PLUGIN_ID &&
        entry.key === DOCUMENT_UNITS_PLUGIN_KEY
      )
  )
  return [
    ...structuredClone(preserved),
    {
      pluginId: DOCUMENT_UNITS_PLUGIN_ID,
      key: DOCUMENT_UNITS_PLUGIN_KEY,
      value: JSON.stringify(normalized)
    }
  ]
}

export function resolveEffectiveDpi(graph: SceneGraph, documentDpi?: number): number {
  if (documentDpi && documentDpi > 0) return documentDpi
  const firstPage = graph.getPages().at(0)
  return parseDocumentUnits(firstPage ? firstPage.pluginData : []).dpi || 300
}
