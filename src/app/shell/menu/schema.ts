import type { EditorCommandId } from '#vue/editor/commands/types'
import { PANEL_IDS } from '@/app/shell/panels/types'

export type AppMenuTarget = 'all' | 'browser' | 'native'

export interface AppMenuActionItem {
  type?: 'item'
  id: string
  label: string
  shortcut?: string
  accelerator?: string
  command?: EditorCommandId
  checkbox?: boolean
  target?: AppMenuTarget
  sub?: AppMenuEntry[]
}

export interface AppMenuSeparatorItem {
  type: 'separator'
  target?: AppMenuTarget
}

export type AppMenuEntry = AppMenuActionItem | AppMenuSeparatorItem

export interface AppMenuGroupSchema {
  label: string
  target?: AppMenuTarget
  items: AppMenuEntry[]
}

const PANEL_MENU_LABELS: Record<(typeof PANEL_IDS)[number], string> = {
  pages: 'Pages',
  history: 'History',
  assets: 'Assets',
  layers: 'Layers',
  swatches: 'Swatches',
  export: 'Export',
  variables: 'Variables',
  ai: 'AI',
  code: 'Code',
  appearance: 'Appearance',
  transform: 'Transform',
  text: 'Text',
  page: 'Page',
  guides: 'Guides',
  mask: 'Mask',
  component: 'Component'
}

