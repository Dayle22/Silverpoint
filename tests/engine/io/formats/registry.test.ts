import { describe, expect, it } from 'bun:test'
import {
  BUILTIN_IO_FORMATS,
  figFormat,
  idmlFormat,
  IORegistry,
  jsxFormat,
  pdfFormat,
  pdfPrintFormat,
  penFormat,
  pptxFormat
} from '#core/io'

describe('IORegistry and builtin format adapters', () => {
  it('registers all builtin format adapters', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)
    const formats = registry.listFormats()
    const ids = formats.map((f) => f.id)

    expect(ids).toEqual([
      'fig',
      'pen',
      'png',
      'jpg',
      'webp',
      'svg',
      'pdf',
      'pdf-print',
      'idml',
      'pptx',
      'jsx'
    ])
  })

  it('lists readable document formats correctly', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)
    const readable = registry.listReadableFormats().map((f) => f.id)
    expect(readable).toEqual(['fig', 'pen', 'pdf', 'idml'])
  })

  it('lists writable document formats correctly', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)
    const writable = registry.listWritableFormats().map((f) => f.id)
    expect(writable).toEqual(['fig'])
  })

  it('lists export formats for each target scope', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)

    const docExport = registry.listExportFormats('document').map((f) => f.id)
    expect(docExport).toContain('fig')
    expect(docExport).toContain('png')
    expect(docExport).toContain('jpg')
    expect(docExport).toContain('webp')
    expect(docExport).toContain('svg')
    expect(docExport).toContain('pdf')
    expect(docExport).toContain('pptx')
    expect(docExport).not.toContain('pdf-print')
    expect(docExport).not.toContain('idml')
    expect(docExport).not.toContain('jsx')

    const pageExport = registry.listExportFormats('page').map((f) => f.id)
    expect(pageExport).toContain('pdf-print')
    expect(pageExport).toContain('idml')
    expect(pageExport).not.toContain('jsx')

    const selExport = registry.listExportFormats('selection').map((f) => f.id)
    expect(selExport).toContain('jsx')
    expect(selExport).toContain('pdf-print')
    expect(selExport).toContain('idml')

    const nodeExport = registry.listExportFormats('node').map((f) => f.id)
    expect(nodeExport).toContain('jsx')
    expect(nodeExport).toContain('pdf-print')
    expect(nodeExport).toContain('idml')
  })

  it('finds reader by file name and mime type', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)

    expect(registry.findReader('design.fig')?.id).toBe('fig')
    expect(registry.findReader('art.pen')?.id).toBe('pen')
    expect(registry.findReader('vector.pdf')?.id).toBe('pdf')
    expect(registry.findReader('doc.idml')?.id).toBe('idml')
    expect(registry.findReader('doc.IDML')?.id).toBe('idml')
    expect(registry.findReader('unknown.xyz')).toBeNull()
  })

  it('retrieves formats by id', () => {
    const registry = new IORegistry(BUILTIN_IO_FORMATS)

    expect(registry.getFormat('fig')).toBe(figFormat)
    expect(registry.getFormat('pen')).toBe(penFormat)
    expect(registry.getFormat('pdf')).toBe(pdfFormat)
    expect(registry.getFormat('pdf-print')).toBe(pdfPrintFormat)
    expect(registry.getFormat('idml')).toBe(idmlFormat)
    expect(registry.getFormat('pptx')).toBe(pptxFormat)
    expect(registry.getFormat('jsx')).toBe(jsxFormat)
    expect(registry.getFormat('nonexistent')).toBeNull()
  })
})
