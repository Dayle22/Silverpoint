/** Anything CanvasKit-shaped that owns WASM memory. */
export interface Disposable {
  delete(): void
  isDeleted?(): boolean
}

export interface LruEntryMeta {
  /** Approximate bytes of WASM heap held by this value. Must be >= 1. */
  bytes: number
}

export type EvictReason = 'bytes' | 'entries' | 'manual' | 'clear' | 'pinned-release'

export interface BoundedLruOptions<V> {
  /** Human-readable name, used in stats and warnings. */
  name: string
  /** Hard ceiling on total tracked bytes for this cache. */
  maxBytes: number
  /** Hard ceiling on entry count. Guards against many tiny entries. */
  maxEntries: number
  /** Called when an entry is evicted or the cache is cleared. Must free WASM memory. */
  dispose: (value: V) => void
  /** Optional: called when the cache evicts because it hit a limit. For telemetry only. */
  onEvict?: (key: string, meta: LruEntryMeta, reason: EvictReason) => void
}

export interface BoundedLruStats {
  name: string
  entries: number
  bytes: number
  maxBytes: number
  maxEntries: number
  hits: number
  misses: number
  evictions: number
  pinned: number
}

interface CacheEntry<V> {
  value: V
  bytes: number
  pinned: boolean
}

export class BoundedLruCache<V> {
  readonly name: string
  readonly maxBytes: number
  readonly maxEntries: number
  private readonly disposeFn: (value: V) => void
  private readonly onEvictFn?: (key: string, meta: LruEntryMeta, reason: EvictReason) => void

  private readonly map: Map<string, CacheEntry<V>> = new Map()
  private currentBytes = 0
  private hitsCount = 0
  private missesCount = 0
  private evictionsCount = 0
  private pinnedCount = 0

  constructor(options: BoundedLruOptions<V>) {
    if (options.maxBytes < 1 || options.maxEntries < 1) {
      throw new RangeError(`BoundedLruCache "${options.name}": maxBytes and maxEntries must be >= 1`)
    }
    this.name = options.name
    this.maxBytes = options.maxBytes
    this.maxEntries = options.maxEntries
    this.disposeFn = options.dispose
    this.onEvictFn = options.onEvict
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) {
      this.missesCount++
      return undefined
    }

