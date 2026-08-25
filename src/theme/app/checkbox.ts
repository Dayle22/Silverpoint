const appCheckboxTheme = {
  slots: {
    root: [
      'flex size-4 shrink-0 items-center justify-center rounded border border-border bg-input',
      'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
      'outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
    ],
    indicator: 'flex items-center justify-center text-white'
  }
}

export type AppCheckboxTheme = typeof appCheckboxTheme
export default appCheckboxTheme