export const APP_MENU_SCHEMA = [
  {
    label: 'File',
    items: [
      { id: 'new', label: 'New', shortcut: 'MOD+N' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O' },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'MOD+S' },
      { id: 'save-as', label: 'Save As…', shortcut: 'MOD+SHIFT+S' },
      { type: 'separator' },
      {
        id: 'export-selection',
        label: 'Export Selection',
        shortcut: 'MOD+SHIFT+E',
        sub: [
          { id: 'export-png', label: 'PNG' },
          { id: 'export-jpg', label: 'JPG' },
          { id: 'export-svg', label: 'SVG' },
          { id: 'export-pdf', label: 'PDF' },
          { id: 'export-fig', label: '.fig' }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true },
      { id: 'close', label: 'Close Tab', shortcut: 'MOD+W' }
    ]
  },
  {
    label: 'Edit',
    items: [
      {
        id: 'edit.undo',
        label: 'Undo',
        command: 'edit.undo'
      },
      {
        id: 'edit.redo',
        label: 'Redo',
        command: 'edit.redo'
      },
      { type: 'separator' },
      { id: 'copy', label: 'Copy', shortcut: 'MOD+C' },
      { id: 'cut', label: 'Cut', shortcut: 'MOD+X' },
      { id: 'paste', label: 'Paste', shortcut: 'MOD+V' },
      { id: 'paste-to-replace', label: 'Paste to replace' },
      {
        id: 'selection.duplicate',
        label: 'Duplicate',
        command: 'selection.duplicate'
      },
      {
        id: 'selection.delete',
        label: 'Delete',
        command: 'selection.delete'
      },
      { type: 'separator' },
      {
        id: 'selection.selectAll',
        label: 'Select All',
        command: 'selection.selectAll'
      },
      { id: 'preferences', label: 'Preferences' }
    ]
  },
  {
    label: 'View',
    items: [
      {
        id: 'view.zoom100',
        label: 'Zoom to 100%',
        command: 'view.zoom100'
      },
      {
        id: 'view.zoomFit',
        label: 'Zoom to Fit',
        command: 'view.zoomFit'
      },
      {
        id: 'view.zoomSelection',
        label: 'Zoom to Selection',
        command: 'view.zoomSelection'
      },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'MOD+=' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'MOD+-' },
      { type: 'separator' },
      {
        id: 'theme',
        label: 'Theme',
        sub: [
          { id: 'theme-light', label: 'Light', checkbox: true },
          { id: 'theme-grey', label: 'Grey', checkbox: true },
          { id: 'theme-dark', label: 'Dark', checkbox: true },
          { id: 'theme-midnight', label: 'Midnight', checkbox: true },
          { id: 'theme-auto', label: 'Auto', checkbox: true }
        ]
      },
      {
        id: 'canvas-grid',
        label: 'Canvas Grid',
        sub: [
          { id: 'canvas-grid-toggle', label: 'Show Grid', checkbox: true },
          { id: 'canvas-grid-dots', label: 'Dots', checkbox: true },
          { id: 'canvas-grid-lines', label: 'Lines', checkbox: true }
        ]
      },
      { type: 'separator' },
      { id: 'reset-panel-layout', label: 'Reset Panel Layout' },
      { id: 'capability-simple', label: 'Simple', checkbox: true },
      { id: 'capability-full', label: 'Full', checkbox: true },
      { id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\' },
      { id: 'profiler', label: 'Profiler', checkbox: true, target: 'browser' },
      {
        id: 'dev-tools',
        label: 'Developer Tools',
        accelerator: 'CmdOrCtrl+Alt+I',
        target: 'native'
      }
    ]
  },
  {
    label: 'Object',
    items: [
      {
        id: 'selection.group',
        label: 'Group Selection',
        command: 'selection.group'
      },
      {
        id: 'selection.frameSelection',
        label: 'Frame Selection',
        command: 'selection.frameSelection'
      },
      {
        id: 'selection.ungroup',
        label: 'Ungroup Selection',
        command: 'selection.ungroup'
      },
      { type: 'separator' },
      {
        id: 'selection.toggleMask',
        label: 'Use as Mask',
        command: 'selection.toggleMask'
      },
      { type: 'separator' },
      {
        id: 'selection.booleanUnion',
        label: 'Union selection',
        command: 'selection.booleanUnion'
      },
      {
        id: 'selection.booleanSubtract',
        label: 'Subtract selection',
        command: 'selection.booleanSubtract'
      },
      {
        id: 'selection.booleanIntersect',
        label: 'Intersect selection',
        command: 'selection.booleanIntersect'
      },
      {
        id: 'selection.booleanExclude',
        label: 'Exclude selection',
        command: 'selection.booleanExclude'
      },
      {
        id: 'selection.flatten',
        label: 'Flatten',
        command: 'selection.flatten'
      },
      {
        id: 'selection.outlineText',
        label: 'Outline text',
        command: 'selection.outlineText'
      },
      {
        id: 'selection.outlineStroke',
        label: 'Outline stroke',
        command: 'selection.outlineStroke'
      },
      { type: 'separator' },
      {
        id: 'selection.createComponent',
        label: 'Create Component',
        command: 'selection.createComponent'
      },
      {
        id: 'selection.createComponentSet',
        label: 'Create Component Set',
        command: 'selection.createComponentSet'
      },
      {
        id: 'selection.detachInstance',
        label: 'Detach Instance',
        command: 'selection.detachInstance'
      },
      { type: 'separator' },
      {
        id: 'selection.bringToFront',
        label: 'Bring to Front',
        command: 'selection.bringToFront'
      },
      {
        id: 'selection.sendToBack',
        label: 'Send to Back',
        command: 'selection.sendToBack'
      }
    ]
  },
  {
    label: 'Text',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U' }
    ]
  },
  {
    label: 'Arrange',
    items: [
      {
        id: 'selection.wrapInAutoLayout',
        label: 'Wrap in Auto Layout',
        command: 'selection.wrapInAutoLayout'
      },
      { type: 'separator' },
      { id: 'arrange.align-left', label: 'Align Left', shortcut: 'ALT+A' },
      { id: 'arrange.align-center', label: 'Align Center', shortcut: 'ALT+H' },
      { id: 'arrange.align-right', label: 'Align Right', shortcut: 'ALT+D' },
      { type: 'separator' },
      { id: 'arrange.align-top', label: 'Align Top', shortcut: 'ALT+W' },
      { id: 'arrange.align-middle', label: 'Align Middle', shortcut: 'ALT+V' },
      { id: 'arrange.align-bottom', label: 'Align Bottom', shortcut: 'ALT+S' }
    ]
  },
  {
    label: 'Window',
    items: [
      ...PANEL_IDS.map((id) => ({
        id: `window-panel-${id}`,
        label: PANEL_MENU_LABELS[id],
        checkbox: true
      })),
      { type: 'separator' as const },
      { id: 'reset-panel-layout', label: 'Reset Panel Layout' }
    ]
  }
] satisfies AppMenuGroupSchema[]
