import { describe, expect, it } from 'bun:test'
import {
  BoundedLruCache,
  CacheBudget,
  estimateImageBytes,
  estimatePathBytes,
  estimatePictureBytes,
  type Disposable
} from '#core/canvas/renderer/lru-cache'

class MockWasmObject implements Disposable {
  deleted = false
  constructor(public id: string) {}
  delete(): void {
    this.deleted = true
  }
  isDeleted(): boolean {
    return this.deleted
  }
}

describe('BoundedLruCache', () => {
  it('1. set beyond maxBytes evicts least-recently-used first', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const objA = new MockWasmObject('A')
    const objB = new MockWasmObject('B')
    const objC = new MockWasmObject('C')

    cache.set('a', objA, 40)
    cache.set('b', objB, 40)
    expect(cache.bytes).toBe(80)
    expect(cache.size).toBe(2)

    // Adding C (40 bytes) brings total to 120 > 100, so A (oldest) should be evicted
    cache.set('c', objC, 40)

    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.has('c')).toBe(true)
    expect(objA.deleted).toBe(true)
    expect(disposed).toEqual(['A'])
    expect(cache.bytes).toBe(80)
    expect(cache.size).toBe(2)
  })

  it('2. get promotes recency, so the promoted key survives a later eviction', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const objA = new MockWasmObject('A')
    const objB = new MockWasmObject('B')
    const objC = new MockWasmObject('C')

    cache.set('a', objA, 40)
    cache.set('b', objB, 40)

    // Touch 'a' to promote it to MRU
    expect(cache.get('a')).toBe(objA)

    // Now 'b' is the LRU. Adding C (40 bytes) should evict 'b', not 'a'
    cache.set('c', objC, 40)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
    expect(objB.deleted).toBe(true)
    expect(disposed).toEqual(['B'])
  })

  it('3. re-setting an existing key disposes the old value exactly once and does not double-count bytes', () => {
    let disposeCount = 0
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposeCount++
      }
    })

    const objA1 = new MockWasmObject('A1')
    const objA2 = new MockWasmObject('A2')

    cache.set('a', objA1, 50)
    expect(cache.bytes).toBe(50)
    expect(cache.size).toBe(1)

    cache.set('a', objA2, 60)
    expect(objA1.deleted).toBe(true)
    expect(disposeCount).toBe(1)
    expect(cache.bytes).toBe(60)
    expect(cache.size).toBe(1)
    expect(cache.get('a')).toBe(objA2)
  })

  it('4. an entry larger than maxBytes is disposed immediately and never stored', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const huge = new MockWasmObject('HUGE')
    cache.set('huge', huge, 150)

    expect(cache.has('huge')).toBe(false)
    expect(cache.size).toBe(0)
    expect(cache.bytes).toBe(0)
    expect(huge.deleted).toBe(true)
    expect(disposed).toEqual(['HUGE'])
  })

  it('5. a pinned entry is not evicted under byte pressure; an unpinned neighbour is', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const objA = new MockWasmObject('A')
    const objB = new MockWasmObject('B')
    const objC = new MockWasmObject('C')

    cache.set('a', objA, 40)
    cache.set('b', objB, 40)

    // Pin 'a'
    cache.pin('a')

    // Add C (40 bytes). Total = 120 > 100. 'a' is pinned even though it is older, so 'b' must be evicted
    cache.set('c', objC, 40)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
    expect(objB.deleted).toBe(true)
    expect(objA.deleted).toBe(false)
    expect(disposed).toEqual(['B'])
  })

  it('6. clear() disposes pinned entries too', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const objA = new MockWasmObject('A')
    const objB = new MockWasmObject('B')

    cache.set('a', objA, 40)
    cache.set('b', objB, 40)
    cache.pin('a')

    cache.clear()

    expect(cache.size).toBe(0)
    expect(cache.bytes).toBe(0)
    expect(objA.deleted).toBe(true)
    expect(objB.deleted).toBe(true)
    expect(disposed).toContain('A')
    expect(disposed).toContain('B')
  })

  it('7. a dispose implementation that throws does not abort the sweep and does not corrupt bytes', () => {
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'throwing-cache',
      maxBytes: 100,
      maxEntries: 10,
      dispose: (v) => {
        if (v.id === 'THROW') {
          throw new Error('Explosion during dispose')
        }
        v.delete()
      }
    })

    const objBad = new MockWasmObject('THROW')
    const objGood = new MockWasmObject('GOOD')
    const objNext = new MockWasmObject('NEXT')

    cache.set('bad', objBad, 50)
    cache.set('good', objGood, 40)

    // Adding next (50 bytes) forces eviction of 'bad' (50 bytes)
    expect(() => {
      cache.set('next', objNext, 50)
    }).not.toThrow()

    expect(cache.has('bad')).toBe(false)
    expect(cache.has('good')).toBe(true)
    expect(cache.has('next')).toBe(true)
    expect(cache.bytes).toBe(90)
    expect(cache.size).toBe(2)
  })

  it('8. maxEntries is enforced independently of maxBytes', () => {
    const disposed: string[] = []
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'test-cache',
      maxBytes: 1000,
      maxEntries: 2,
      dispose: (v) => {
        v.delete()
        disposed.push(v.id)
      }
    })

    const objA = new MockWasmObject('A')
    const objB = new MockWasmObject('B')
    const objC = new MockWasmObject('C')

    cache.set('a', objA, 10)
    cache.set('b', objB, 10)
    expect(cache.size).toBe(2)

    cache.set('c', objC, 10)
    expect(cache.size).toBe(2)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.has('c')).toBe(true)
    expect(disposed).toEqual(['A'])
  })

  it('9. CacheBudget.trimTo drains the largest cache first', () => {
    const budget = new CacheBudget()

    const cache1 = new BoundedLruCache<MockWasmObject>({
      name: 'cache-small',
      maxBytes: 200,
      maxEntries: 10,
      dispose: (v) => v.delete()
    })

    const cache2 = new BoundedLruCache<MockWasmObject>({
      name: 'cache-large',
      maxBytes: 500,
      maxEntries: 10,
      dispose: (v) => v.delete()
    })

    budget.register(cache1)
    budget.register(cache2)

    cache1.set('s1', new MockWasmObject('s1'), 50)
    cache2.set('l1', new MockWasmObject('l1'), 200)
    cache2.set('l2', new MockWasmObject('l2'), 150)

    expect(budget.totalBytes()).toBe(400) // 50 + 350

    // Trim to 250 bytes. Needs to trim 150 bytes.
    // cache2 (350 bytes) is larger than cache1 (50 bytes), so cache2's oldest entry (l1: 200) should be evicted first.
    const reclaimed = budget.trimTo(250)

    expect(reclaimed).toBe(200)
    expect(cache2.has('l1')).toBe(false)
    expect(cache2.has('l2')).toBe(true)
    expect(cache1.has('s1')).toBe(true)
    expect(budget.totalBytes()).toBe(200)
  })

  it('verifies byte estimation helpers', () => {
    expect(estimateImageBytes(100, 200)).toBe(80000)
    expect(estimateImageBytes(0, 0)).toBe(1)
    expect(estimatePathBytes()).toBe(2048)
    expect(estimatePictureBytes(0)).toBe(4096)
    expect(estimatePictureBytes(10)).toBe(4096 + 5120)
  })

  it('supports map iteration and Symbol.iterator', () => {
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'iter-cache',
      maxBytes: 1000,
      maxEntries: 10,
      dispose: (v) => v.delete()
    })
    const obj1 = new MockWasmObject('1')
    const obj2 = new MockWasmObject('2')
    cache.set('k1', obj1, 10)
    cache.set('k2', obj2, 20)

    expect(Array.from(cache.keys())).toEqual(['k1', 'k2'])
    expect(Array.from(cache.values())).toEqual([obj1, obj2])
    expect(Array.from(cache.entries())).toEqual([
      ['k1', obj1],
      ['k2', obj2]
    ])
    expect(Array.from(cache)).toEqual([
      ['k1', obj1],
      ['k2', obj2]
    ])
  })

  it('uses defaultBytes when bytes parameter is omitted in set', () => {
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'default-bytes-cache',
      maxBytes: 10000,
      maxEntries: 10,
      dispose: (v) => v.delete(),
      defaultBytes: 500
    })
    const obj = new MockWasmObject('default')
    cache.set('key', obj)
    expect(cache.bytes).toBe(500)
  })

  it('evictWhere correctly evicts matching entries and reclaims bytes', () => {
    const cache = new BoundedLruCache<MockWasmObject>({
      name: 'evict-where-cache',
      maxBytes: 10000,
      maxEntries: 10,
      dispose: (v) => v.delete()
    })
    const live = new MockWasmObject('live')
    const dead = new MockWasmObject('dead')
    cache.set('node:1', live, 100)
    cache.set('node:2', dead, 100)

    const liveSet = new Set(['node:1'])
    const evicted = cache.evictWhere((key) => !liveSet.has(key))
    expect(evicted).toBe(1)
    expect(cache.has('node:1')).toBe(true)
    expect(cache.has('node:2')).toBe(false)
    expect(dead.deleted).toBe(true)
    expect(cache.bytes).toBe(100)
  })
})