    this.hitsCount++
    // Promote to most-recently-used
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  peek(key: string): V | undefined {
    return this.map.get(key)?.value
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  set(key: string, value: V, bytes: number): void {
    const effectiveBytes = Math.max(1, Math.floor(bytes) || 1)

    // Oversized entry check: if larger than maxBytes, dispose immediately and reject
    if (effectiveBytes > this.maxBytes) {
      this.safelyDispose(value)
      console.warn(
        `BoundedLruCache "${this.name}": entry for key "${key}" with size ${effectiveBytes} exceeds maxBytes ${this.maxBytes}; discarded.`
      )
      return
    }

    // If key already exists, dispose old value and adjust accounting first
    const existing = this.map.get(key)
    if (existing) {
      this.map.delete(key)
      this.currentBytes -= existing.bytes
      if (existing.pinned) {
        this.pinnedCount--
      }
      this.safelyDispose(existing.value)
    }

    // Insert as most-recently-used
    const newEntry: CacheEntry<V> = {
      value,
      bytes: effectiveBytes,
      pinned: false
    }
    this.map.set(key, newEntry)
    this.currentBytes += effectiveBytes

    // Evict least-recently-used unpinned entries until within budget
    this.evictToBudget()
  }

  delete(key: string): boolean {
    const entry = this.map.get(key)
    if (!entry) {
      return false
    }

    this.map.delete(key)
    this.currentBytes -= entry.bytes
    if (entry.pinned) {
      this.pinnedCount--
    }
    this.safelyDispose(entry.value)
    this.onEvictFn?.(key, { bytes: entry.bytes }, 'manual')
    return true
  }

  pin(key: string): void {
    const entry = this.map.get(key)
    if (entry && !entry.pinned) {
      entry.pinned = true
      this.pinnedCount++
    }
  }

  unpin(key: string): void {
    const entry = this.map.get(key)
    if (entry && entry.pinned) {
      entry.pinned = false
      this.pinnedCount--
    }
  }

  clear(): void {
    for (const [key, entry] of this.map.entries()) {
      this.safelyDispose(entry.value)
      this.onEvictFn?.(key, { bytes: entry.bytes }, 'clear')
    }
    this.map.clear()
    this.currentBytes = 0
    this.pinnedCount = 0
  }

  evictWhere(predicate: (key: string) => boolean): number {
    let evicted = 0
    for (const [key, entry] of this.map.entries()) {
      if (!entry.pinned && predicate(key)) {
        this.map.delete(key)
        this.currentBytes -= entry.bytes
        this.evictionsCount++
        evicted++
        this.safelyDispose(entry.value)
        this.onEvictFn?.(key, { bytes: entry.bytes }, 'manual')
      }
    }
    return evicted
  }

  stats(): BoundedLruStats {
    return {
      name: this.name,
      entries: this.map.size,
      bytes: this.currentBytes,
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
      hits: this.hitsCount,
      misses: this.missesCount,
      evictions: this.evictionsCount,
      pinned: this.pinnedCount
    }
  }

  get size(): number {
    return this.map.size
  }

  get bytes(): number {
    return this.currentBytes
  }

  /** Evict the single oldest unpinned entry. Used by CacheBudget.trimTo. */
  evictOldestUnpinned(): boolean {
    for (const [key, entry] of this.map.entries()) {
      if (!entry.pinned) {
        this.map.delete(key)
        this.currentBytes -= entry.bytes
        this.evictionsCount++
        this.safelyDispose(entry.value)
        this.onEvictFn?.(key, { bytes: entry.bytes }, 'bytes')
        return true
      }
    }
    return false
  }

  private evictToBudget(): void {
    while (this.currentBytes > this.maxBytes || this.map.size > this.maxEntries) {
      let foundUnpinned = false
      for (const [key, entry] of this.map.entries()) {
        if (!entry.pinned) {
          const reason: EvictReason = this.currentBytes > this.maxBytes ? 'bytes' : 'entries'
          this.map.delete(key)
          this.currentBytes -= entry.bytes
          this.evictionsCount++
          foundUnpinned = true
          this.safelyDispose(entry.value)
          this.onEvictFn?.(key, { bytes: entry.bytes }, reason)
          break // break to re-evaluate conditions from the new head
        }
      }

      if (!foundUnpinned) {
        console.warn(
          `BoundedLruCache "${this.name}": all remaining entries are pinned but cache is over budget (bytes: ${this.currentBytes}/${this.maxBytes}, entries: ${this.map.size}/${this.maxEntries}).`
        )
        break
      }
    }
  }

  private safelyDispose(value: V): void {
    try {
      if (typeof value === 'object' && value !== null && 'isDeleted' in value) {
        const isDel = (value as { isDeleted?: unknown }).isDeleted
        if (typeof isDel === 'function' && isDel.call(value)) {
          return
        }
      }
      this.disposeFn(value)
    } catch (err) {
      console.warn(`BoundedLruCache "${this.name}": dispose threw an error`, err)
    }
  }
}

/**
 * Owns several BoundedLruCache instances and reports their combined footprint.
 * F-018b registers every renderer cache here.
 */
export class CacheBudget {
  private readonly caches: Set<BoundedLruCache<unknown>> = new Set()

  register(cache: BoundedLruCache<unknown>): void {
    this.caches.add(cache)
  }

  unregister(cache: BoundedLruCache<unknown>): void {
    this.caches.delete(cache)
  }

  totalBytes(): number {
    let sum = 0
    for (const c of this.caches) {
      sum += c.bytes
    }
    return sum
  }

  report(): BoundedLruStats[] {
    const list: BoundedLruStats[] = []
    for (const c of this.caches) {
      list.push(c.stats())
    }
    return list.sort((a, b) => b.bytes - a.bytes)
  }

  clearAll(): void {
    for (const c of this.caches) {
      c.clear()
    }
  }

  /**
   * Evicts from the largest caches first until total is under target.
   * Returns bytes reclaimed.
   */
  trimTo(targetBytes: number): number {
    const startBytes = this.totalBytes()
    if (startBytes <= targetBytes) {
      return 0
    }

    while (this.totalBytes() > targetBytes) {
      const sorted = Array.from(this.caches).sort((a, b) => b.bytes - a.bytes)
      let evictedAny = false

      for (const cache of sorted) {
        if (cache.bytes <= 0) {
          continue
        }
        const evicted = cache.evictOldestUnpinned()
        if (evicted) {
          evictedAny = true
          break
        }
      }

      if (!evictedAny) {
        break
      }
    }

    return Math.max(0, startBytes - this.totalBytes())
  }
}

/** width * height * 4, floored at 1. */
export function estimateImageBytes(width: number, height: number): number {
  return Math.max(1, Math.floor(Math.abs(width) * Math.abs(height) * 4) || 1)
}

/** Rough constant cost for a Path. Use 2_048. */
export function estimatePathBytes(): number {
  return 2_048
}

/** Rough cost for a recorded Picture, scaled by the node count it covers. */
export function estimatePictureBytes(nodeCount: number): number {
  return 4_096 + Math.max(0, Math.floor(nodeCount) || 0) * 512
}
