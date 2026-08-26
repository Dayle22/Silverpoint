export const IDML_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
export const IDML_MAX_PAGE_COUNT = 200
export const IDML_MAX_ITEMS = 20000
export const IDML_MAX_DIMENSION_PX = 100000

export type IdmlDiagnosticSeverity = 'info' | 'warning' | 'error'

export interface IdmlImportDiagnostic {
  severity: IdmlDiagnosticSeverity
  code: string
  message: string
  pageNumber?: number
  detail?: string
}

export interface IdmlPageSummary {
  pageNumber: number
  widthPt: number
  heightPt: number
}

export interface ImportIdmlOptions {
  fileName?: string
  documentDpi?: number
}

export const STANDARD_FONTS = new Set([
  'inter',
  'helvetica',
  'arial',
  'times',
  'times new roman',
  'courier',
  'courier new',
  'roboto',
  'sans-serif',
  'serif',
  'monospace'
])
