// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { buildShortcutReference } from '@/app/shell/keyboard/reference'
import { EDITOR_COMMAND_METADATA, type EditorCommandId } from '@open-pencil/vue'
import { TOOL_SHORTCUTS, type Tool } from '@open-pencil/core/editor'

describe('keyboard shortcut reference', () => {
  test('builds rows with expected groups and valid contents', () => {
    const rows = buildShortcutReference()
    expect(rows.length).toBeGreaterThan(40)

    for (const row of rows) {
      expect(typeof row.id).toBe('string')
      expect(row.id.length).toBeGreaterThan(0)
      expect(typeof row.label).toBe('string')
      expect(row.label.length).toBeGreaterThan(0)
      expect(Array.isArray(row.keys)).toBe(true)
      expect(row.keys.length).toBeGreaterThan(0)
      expect(['tools', 'commands', 'other']).toContain(row.source)
    }
  })

  test('includes every EditorCommandId with a keybinding exactly once', () => {
    const rows = buildShortcutReference()
    const commandRows = rows.filter((r) => r.source === 'commands')

    const boundCommandIds = (Object.keys(EDITOR_COMMAND_METADATA) as EditorCommandId[]).filter(
      (id) => Boolean(EDITOR_COMMAND_METADATA[id].keybinding)
    )

    expect(commandRows.length).toBe(boundCommandIds.length)

    for (const id of boundCommandIds) {
      const matching = commandRows.filter((r) => r.id === id)
      expect(matching.length).toBe(1)
      expect(matching[0].keys.length).toBeGreaterThan(0)
    }

    // Commands without keybindings should not be included in command rows
    const unboundCommandIds = (Object.keys(EDITOR_COMMAND_METADATA) as EditorCommandId[]).filter(
      (id) => !EDITOR_COMMAND_METADATA[id].keybinding
    )
    for (const id of unboundCommandIds) {
      expect(commandRows.some((r) => r.id === id)).toBe(false)
    }
  })

  test('includes every distinct Tool in TOOL_SHORTCUTS exactly once', () => {
    const rows = buildShortcutReference()
    const toolRows = rows.filter((r) => r.source === 'tools')

    const toolCodes = Object.values(TOOL_SHORTCUTS).filter((t): t is Tool => t !== undefined)
    const uniqueTools = Array.from(new Set(toolCodes))

    expect(toolRows.length).toBe(uniqueTools.length)

    for (const tool of uniqueTools) {
      const toolId = `tool-${tool.toLowerCase().replace('_', '-')}`
      const matching = toolRows.filter((r) => r.id === toolId)
      expect(matching.length).toBe(1)
      expect(matching[0].keys.length).toBeGreaterThan(0)
    }

    // Explicit check for SHAPE_BUILDER deduplication (two entries in TOOL_SHORTCUTS)
    const shapeBuilderRows = toolRows.filter((r) => r.id === 'tool-shape-builder')
    expect(shapeBuilderRows.length).toBe(1)
  })

  test('includes all 7 metadata-less hand-written items with non-empty labels', () => {
    const rows = buildShortcutReference()
    const otherRows = rows.filter((r) => r.source === 'other')

    const metadataLessIds = [
      'toggle-ai',
      'toggle-auto-layout',
      'delete-backspace',
      'delete',
      'delete-alt',
      'enter',
      'escape'
    ]

    for (const id of metadataLessIds) {
      const match = otherRows.find((r) => r.id === id)
      expect(match).toBeDefined()
      expect(match?.label.length).toBeGreaterThan(0)
      expect(match?.keys.length).toBeGreaterThan(0)
    }
  })

  test('includes all 15 hand-written entries from registry.ts', () => {
    const rows = buildShortcutReference()
    const otherRows = rows.filter((r) => r.source === 'other')

    const allHandwrittenIds = [
      'export-selection-png',
      'save-as',
      'toggle-ui',
      'toggle-ai',
      'close-tab',
      'new-tab',
      'reopen-closed-tab',
      'save',
      'open-file',
      'toggle-auto-layout',
      'delete-backspace',
      'delete',
      'delete-alt',
      'enter',
      'escape'
    ]

    expect(otherRows.length).toBe(allHandwrittenIds.length)

    for (const id of allHandwrittenIds) {
      const match = otherRows.find((r) => r.id === id)
      expect(match).toBeDefined()
      expect(match?.label.length).toBeGreaterThan(0)
      expect(match?.keys.length).toBeGreaterThan(0)
    }
  })

  test('supports custom message overrides for labels', () => {
    const rows = buildShortcutReference({
      shortcutsToggleAI: 'Custom AI Toggle',
      shortcutsEnter: 'Commit Text'
    })

    const aiRow = rows.find((r) => r.id === 'toggle-ai')
    expect(aiRow?.label).toBe('Custom AI Toggle')

    const enterRow = rows.find((r) => r.id === 'enter')
    expect(enterRow?.label).toBe('Commit Text')
  })
})
