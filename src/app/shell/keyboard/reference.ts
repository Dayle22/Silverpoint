import {
  EDITOR_COMMAND_METADATA,
  editorCommandMetadata,
  formatShortcut,
  type EditorCommandId
} from '@open-pencil/vue'
import { EDITOR_TOOLS, TOOL_SHORTCUTS, type Tool } from '@open-pencil/core/editor'

export type ShortcutSource = 'tools' | 'commands' | 'other'

export interface ShortcutReferenceRow {
  id: string
  label: string
  keys: string[]
  source: ShortcutSource
}

export interface ShortcutReferenceGroup {
  source: ShortcutSource
  label: string
  rows: ShortcutReferenceRow[]
}

export interface ShortcutReferenceMessages {
  preferencesShortcutsTools?: string
  preferencesShortcutsCommands?: string
  preferencesShortcutsOther?: string
  newTab?: string
  shortcutsToggleAI?: string
  shortcutsToggleAutoLayout?: string
  shortcutsDeleteBackspace?: string
  shortcutsDelete?: string
  shortcutsDeleteAlt?: string
  shortcutsEnter?: string
  shortcutsEscape?: string
  shortcutsReopenClosedTab?: string
  [key: string]: unknown
}

const COMMAND_LABELS: Record<EditorCommandId, string> = {
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'selection.selectAll': 'Select all',
  'selection.duplicate': 'Duplicate',
  'selection.delete': 'Delete',
  'selection.group': 'Group selection',
  'selection.frameSelection': 'Frame selection',
  'selection.ungroup': 'Ungroup selection',
  'selection.createComponent': 'Create component',
  'selection.createComponentSet': 'Create component set',
  'selection.detachInstance': 'Detach instance',
  'selection.goToMainComponent': 'Go to main component',
  'selection.createInstance': 'Create instance',
  'selection.wrapInAutoLayout': 'Add auto layout',
  'selection.toggleMask': 'Use as mask',
  'selection.bringToFront': 'Bring to front',
  'selection.sendToBack': 'Send to back',
  'selection.toggleVisibility': 'Show / Hide',
  'selection.toggleLock': 'Lock / Unlock',
  'selection.flipHorizontal': 'Flip horizontal',
  'selection.flipVertical': 'Flip vertical',
  'selection.booleanUnion': 'Union selection',
  'selection.booleanSubtract': 'Subtract selection',
  'selection.booleanIntersect': 'Intersect selection',
  'selection.booleanExclude': 'Exclude selection',
  'selection.flatten': 'Flatten',
  'selection.outlineText': 'Outline text',
  'selection.outlineStroke': 'Outline stroke',
  'selection.moveToPage': 'Move to page',
  'view.zoom100': 'Zoom to 100%',
  'view.zoomFit': 'Zoom to fit',
  'view.zoomSelection': 'Zoom to selection'
}

const TOOL_DEFAULTS: Record<Tool, { label: string; shortcut: string }> = {
  SELECT: { label: 'Move', shortcut: 'V' },
  FRAME: { label: 'Frame', shortcut: 'F' },
  SECTION: { label: 'Section', shortcut: 'Shift+S' },
  SLICE: { label: 'Slice', shortcut: 'S' },
  RECTANGLE: { label: 'Rectangle', shortcut: 'R' },
  ELLIPSE: { label: 'Ellipse', shortcut: 'O' },
  LINE: { label: 'Line', shortcut: 'L' },
  POLYGON: { label: 'Polygon', shortcut: '' },
  STAR: { label: 'Star', shortcut: '' },
  PEN: { label: 'Pen', shortcut: 'P' },
  PENCIL: { label: 'Pencil', shortcut: 'N' },
  BRUSH: { label: 'Brush', shortcut: 'B' },
  TEXT: { label: 'Text', shortcut: 'T' },
  HAND: { label: 'Hand', shortcut: 'H' },
  SHAPE_BUILDER: { label: 'Shape Builder', shortcut: 'Shift+M' },
  BARCODE: { label: 'QR Code', shortcut: '' },
  BARCODE_EAN13: { label: 'EAN-13 Barcode', shortcut: '' }
}

interface HandwrittenEntryDef {
  id: string
  label: (messages?: ShortcutReferenceMessages) => string
  keys: () => string[]
}

function shortcutDisplay(token: string): string[] {
  const formatted = formatShortcut(token)
  return formatted ? [formatted] : []
}

function shortcutDisplays(...tokens: string[]): string[] {
  const result: string[] = []
  for (const token of tokens) {
    const formatted = formatShortcut(token)
    if (formatted) result.push(formatted)
  }
  return result
}

