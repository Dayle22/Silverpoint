export interface UndoEntryCost {
  bytes: number
  nodeCount: number
}

export interface UndoBudget {
  maxEntries: number
  maxBytes: number
  /** Always retain at least this many entries regardless of bytes. */
  minRetainedEntries: number
}

export const DEFAULT_UNDO_BUDGET: UndoBudget = {
  maxEntries: 200,
  maxBytes: 128 * 1024 * 1024,
  minRetainedEntries: 10,
}

export const DEFAULT_HISTORY_LIMIT = 200

/** Beyond this many coalesced steps, start a fresh entry instead of composing further. */
export const MAX_COALESCE_CHAIN = 32

export interface UndoEntry {
  label: string
  forward?: (() => void) | null
  inverse?: (() => void) | null
  coalesceKey?: string
  nodeCount?: number
  cost?: UndoEntryCost
  coalesceChain?: number
}

export interface UndoManagerOptions {
  limit?: number
  budget?: Partial<UndoBudget>
}

export interface UndoStats {
  undoEntries: number
  redoEntries: number
  estimatedBytes: number
  trimmedEntries: number
  coalescedRuns: number
}

interface UndoBatch {
  label: string
  entries: UndoEntry[]
  coalesceKey?: string
}

export function estimateEntryCost(entry: UndoEntry): UndoEntryCost {
  if (entry.cost) {
    return entry.cost
  }
  const nodeCount = Math.max(0, entry.nodeCount ?? 0)
  const bytes = 1024 + nodeCount * 512
  return { bytes, nodeCount }
}

export class UndoManager {
  private undoStack: UndoEntry[] = []
  private redoStack: UndoEntry[] = []
  private batches: UndoBatch[] = []
  private readonly budget: UndoBudget
  private undoBytes = 0
  private redoBytes = 0
  private trimmedEntries = 0
  private coalescedRuns = 0

  constructor(options: UndoManagerOptions = {}) {
    this.budget = {
      ...DEFAULT_UNDO_BUDGET,
      ...(options.limit !== undefined ? { maxEntries: options.limit } : {}),
      ...options.budget,
    }
  }

  apply(entry: UndoEntry): void {
    this.execute(entry)
  }

  execute(entry: UndoEntry): void {
    entry.forward?.()
    this.record(entry)
  }

  push(entry: UndoEntry): void {
    this.record(entry)
  }

  record(entry: UndoEntry): void {
    const batch = this.currentBatch
    if (batch) {
      batch.entries.push(entry)
      return
    }
    this.pushUndoEntry(entry)
  }

  undo(): string | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    this.undoBytes = Math.max(0, this.undoBytes - (entry.cost?.bytes ?? 0))
    entry.inverse?.()
    this.redoStack.push(entry)
    this.redoBytes += entry.cost?.bytes ?? 0
    return entry.label
  }

  redo(): string | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    this.redoBytes = Math.max(0, this.redoBytes - (entry.cost?.bytes ?? 0))
    entry.forward?.()
    this.undoStack.push(entry)
    this.undoBytes += entry.cost?.bytes ?? 0
    this.trimUndoStack()
    return entry.label
  }

  beginBatch(label: string, coalesceKey?: string): void {
    this.batches.push({ label, entries: [], coalesceKey })
  }

  commitBatch(): void {
    const batch = this.batches.pop()
    if (!batch || batch.entries.length === 0) return

    const entry = this.createBatchEntry(batch)
    const parentBatch = this.currentBatch
    if (parentBatch) parentBatch.entries.push(entry)
    else this.pushUndoEntry(entry)
  }

  runBatch<T>(label: string, fn: () => T, coalesceKey?: string): T {
    this.beginBatch(label, coalesceKey)
    try {
      const result = fn()
      this.commitBatch()
      return result
    } catch (error) {
      this.rollbackBatch()
      throw error
    }
  }

  rollbackBatch(): void {
    const batch = this.batches.pop()
    if (!batch) return
    for (const entry of batch.entries.toReversed()) entry.inverse?.()
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.batches = []
    this.undoBytes = 0
    this.redoBytes = 0
    this.trimmedEntries = 0
    this.coalescedRuns = 0
  }

  get isBatching(): boolean {
    return this.batches.length > 0
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null
  }

  get redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null
  }

  getStats(): UndoStats {
    return {
      undoEntries: this.undoStack.length,
      redoEntries: this.redoStack.length,
      estimatedBytes: this.undoBytes + this.redoBytes,
      trimmedEntries: this.trimmedEntries,
      coalescedRuns: this.coalescedRuns,
    }
  }

  private get currentBatch(): UndoBatch | null {
    return this.batches.at(-1) ?? null
  }

  private createBatchEntry(batch: UndoBatch): UndoEntry {
    const nodeCount = batch.entries.reduce((sum, entry) => sum + (entry.nodeCount ?? 0), 0)
    const childBytes = batch.entries.reduce((sum, entry) => sum + (entry.cost?.bytes ?? 0), 0)
    return {
      label: batch.label,
      forward: () => batch.entries.forEach((entry) => entry.forward?.()),
      inverse: () => batch.entries.toReversed().forEach((entry) => entry.inverse?.()),
      coalesceKey: batch.coalesceKey,
      nodeCount,
      cost: childBytes > 0 ? { bytes: 1024 + childBytes, nodeCount } : undefined,
    }
  }

  private pushUndoEntry(entry: UndoEntry): void {
    const previous = this.undoStack.at(-1)
    const cost = entry.cost ?? estimateEntryCost(entry)
    entry.cost = cost
    entry.coalesceChain = entry.coalesceChain ?? 1

    if (
      entry.coalesceKey &&
      previous?.coalesceKey === entry.coalesceKey &&
      (previous.coalesceChain ?? 1) < MAX_COALESCE_CHAIN
    ) {
      if ((previous.coalesceChain ?? 1) === 1) {
        this.coalescedRuns++
      }
      const prevForward = previous.forward
      const newForward = entry.forward
      const prevCost = previous.cost ?? estimateEntryCost(previous)
      const coalescedCost: UndoEntryCost = {
        bytes: prevCost.bytes + cost.bytes,
        nodeCount: prevCost.nodeCount + cost.nodeCount,
      }
      const coalescedEntry: UndoEntry = {
        ...entry,
        forward: () => {
          prevForward?.()
          newForward?.()
        },
        inverse: previous.inverse,
        cost: coalescedCost,
        coalesceChain: (previous.coalesceChain ?? 1) + 1,
      }
      this.undoStack[this.undoStack.length - 1] = coalescedEntry
      this.undoBytes += cost.bytes
    } else {
      this.undoStack.push(entry)
      this.undoBytes += cost.bytes
    }
    this.redoStack = []
    this.redoBytes = 0
    this.trimUndoStack()
  }

  private trimUndoStack(): void {
    while (
      (Number.isFinite(this.budget.maxEntries) &&
        this.budget.maxEntries > 0 &&
        this.undoStack.length > this.budget.maxEntries) ||
      (Number.isFinite(this.budget.maxBytes) &&
        this.budget.maxBytes > 0 &&
        this.undoBytes > this.budget.maxBytes &&
        this.undoStack.length > this.budget.minRetainedEntries)
    ) {
      const removed = this.undoStack.shift()
      if (!removed) break
      this.trimmedEntries++
      this.undoBytes = Math.max(0, this.undoBytes - (removed.cost?.bytes ?? 0))
      removed.forward = null
      removed.inverse = null
    }
  }
}

export function getUndoStats(m: UndoManager): UndoStats {
  return m.getStats()
}
