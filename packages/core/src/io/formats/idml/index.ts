import type { SceneGraph } from '@open-pencil/scene-graph'
import type { ExportTarget } from '../../types'

export async function importIdml(
  _data: Uint8Array,
  _options?: { fileName?: string }
): Promise<{ graph: SceneGraph }> {
  throw new Error('IDML import not yet loaded')
}

export async function renderNodesToIdml(
  _graph: SceneGraph,
  _target: ExportTarget,
  _options?: unknown,
  _context?: unknown
): Promise<{ data: Uint8Array }> {
  throw new Error('IDML export not yet loaded')
}
