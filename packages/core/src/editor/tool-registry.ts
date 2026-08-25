import type { Tool } from './types'

export interface EditorToolDef {
  key: Tool
  label: string
  shortcut: string
  flyout?: Tool[]
}

export const EDITOR_TOOLS: EditorToolDef[] = [
  { key: 'SELECT', label: 'Move', shortcut: 'V' },
  { key: 'FRAME', label: 'Frame', shortcut: 'F', flyout: ['FRAME', 'SECTION', 'SLICE'] },
  {
    key: 'RECTANGLE',
    label: 'Rectangle',
    shortcut: 'R',
    flyout: ['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR']
  },
  { key: 'PEN', label: 'Pen', shortcut: 'P', flyout: ['PEN', 'PENCIL', 'BRUSH'] },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  { key: 'BARCODE', label: 'Barcode', shortcut: '', flyout: ['BARCODE', 'BARCODE_EAN13'] },
  { key: 'HAND', label: 'Hand', shortcut: 'H' },
  { key: 'SHAPE_BUILDER', label: 'Shape Builder', shortcut: 'Shift+M' }
]

export const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
  KeyV: 'SELECT',
  KeyF: 'FRAME',
  KeyS: 'SLICE',
  KeyR: 'RECTANGLE',
  KeyO: 'ELLIPSE',
  KeyL: 'LINE',
  KeyT: 'TEXT',
  KeyP: 'PEN',
  KeyN: 'PENCIL',
  KeyB: 'BRUSH',
  KeyH: 'HAND',
  'Shift+KeyM': 'SHAPE_BUILDER',
  KeyM: 'SHAPE_BUILDER'
}
