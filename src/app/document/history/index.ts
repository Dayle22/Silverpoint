import { exportFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  readCacheBytes,
  readCacheJson,
  removeCacheEntry,
  writeCacheBytes,
  writeCacheJson
} from '@/app/cache'

export interface HistorySnapshotEntry {
  timestamp: number
  label: 'save' | 'autosave'
  sizeBytes: number
  fileKey: string
}

const HISTORY_MAX_SNAPSHOTS = 50
const AUTOSAVE_GATE_MS = 5 * 60 * 1000 // 5 minutes

function manifestKey(docKey: string): string {
  return `history/${docKey}/manifest.json`
}

export async function getHistoryManifest(docKey: string): Promise<HistorySnapshotEntry[]> {
  const items = await readCacheJson<HistorySnapshotEntry[]>(manifestKey(docKey))
  return Array.isArray(items) ? items : []
}

/**
 * Persists a full .fig snapshot to the local AppLocalData cache.
 * For autosaves, a 5-minute debounce gate applies against the newest stored snapshot.
 * Snapshots are capped at 50 per document, oldest entries are evicted from cache.
 */
export async function addHistorySnapshot(
  docKey: string,
  graph: SceneGraph,
  label: 'save' | 'autosave' = 'save'
): Promise<void> {
  if (!docKey) return

  try {
    const list = await getHistoryManifest(docKey)

    // Autosave 5-minute time gate: check the newest entry
    if (label === 'autosave' && list.length > 0) {
      const latest = list[list.length - 1]
      if (Date.now() - latest.timestamp < AUTOSAVE_GATE_MS) {
        return
      }
    }

    const bytes = await exportFigFile(graph)
    const timestamp = Date.now()
    const fileKey = `history/${docKey}/${timestamp}.fig`

    await writeCacheBytes(fileKey, bytes.buffer as ArrayBuffer)

    const entry: HistorySnapshotEntry = {
      timestamp,
      label,
      sizeBytes: bytes.byteLength,
      fileKey
    }

    list.push(entry)

    // Enforce 50 snapshot maximum retention policy
    if (list.length > HISTORY_MAX_SNAPSHOTS) {
      const excess = list.length - HISTORY_MAX_SNAPSHOTS
      const removed = list.splice(0, excess)
      for (const item of removed) {
        if (item.fileKey) {
          void removeCacheEntry(item.fileKey)
        }
      }
    }

    await writeCacheJson(manifestKey(docKey), list)
  } catch (err) {
    console.warn('[History] Failed to add document history snapshot:', err)
  }
}

export async function readHistorySnapshotGraph(fileKey: string): Promise<SceneGraph | null> {
  try {
    const bytes = await readCacheBytes(fileKey)
    if (!bytes || bytes.byteLength === 0) return null

    const file = new File([bytes], 'snapshot.fig', { type: 'application/octet-stream' })
    return await readFigFile(file, { populate: 'first-page' })
  } catch (err) {
    console.warn(`[History] Failed to parse history snapshot ${fileKey}:`, err)
    return null
  }
}

export async function clearHistory(docKey: string): Promise<void> {
  try {
    const list = await getHistoryManifest(docKey)
    for (const item of list) {
      if (item.fileKey) {
        await removeCacheEntry(item.fileKey)
      }
    }
    await removeCacheEntry(manifestKey(docKey))
  } catch (err) {
    console.warn(`[History] Failed to clear history for ${docKey}:`, err)
  }
}
