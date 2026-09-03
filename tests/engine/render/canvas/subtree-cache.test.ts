import { describe, expect, it } from 'bun:test'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { BoundedLruCache } from '#core/canvas/renderer/lru-cache'
import {
  clearSubtreePictureCache,
  flushDirtySubtrees,
  invalidateNodePicture,
  markSubtreeDirty,
  peekDirtySubtrees
} from '#core/canvas/renderer/state'

interface MockPicture {
  deleted: boolean
  delete: () => void
}

function createMockPicture(): MockPicture {
  const pic = {
    deleted: false,
    delete() {
      pic.deleted = true
    }
  }
  return pic
}

interface MockEntry {
  picture: MockPicture
  pageId: string | null
  sceneVersion: number
  positionPreviewVersion: number
  fontGeneration: number
}

function asRenderer(mock: object): SkiaRenderer {
  return mock as never
}

function createMockRenderer(options: { maxEntries?: number; maxBytes?: number } = {}): SkiaRenderer {
  const cache = new BoundedLruCache<MockEntry>({
    name: 'subtreePictureCache',
    maxBytes: options.maxBytes ?? 10_000_000,
    maxEntries: options.maxEntries ?? 2000,
    dispose: (entry) => {
      entry.picture.delete()
    }
  })

  return asRenderer({
    subtreePictureCache: cache,
    subtreePictureCachePageId: 'page-1',
    subtreePictureCacheSceneVersion: 1,
    subtreePictureCachePositionPreviewVersion: 0,
    subtreePictureCacheFontGeneration: 1,
    pageId: 'page-1',
    fontGeneration: 1,
    nodePictureCache: new Map(),
    nodePictureCacheGenerations: new Map()
  })
}