const HANDWRITTEN_ENTRIES: HandwrittenEntryDef[] = [
  {
    id: 'export-selection-png',
    label: () => 'Export Selection',
    keys: () => shortcutDisplay('MOD+SHIFT+E')
  },
  {
    id: 'save-as',
    label: () => 'Save As…',
    keys: () => shortcutDisplay('MOD+SHIFT+S')
  },
  {
    id: 'toggle-ui',
    label: () => 'Toggle UI',
    keys: () => shortcutDisplay('MOD+\\')
  },
  {
    id: 'toggle-ai',
    label: (m) => (typeof m?.shortcutsToggleAI === 'string' ? m.shortcutsToggleAI : 'Toggle AI'),
    keys: () => shortcutDisplay('MOD+J')
  },
  {
    id: 'close-tab',
    label: () => 'Close Tab',
    keys: () => shortcutDisplay('MOD+W')
  },
  {
    id: 'new-tab',
    label: (m) => (typeof m?.newTab === 'string' ? m.newTab : 'New tab'),
    keys: () => shortcutDisplays('MOD+N', 'MOD+T')
  },
  {
    id: 'reopen-closed-tab',
    label: (m) =>
      typeof m?.shortcutsReopenClosedTab === 'string'
        ? m.shortcutsReopenClosedTab
        : 'Reopen closed tab',
    keys: () => shortcutDisplay('MOD+SHIFT+T')
  },
  {
    id: 'save',
    label: () => 'Save',
    keys: () => shortcutDisplay('MOD+S')
  },
  {
    id: 'open-file',
    label: () => 'Open…',
    keys: () => shortcutDisplay('MOD+O')
  },
  {
    id: 'toggle-auto-layout',
    label: (m) =>
      typeof m?.shortcutsToggleAutoLayout === 'string'
        ? m.shortcutsToggleAutoLayout
        : 'Toggle auto layout',
    keys: () => shortcutDisplay('SHIFT+A')
  },
  {
    id: 'delete-backspace',
    label: (m) =>
      typeof m?.shortcutsDeleteBackspace === 'string' ? m.shortcutsDeleteBackspace : 'Delete',
    keys: () => ['Backspace']
  },
  {
    id: 'delete',
    label: (m) =>
      typeof m?.shortcutsDelete === 'string' ? m.shortcutsDelete : 'Delete forward',
    keys: () => ['Delete']
  },
  {
    id: 'delete-alt',
    label: (m) =>
      typeof m?.shortcutsDeleteAlt === 'string'
        ? m.shortcutsDeleteAlt
        : 'Delete (skip reflow)',
    keys: () => shortcutDisplay('ALT+Delete')
  },
  {
    id: 'enter',
    label: (m) =>
      typeof m?.shortcutsEnter === 'string' ? m.shortcutsEnter : 'Confirm or edit text',
    keys: () => ['Enter']
  },
  {
    id: 'escape',
    label: (m) =>
      typeof m?.shortcutsEscape === 'string' ? m.shortcutsEscape : 'Deselect or cancel',
    keys: () => ['Escape']
  }
]

function getCommandDisplayKeys(id: EditorCommandId): string[] {
  const meta = editorCommandMetadata(id)
  if (meta.shortcut) {
    return shortcutDisplay(meta.shortcut)
  }
  if (id === 'view.zoom100') {
    return shortcutDisplay('MOD+0')
  }
  if (id === 'view.zoomFit') {
    return shortcutDisplay('MOD+1')
  }
  if (id === 'view.zoomSelection') {
    return shortcutDisplay('MOD+2')
  }
  if (Array.isArray(meta.keybinding)) {
    const result: string[] = []
    for (const k of meta.keybinding) {
      const formatted = formatShortcut(k) ?? k
      if (formatted) result.push(formatted)
    }
    return result
  }
  if (meta.keybinding) {
    const formatted = formatShortcut(meta.keybinding) ?? meta.keybinding
    return [formatted]
  }
  return []
}

export function buildShortcutReference(
  messages?: ShortcutReferenceMessages
): ShortcutReferenceRow[] {
  const rows: ShortcutReferenceRow[] = []

  // 1. Tools from TOOL_SHORTCUTS deduplicated by Tool
  const toolCodes = Object.values(TOOL_SHORTCUTS).filter((t): t is Tool => t !== undefined)
  const uniqueTools = Array.from(new Set(toolCodes))
  for (const tool of uniqueTools) {
    const registeredTool = EDITOR_TOOLS.find((t) => t.key === tool)
    const label = registeredTool?.label ?? TOOL_DEFAULTS[tool].label
    const rawShortcut = registeredTool?.shortcut || TOOL_DEFAULTS[tool].shortcut || ''
    const formatted = formatShortcut(rawShortcut) ?? rawShortcut
    rows.push({
      id: `tool-${tool.toLowerCase().replace('_', '-')}`,
      label,
      keys: formatted ? [formatted] : [],
      source: 'tools'
    })
  }

  // 2. Bound commands from EDITOR_COMMAND_METADATA
  const commandIds = Object.keys(EDITOR_COMMAND_METADATA) as EditorCommandId[]
  for (const commandId of commandIds) {
    const meta = editorCommandMetadata(commandId)
    if (!meta.keybinding) continue
    const keys = getCommandDisplayKeys(commandId)
    rows.push({
      id: commandId,
      label: COMMAND_LABELS[commandId] ?? commandId,
      keys,
      source: 'commands'
    })
  }

  // 3. 15 hand-written entries from registry.ts
  for (const entry of HANDWRITTEN_ENTRIES) {
    rows.push({
      id: entry.id,
      label: entry.label(messages),
      keys: entry.keys(),
      source: 'other'
    })
  }

  return rows
}
