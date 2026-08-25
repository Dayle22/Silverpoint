const preferencesDialogTheme = {
  slots: {
    header: 'flex items-center justify-between border-b border-border px-4 py-3',
    headerTitle: 'text-sm font-semibold text-surface',
    headerDescription: 'mt-0.5 text-[11px] text-muted',
    closeButton:
      'flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface',
    body: 'flex min-h-0 flex-1 overflow-hidden',
    sidebar: 'flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2',
    tabTrigger:
      'flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-left text-xs text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-[state=active]:bg-panel-selected-muted data-[state=active]:text-surface data-[state=active]:hover:bg-panel-selected-muted',
    tabIcon: 'size-3.5 shrink-0',
    panel: 'min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs',
    section: 'space-y-2',
    sectionTitle: 'font-semibold text-surface',
    row: 'flex items-center justify-between gap-4',
    rowLabel: 'text-muted',
    unit: '-ml-2 text-muted',
    hint: 'text-[11px] text-muted',
    warning: 'text-[11px] text-amber-500',
    capabilityValue: 'text-muted',
    capabilityWarning: 'text-amber-500',
    capabilityOk: 'text-emerald-500',
    footer: 'flex items-center justify-between border-t border-border px-4 py-3',
    resetButton: 'rounded px-2 py-1 text-xs text-muted hover:bg-hover hover:text-surface',
    doneButton: 'rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90',
    numberInput:
      'w-24 rounded border border-border bg-input px-2 py-1 text-right text-surface',
    colourInput: 'size-7 cursor-pointer rounded border border-border bg-input'
  }
} as const

export type PreferencesDialogTheme = typeof preferencesDialogTheme
export default preferencesDialogTheme
