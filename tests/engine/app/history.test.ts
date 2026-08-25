// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { SceneGraph } from '@open-pencil/scene-graph'

function createMemoryStorage() {
  const jsonMap = new Map<string, unknown>()
  const bytesMap = new Map<string, ArrayBuffer>()

  return {
    readCacheJson: mock(async <T>(key: string): Promise<T | null> => {
      return (jsonMap.get(key) as T) ?? null
    }),
    writeCacheJson: mock(async (key: string, value: unknown): Promise<void> => {
      jsonMap.set(key, value)
    }),
    readCacheBytes: mock(async (key: string): Promise<ArrayBuffer | null> => {
      return bytesMap.get(key) ?? null
    }),
    writeCacheBytes: mock(async (key: string, value: ArrayBuffer): Promise<void> => {
      bytesMap.set(key, value)
    }),
    removeCacheEntry: mock(async (key: string): Promise<void> => {
      jsonMap.delete(key)
      bytesMap.delete(key)
    }),
    jsonMap,
    bytesMap
  }
}

describe('document history module', () => {
  let mem: ReturnType<typeof createMemoryStorage>

  beforeEach(() => {
    mem = createMemoryStorage()
    mock.module('@/app/cache', () => ({
      readCacheJson: mem.readCacheJson,
      writeCacheJson: mem.writeCacheJson,
      readCacheBytes: mem.readCacheBytes,
      writeCacheBytes: mem.writeCacheBytes,
      removeCacheEntry: mem.removeCacheEntry
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  test('adds manual save snapshots to manifest', async () => {
    const { addHistorySnapshot, getHistoryManifest } = await import('@/app/document/history')
    const graph = new SceneGraph()
    const docKey = 'test-doc-1'

    await addHistorySnapshot(docKey, graph, 'save')

    const manifest = await getHistoryManifest(docKey)
    expect(manifest).toHaveLength(1)
    expect(manifest[0].label).toBe('save')
    expect(manifest[0].fileKey).toMatch(/^history\/test-doc-1\/\d+\.fig$/)
    expect(mem.bytesMap.size).toBe(1)
  })

  test('throttles autosave snapshots within 5 minutes', async () => {
    const { addHistorySnapshot, getHistoryManifest } = await import('@/app/document/history')
    const graph = new SceneGraph()
    const docKey = 'test-doc-2'

    // First snapshot
    await addHistorySnapshot(docKey, graph, 'autosave')
    let manifest = await getHistoryManifest(docKey)
    expect(manifest).toHaveLength(1)

    // Immediate second autosave should be throttled
    await addHistorySnapshot(docKey, graph, 'autosave')
    manifest = await getHistoryManifest(docKey)
    expect(manifest).toHaveLength(1)

    // Explicit manual save should NOT be throttled
    await addHistorySnapshot(docKey, graph, 'save')
    manifest = await getHistoryManifest(docKey)
    expect(manifest).toHaveLength(2)
    expect(manifest[1].label).toBe('save')
  })

  test('enforces 50-snapshot retention cap by evicting oldest entries', async () => {
    const { addHistorySnapshot, getHistoryManifest } = await import('@/app/document/history')
    const graph = new SceneGraph()
    const docKey = 'test-doc-3'

    // Pre-populate with 50 entries
    const initialList = []
    for (let i = 0; i < 50; i++) {
      const fileKey = `history/${docKey}/${1000 + i}.fig`
      mem.bytesMap.set(fileKey, new ArrayBuffer(10))
      initialList.push({
        timestamp: 1000 + i,
        label: 'save',
        sizeBytes: 10,
        fileKey
      })
    }
    mem.jsonMap.set(`history/${docKey}/manifest.json`, initialList)

    // Add 51st entry
    await addHistorySnapshot(docKey, graph, 'save')

    const manifest = await getHistoryManifest(docKey)
    expect(manifest).toHaveLength(50)
    // The oldest entry (timestamp 1000) should be evicted
    expect(manifest[0].timestamp).toBe(1001)
    expect(mem.removeCacheEntry).toHaveBeenCalledWith(`history/${docKey}/1000.fig`)
  })
})
