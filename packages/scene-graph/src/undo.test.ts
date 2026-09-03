import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_UNDO_BUDGET,
  MAX_COALESCE_CHAIN,
  UndoManager,
  estimateEntryCost,
  getUndoStats,
} from './undo'

const noop = (): void => {
  void 0
}

describe('undo history and coalescing (F-018j)', () => {
  it('1. passes redo test after coalesced run (failing redo test from section 4 now passes)', () => {
    const manager = new UndoManager()
    const node = { x: 0 }

    // Push three coalescing entries that move a node from x=0 to x=10, then x=20, then x=30
    node.x = 10
    manager.push({
      label: 'move',
      coalesceKey: 'drag',
      forward: () => {
        node.x += 10
      },
      inverse: () => {
        node.x = 0
      },
    })

    node.x = 20
    manager.push({
      label: 'move',
      coalesceKey: 'drag',
      forward: () => {
        node.x += 10
      },
      inverse: () => {
        node.x = 10
      },
    })

    node.x = 30
    manager.push({
      label: 'move',
      coalesceKey: 'drag',
      forward: () => {
        node.x += 10
      },
      inverse: () => {
        node.x = 20
      },
    })

    // Undo once: asserts node is at x=0
    manager.undo()
    expect(node.x).toBe(0)

    // Redo once: asserts node is at x=30
    manager.redo()
    expect(node.x).toBe(30)
  })

  it('2. coalescing a run of 50 moves then undo/redo lands on the correct final state', () => {
    const manager = new UndoManager()
    const node = { x: 0 }

    for (let i = 1; i <= 50; i++) {
      const prev = node.x
      node.x = i
      manager.push({
        label: `move-${i}`,
        coalesceKey: 'drag-50',
        forward: () => {
          node.x += 1
        },
        inverse: () => {
          node.x = prev
        },
      })
    }

    expect(node.x).toBe(50)

    // Undo all entries in the run
    while (manager.canUndo) {
      manager.undo()
    }
    expect(node.x).toBe(0)

    // Redo all entries in the run
    while (manager.canRedo) {
      manager.redo()
    }
    expect(node.x).toBe(50)
  })

  it('3. a coalesce chain longer than MAX_COALESCE_CHAIN splits into a new entry, and undo/redo across the split is still correct', () => {
    const manager = new UndoManager()
    const node = { x: 0 }

    const extraSteps = 5
    const totalSteps = MAX_COALESCE_CHAIN + extraSteps // e.g. 37
    for (let i = 1; i <= totalSteps; i++) {
      const prev = node.x
      node.x = i
      manager.push({
        label: `move-${i}`,
        coalesceKey: 'drag-split',
        forward: () => {
          node.x += 1
        },
        inverse: () => {
          node.x = prev
        },
      })
    }

    const stats = getUndoStats(manager)
    // First entry has MAX_COALESCE_CHAIN steps, second entry has extraSteps steps
    expect(stats.undoEntries).toBe(2)

    // Undo step across the split (reverts second entry: from totalSteps back to MAX_COALESCE_CHAIN)
    manager.undo()
    expect(node.x).toBe(MAX_COALESCE_CHAIN)

    // Undo step before the split (reverts first entry: from MAX_COALESCE_CHAIN back to 0)
    manager.undo()
    expect(node.x).toBe(0)

    // Redo first entry (applies first MAX_COALESCE_CHAIN steps: 0 to MAX_COALESCE_CHAIN)
    manager.redo()
    expect(node.x).toBe(MAX_COALESCE_CHAIN)

    // Redo second entry across the split (applies remaining extraSteps: MAX_COALESCE_CHAIN to totalSteps)
    manager.redo()
    expect(node.x).toBe(totalSteps)
  })

  it('4. pushing entries past maxBytes trims the oldest first', () => {
    // Each entry without nodeCount has estimated cost 1024 bytes
    // Set maxBytes to 3500 so 3 entries (3072 B) fit, but 4 entries (4096 B) overflow
    const manager = new UndoManager({
      budget: {
        maxEntries: 100,
        maxBytes: 3500,
        minRetainedEntries: 1,
      },
    })

    manager.push({
      label: 'entry-1',
      forward: noop,
      inverse: noop,
    })
    manager.push({
      label: 'entry-2',
      forward: noop,
      inverse: noop,
    })
    manager.push({
      label: 'entry-3',
      forward: noop,
      inverse: noop,
    })

    expect(getUndoStats(manager).undoEntries).toBe(3)
    expect(getUndoStats(manager).trimmedEntries).toBe(0)

    // 4th entry exceeds 3500 bytes; oldest ('entry-1') must be trimmed
    manager.push({
      label: 'entry-4',
      forward: noop,
      inverse: noop,
    })

    const stats = getUndoStats(manager)
    expect(stats.undoEntries).toBe(3)
    expect(stats.trimmedEntries).toBe(1)

    // Undo should return entries in reverse order: entry-4, entry-3, entry-2. entry-1 is gone.
    expect(manager.undo()).toBe('entry-4')
    expect(manager.undo()).toBe('entry-3')
    expect(manager.undo()).toBe('entry-2')
    expect(manager.undo()).toBeNull()
  })

  it('5. trimming never goes below minRetainedEntries, even for one huge entry', () => {
    const minRetained = 5
    const manager = new UndoManager({
      budget: {
        maxEntries: 100,
        maxBytes: 1024, // Tiny limit
        minRetainedEntries: minRetained,
      },
    })

    // Push minRetained huge entries (5000 nodes each ~ 2.5MB each)
    for (let i = 1; i <= minRetained; i++) {
      manager.push({
        label: `huge-${i}`,
        nodeCount: 5000,
        forward: noop,
        inverse: noop,
      })
    }

    // Must retain exactly minRetained entries despite byte overflow
    expect(getUndoStats(manager).undoEntries).toBe(minRetained)
    expect(getUndoStats(manager).trimmedEntries).toBe(0)

    // Pushing another entry can only trim down to minRetainedEntries
    manager.push({
      label: 'huge-6',
      nodeCount: 5000,
      forward: noop,
      inverse: noop,
    })

    expect(getUndoStats(manager).undoEntries).toBe(minRetained)
    expect(getUndoStats(manager).trimmedEntries).toBe(1)
  })

  it('6. maxEntries is enforced independently of bytes', () => {
    const manager = new UndoManager({
      budget: {
        maxEntries: 3,
        maxBytes: 128 * 1024 * 1024, // Generous byte limit
        minRetainedEntries: 1,
      },
    })

    manager.push({ label: 'e1', forward: noop, inverse: noop })
    manager.push({ label: 'e2', forward: noop, inverse: noop })
    manager.push({ label: 'e3', forward: noop, inverse: noop })
    manager.push({ label: 'e4', forward: noop, inverse: noop })

    const stats = getUndoStats(manager)
    expect(stats.undoEntries).toBe(3)
    expect(stats.trimmedEntries).toBe(1)
    expect(manager.undo()).toBe('e4')
    expect(manager.undo()).toBe('e3')
    expect(manager.undo()).toBe('e2')
    expect(manager.undo()).toBeNull()
  })

  it('7. runBatch and rollbackBatch behaviour is unchanged', () => {
    const manager = new UndoManager()
    let state = 0

    // Successful batch execution
    const result = manager.runBatch('increment-batch', () => {
      state += 10
      manager.push({
        label: 'step-1',
        forward: () => {
          state += 10
        },
        inverse: () => {
          state -= 10
        },
      })
      state += 5
      manager.push({
        label: 'step-2',
        forward: () => {
          state += 5
        },
        inverse: () => {
          state -= 5
        },
      })
      return state
    })

    expect(result).toBe(15)
    expect(state).toBe(15)
    expect(manager.undoLabel).toBe('increment-batch')

    // Undo batch
    manager.undo()
    expect(state).toBe(0)

    // Redo batch
    manager.redo()
    expect(state).toBe(15)

    // Rollback batch on exception
    expect(() => {
      manager.runBatch('failing-batch', () => {
        state += 20
        manager.push({
          label: 'rollback-step',
          forward: () => {
            state += 20
          },
          inverse: () => {
            state -= 20
          },
        })
        throw new Error('batch failure')
      })
    }).toThrow('batch failure')

    // Verified rolled back
    expect(state).toBe(15)
    expect(manager.undoLabel).toBe('increment-batch')
  })

  it('8. redo is still cleared by a new edit after an undo, exactly as before', () => {
    const manager = new UndoManager()
    let state = 0

    manager.push({
      label: 'edit-1',
      forward: () => {
        state = 1
      },
      inverse: () => {
        state = 0
      },
    })
    state = 1

    manager.push({
      label: 'edit-2',
      forward: () => {
        state = 2
      },
      inverse: () => {
        state = 1
      },
    })
    state = 2

    expect(manager.canRedo).toBe(false)
    manager.undo() // reverts to 1
    expect(state).toBe(1)
    expect(manager.canRedo).toBe(true)

    // New edit clears redo stack
    manager.push({
      label: 'edit-3',
      forward: () => {
        state = 3
      },
      inverse: () => {
        state = 1
      },
    })
    state = 3

    expect(manager.canRedo).toBe(false)
    expect(manager.redo()).toBeNull()
  })

  it('estimates entry cost and honors DEFAULT_UNDO_BUDGET', () => {
    const entry = {
      label: 'test',
      forward: noop,
      inverse: noop,
      nodeCount: 10,
    }
    const cost = estimateEntryCost(entry)
    expect(cost.nodeCount).toBe(10)
    expect(cost.bytes).toBe(1024 + 10 * 512)

    expect(DEFAULT_UNDO_BUDGET.maxEntries).toBe(200)
    expect(DEFAULT_UNDO_BUDGET.maxBytes).toBe(128 * 1024 * 1024)
    expect(DEFAULT_UNDO_BUDGET.minRetainedEntries).toBe(10)
  })
})