describe('F-018f Subtree Picture Cache Versioning', () => {
  it('1. changing one node evicts that node subtree picture and its ancestors, and no others', () => {
    const r = createMockRenderer()
    const nodeA = createMockPicture()
    const nodeB = createMockPicture()
    const nodeC = createMockPicture()
    const nodeD = createMockPicture()
    const nodeE = createMockPicture()

    r.subtreePictureCache.set('A', {
      picture: nodeA,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })
    r.subtreePictureCache.set('B', {
      picture: nodeB,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })
    r.subtreePictureCache.set('C', {
      picture: nodeC,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })
    r.subtreePictureCache.set('D', {
      picture: nodeD,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })
    r.subtreePictureCache.set('E', {
      picture: nodeE,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })

    // C changed; B is its parent, A is root ancestor
    invalidateNodePicture(r, 'C', ['B', 'A'])

    // C was deleted immediately by invalidateNodePicture; B and A are marked dirty
    expect(r.subtreePictureCache.has('C')).toBe(false)
    expect(nodeC.deleted).toBe(true)

    // Before flush, peekDirtySubtrees includes C, B, A
    const dirty = peekDirtySubtrees(r)
    expect(dirty.has('C')).toBe(true)
    expect(dirty.has('B')).toBe(true)
    expect(dirty.has('A')).toBe(true)
    expect(dirty.has('D')).toBe(false)

    // Flush dirty subtrees
    const evicted = flushDirtySubtrees(r)
    expect(evicted).toBe(2) // B and A evicted (C was already deleted by invalidateNodePicture)

    // Node A and B should be evicted and disposed
    expect(r.subtreePictureCache.has('A')).toBe(false)
    expect(r.subtreePictureCache.has('B')).toBe(false)
    expect(nodeA.deleted).toBe(true)
    expect(nodeB.deleted).toBe(true)

    // Node D and E must remain intact and not deleted
    expect(r.subtreePictureCache.has('D')).toBe(true)
    expect(r.subtreePictureCache.has('E')).toBe(true)
    expect(nodeD.deleted).toBe(false)
    expect(nodeE.deleted).toBe(false)
  })

  it('2. changing one node in a 1 000-node cache leaves at least 900 entries intact', () => {
    const r = createMockRenderer({ maxEntries: 2000 })
    const pictures: MockPicture[] = []

    for (let i = 0; i < 1000; i++) {
      const pic = createMockPicture()
      pictures.push(pic)
      r.subtreePictureCache.set(`node-${i}`, {
        picture: pic,
        pageId: 'page-1',
        sceneVersion: 1,
        positionPreviewVersion: 0,
        fontGeneration: 1
      })
    }

    expect(r.subtreePictureCache.size).toBe(1000)

    // Edit node-42, with 3 ancestors (node-1, node-2, node-3)
    markSubtreeDirty(r, 'node-42', ['node-1', 'node-2', 'node-3'])
    const evicted = flushDirtySubtrees(r)

    expect(evicted).toBe(4)
    expect(r.subtreePictureCache.size).toBe(996)
    expect(r.subtreePictureCache.size).toBeGreaterThanOrEqual(900)
    expect(r.subtreePictureCache.has('node-42')).toBe(false)
    expect(r.subtreePictureCache.has('node-1')).toBe(false)
    expect(r.subtreePictureCache.has('node-2')).toBe(false)
    expect(r.subtreePictureCache.has('node-3')).toBe(false)
    expect(r.subtreePictureCache.has('node-999')).toBe(true)
  })

  it('3. a page/scope change still clears everything', () => {
    const r = createMockRenderer()
    const pic1 = createMockPicture()
    const pic2 = createMockPicture()

    r.subtreePictureCache.set('node-1', {
      picture: pic1,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })
    r.subtreePictureCache.set('node-2', {
      picture: pic2,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })

    markSubtreeDirty(r, 'node-1', [])

    clearSubtreePictureCache(r)

    expect(r.subtreePictureCache.size).toBe(0)
    expect(pic1.deleted).toBe(true)
    expect(pic2.deleted).toBe(true)
    expect(r.subtreePictureCachePageId).toBeNull()
    expect(r.subtreePictureCacheSceneVersion).toBe(-1)
    expect(r.subtreePictureCachePositionPreviewVersion).toBe(-1)
    expect(r.subtreePictureCacheFontGeneration).toBe(-1)
    expect(peekDirtySubtrees(r).size).toBe(0)
  })

  it('4. flushDirtySubtrees is idempotent — calling it twice evicts nothing the second time', () => {
    const r = createMockRenderer()
    const pic1 = createMockPicture()
    r.subtreePictureCache.set('node-1', {
      picture: pic1,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })

    markSubtreeDirty(r, 'node-1', [])
    expect(peekDirtySubtrees(r).size).toBe(1)

    const firstEvicted = flushDirtySubtrees(r)
    expect(firstEvicted).toBe(1)
    expect(peekDirtySubtrees(r).size).toBe(0)
    expect(r.subtreePictureCache.has('node-1')).toBe(false)

    const secondEvicted = flushDirtySubtrees(r)
    expect(secondEvicted).toBe(0)
    expect(peekDirtySubtrees(r).size).toBe(0)
  })

  it('5. marking a node with no cached picture is a harmless no-op', () => {
    const r = createMockRenderer()
    const pic = createMockPicture()
    r.subtreePictureCache.set('existing-node', {
      picture: pic,
      pageId: 'page-1',
      sceneVersion: 1,
      positionPreviewVersion: 0,
      fontGeneration: 1
    })

    markSubtreeDirty(r, 'non-existent', ['also-non-existent', 'ghost-parent'])
    expect(peekDirtySubtrees(r).size).toBe(3)

    const evicted = flushDirtySubtrees(r)
    expect(evicted).toBe(0)
    expect(r.subtreePictureCache.has('existing-node')).toBe(true)
    expect(pic.deleted).toBe(false)
    expect(peekDirtySubtrees(r).size).toBe(0)
  })
})
