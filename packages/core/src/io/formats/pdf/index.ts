import type { SceneGraph } from '@open-pencil/scene-graph'
import type { ExportTarget } from '../../types'

export { renderNodesToPDF } from './export'
export type { PDFExportOptions } from './export'

export async function importPDFPage(
  _data: Uint8Array,
  _page: number,
  _options?: { fileName?: string }
): Promise<{ graph: SceneGraph }> {
  throw new Error('PDF import not yet loaded')
}

export async function renderNodesToPrintPDF(
  _graph: SceneGraph,
  _target: ExportTarget,
  _options?: unknown,
  _context?: unknown
): Promise<{ data: Uint8Array } | null> {
  throw new Error('PDF print export not yet loaded')
}
