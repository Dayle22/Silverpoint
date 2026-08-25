import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  readCacheJson,
  writeCacheJson,
  writeCacheBytes,
  readCacheBytes,
  removeCacheEntry
} from '@/app/cache'

export interface RecoveryTabManifestEntry {
  tabId: string
  name: string
  path: string | null
  fileKey: string
  updatedAt: number
}

const RECOVERY_MANIFEST_KEY = 'recovery/recovery-manifest.json'

export async function getRecoveryManifest(): Promise<RecoveryTabManifestEntry[]> {
  const items = await readCacheJson<RecoveryTabManifestEntry[]>(RECOVERY_MANIFEST_KEY)
  return Array.isArray(items) ? items : []
}

export async function saveTabRecovery(
  tabId: string,
  graph: SceneGraph,
  name: string,
  path: string | null
): Promise<void> {
  try {
    const bytes = await exportFigFile(graph)
    const fileKey = `recovery/recovery_${tabId}.fig`
    await writeCacheBytes(fileKey, bytes.buffer as ArrayBuffer)

    const list = await getRecoveryManifest()
    const idx = list.findIndex((item) => item.tabId === tabId)

    const entry: RecoveryTabManifestEntry = {
      tabId,
      name: name || 'Untitled',
      path,
      fileKey,
      updatedAt: Date.now()
    }

    if (idx !== -1) {
      list[idx] = entry
    } else {
      list.push(entry)
    }

    await writeCacheJson(RECOVERY_MANIFEST_KEY, list)
  } catch (err) {
    console.warn('[Recovery] Failed to save tab recovery:', err)
  }
}

export async function clearTabRecovery(tabId: string): Promise<void> {
  try {
    const list = await getRecoveryManifest()
    const idx = list.findIndex((item) => item.tabId === tabId)
    if (idx !== -1) {
      const [removed] = list.splice(idx, 1)
      if (removed.fileKey) {
        await removeCacheEntry(removed.fileKey)
      }
      await writeCacheJson(RECOVERY_MANIFEST_KEY, list)
    }
  } catch (err) {
    console.warn('[Recovery] Failed to clear tab recovery:', err)
  }
}

export async function clearAllRecovery(): Promise<void> {
  const list = await getRecoveryManifest()
  for (const item of list) {
    if (item.fileKey) {
      await removeCacheEntry(item.fileKey)
    }
  }
  await writeCacheJson(RECOVERY_MANIFEST_KEY, [])
}

/**
 * Restores any tabs saved by the autosave/recovery cache from a previous
 * session. Returns the names of the documents that were actually restored
 * (empty array if none) so the caller can tell the user what came back,
 * rather than a bare boolean.
 */
export async function restoreRecoverySession(
  openFileFn: (file: File, handle?: FileSystemFileHandle, path?: string) => Promise<void>,
  setTabNameFn?: (name: string) => void
): Promise<string[]> {
  const list = await getRecoveryManifest()
  if (list.length === 0) return []

  const restoredNames: string[] = []

  for (const entry of list) {
    try {
      const bytes = await readCacheBytes(entry.fileKey)
      if (bytes && bytes.byteLength > 0) {
        const file = new File([bytes], `${entry.name}.fig`, { type: 'application/octet-stream' })
        await openFileFn(file, undefined, entry.path ?? undefined)

        if (setTabNameFn) {
          setTabNameFn(entry.name)
        }

        restoredNames.push(entry.name)
      }
    } catch (err) {
      console.warn(`[Recovery] Failed to restore tab ${entry.tabId}:`, err)
    }
  }

  await clearAllRecovery()
  return restoredNames
}
