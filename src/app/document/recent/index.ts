import {
  readCacheJson,
  writeCacheJson,
  writeCacheBytes,
  removeCacheEntry
} from '@/app/cache'
import type { EditorStore } from '@/app/editor/session'

export interface RecentProject {
  path: string
  name: string
  lastOpened: number
  thumbnailKey?: string
}

const RECENT_MANIFEST_KEY = 'recent-projects.json'

export function pathHash(path: string): string {
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    hash = (hash << 5) - hash + path.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  const items = await readCacheJson<RecentProject[]>(RECENT_MANIFEST_KEY)
  if (!Array.isArray(items)) return []
  return items.sort((a, b) => b.lastOpened - a.lastOpened)
}

export async function addRecentProject(
  path: string,
  name: string,
  store?: EditorStore
): Promise<void> {
  if (!path) return
  let list = await getRecentProjects()

  const existingIdx = list.findIndex((item) => item.path === path)
  const thumbnailKey = existingIdx !== -1 ? list[existingIdx].thumbnailKey : undefined

  if (existingIdx !== -1) {
    list.splice(existingIdx, 1)
  }

  const updatedEntry: RecentProject = {
    path,
    name: name || path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Untitled',
    lastOpened: Date.now(),
    thumbnailKey
  }

  list.unshift(updatedEntry)

  // Cap at max 20 entries
  if (list.length > 20) {
    const removed = list.slice(20)
    list = list.slice(0, 20)
    for (const item of removed) {
      if (item.thumbnailKey) {
        void removeCacheEntry(item.thumbnailKey)
      }
    }
  }

  await writeCacheJson(RECENT_MANIFEST_KEY, list)

  // Background thumbnail rendering if store is provided
  if (store) {
    setTimeout(() => {
      void (async () => {
        try {
          const bytes = await store.renderExportImage([], 0.15, 'PNG')
          if (bytes && bytes.length > 0) {
            const key = `recent/thumb_${pathHash(path)}.png`
            await writeCacheBytes(key, bytes.buffer as ArrayBuffer)

            const freshList = await getRecentProjects()
            const entry = freshList.find((i) => i.path === path)
            if (entry) {
              entry.thumbnailKey = key
              await writeCacheJson(RECENT_MANIFEST_KEY, freshList)
            }
          }
        } catch (err) {
          console.warn('[Recents] Failed to generate thumbnail:', err)
        }
      })()
    }, 1000)
  }
}

export async function removeRecentProject(path: string): Promise<void> {
  const list = await getRecentProjects()
  const idx = list.findIndex((item) => item.path === path)
  if (idx === -1) return

  const [removed] = list.splice(idx, 1)
  if (removed.thumbnailKey) {
    void removeCacheEntry(removed.thumbnailKey)
  }

  await writeCacheJson(RECENT_MANIFEST_KEY, list)
}
