import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  encodeRgbaToPng,
  importPdfPage,
  readPdfSummary
} from '@open-pencil/core/io/formats/pdf'
import { parsePenFile } from '@open-pencil/pen'

function loadFixture(name: string): Uint8Array {
  const filePath = resolve(import.meta.dir, '../../../../tests/fixtures/pdf', name)
  return new Uint8Array(readFileSync(filePath))
}

describe('PDF Import - Stage A & B Engine', () => {
  describe('readPdfSummary', () => {
    it('correctly reports page count and dimensions for simple vector PDF', async () => {
      const data = loadFixture('simple-vector.pdf')
      const summary = await readPdfSummary(data)

      expect(summary.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(summary.pages).toHaveLength(1)
      expect(summary.pages[0].pageNumber).toBe(1)
      expect(summary.pages[0].widthPt).toBe(400)
      expect(summary.pages[0].heightPt).toBe(400)
      expect(summary.pages[0].rotation).toBe(0)
    })

    it('correctly reports page count and dimensions for embedded text PDF', async () => {
      const data = loadFixture('embedded-text.pdf')
      const summary = await readPdfSummary(data)

      expect(summary.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(summary.pages).toHaveLength(1)
      expect(summary.pages[0].widthPt).toBeCloseTo(595.28, 1)
      expect(summary.pages[0].heightPt).toBeCloseTo(841.89, 1)
    })

    it('fails with specific PDF_ENCRYPTED error for encrypted PDF with no bypass attempt', async () => {
      const data = loadFixture('encrypted.pdf')
      const summary = await readPdfSummary(data)

      expect(summary.pages).toHaveLength(0)
      const errorDiag = summary.diagnostics.find((d) => d.code === 'PDF_ENCRYPTED')
      expect(errorDiag).toBeDefined()
      expect(errorDiag?.severity).toBe('error')
      expect(errorDiag?.message).toContain('encrypted')
    })

    it('fails gracefully for malformed PDF without throwing unhandled exception', async () => {
      const data = loadFixture('malformed.pdf')
      const summary = await readPdfSummary(data)

      expect(summary.pages).toHaveLength(0)
      const errorDiag = summary.diagnostics.find((d) => d.code === 'PDF_PARSE_ERROR')
      expect(errorDiag).toBeDefined()
      expect(errorDiag?.severity).toBe('error')
    })

    it('rejects PDFs exceeding 500 pages limit', async () => {
      const data = loadFixture('oversized-page-count.pdf')
      const summary = await readPdfSummary(data)

      expect(summary.pages).toHaveLength(0)
      const errorDiag = summary.diagnostics.find((d) => d.code === 'PDF_PAGE_COUNT_EXCEEDED')
      expect(errorDiag).toBeDefined()
      expect(errorDiag?.severity).toBe('error')
      expect(errorDiag?.message).toContain('500')
    })

    it('rejects page dimensions exceeding 14400 pt limit', async () => {
      const data = loadFixture('oversized-dimensions.pdf')
      const summary = await readPdfSummary(data)

      const errorDiag = summary.diagnostics.find((d) => d.code === 'PDF_PAGE_DIMENSIONS_EXCEEDED')
      expect(errorDiag).toBeDefined()
      expect(errorDiag?.severity).toBe('error')
      expect(errorDiag?.message).toContain('14400')
    })

    it('handles empty input gracefully', async () => {
      const summary = await readPdfSummary(new Uint8Array(0))
      expect(summary.pages).toHaveLength(0)
      expect(summary.diagnostics[0]?.code).toBe('PDF_EMPTY_FILE')
    })
  })

  describe('importPdfPage (Stage A & B)', () => {
    it('creates a FRAME matching page dimensions and extracts native vector graphics', async () => {
      const data = loadFixture('simple-vector.pdf')
      const result = await importPdfPage(data, 1, { fileName: 'simple-vector.pdf' })

      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const page = result.graph.getPages()[0]
      expect(page).toBeDefined()

      const children = result.graph.getChildren(page.id)
      expect(children.length).toBeGreaterThanOrEqual(1)

      const frame = children[0]
      expect(frame.type).toBe('FRAME')
      expect(frame.width).toBe(400)
      expect(frame.height).toBe(400)
      expect(frame.name).toBe('simple-vector - Page 1')

      // Check extracted vector or rectangle nodes
      const frameChildren = result.graph.getChildren(frame.id)
      const vectorNodes = frameChildren.filter((n) => n.type === 'VECTOR' || n.type === 'RECTANGLE')
      expect(vectorNodes.length).toBeGreaterThan(0)

      const stageBDiag = result.diagnostics.find((d) => d.code === 'STAGE_B_NATIVE_VECTORS')
      expect(stageBDiag).toBeDefined()
      expect(stageBDiag?.severity).toBe('info')
    })

    it('extracts editable TEXT nodes for resolvable font fixture', async () => {
      const data = loadFixture('embedded-text.pdf')
      const result = await importPdfPage(data, 1, { fileName: 'embedded-text.pdf' })

      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const page = result.graph.getPages()[0]
      const frame = result.graph.getChildren(page.id)[0]
      expect(frame.type).toBe('FRAME')

      const textNodes = result.graph.getChildren(frame.id).filter((n) => n.type === 'TEXT')
      expect(textNodes.length).toBeGreaterThanOrEqual(2)

      const textContents = textNodes.map((t) => t.text)
      expect(textContents.some((t) => t.includes('Heading Text'))).toBe(true)
      expect(textContents.some((t) => t.includes('Standard body paragraph text'))).toBe(true)

      for (const textNode of textNodes) {
        expect(textNode.fontFamily).toBe('Inter')
        expect(textNode.fontSize).toBeGreaterThan(0)
        expect(textNode.width).toBeGreaterThan(0)
        expect(textNode.height).toBeGreaterThan(0)
      }
    })

    it('emits a warning diagnostic for unusual unresolvable font fixture', async () => {
      const data = loadFixture('unusual-font.pdf')
      const result = await importPdfPage(data, 1, { fileName: 'unusual-font.pdf' })

      const fontDiag = result.diagnostics.find((d) => d.code === 'UNRESOLVED_FONT')
      expect(fontDiag).toBeDefined()
      expect(fontDiag?.severity).toBe('warning')
      expect(fontDiag?.detail).toContain('CustomExoticFont')

      const page = result.graph.getPages()[0]
      const frame = result.graph.getChildren(page.id)[0]
      const textNodes = result.graph.getChildren(frame.id).filter((n) => n.type === 'TEXT')
      expect(textNodes.length).toBeGreaterThanOrEqual(1)
      expect(textNodes[0].text).toBe('Unusual Font Text')
    })

    it('extracts image XObjects with PNG registration from raster-image fixture', async () => {
      const data = loadFixture('raster-image.pdf')
      const result = await importPdfPage(data, 1, { fileName: 'raster-image.pdf' })

      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const page = result.graph.getPages()[0]
      const frame = result.graph.getChildren(page.id)[0]
      const frameChildren = result.graph.getChildren(frame.id)

      const imageNodes = frameChildren.filter((n) =>
        n.fills.some((f) => f.type === 'IMAGE')
      )
      expect(imageNodes.length).toBeGreaterThanOrEqual(1)
      expect(result.graph.images.size).toBeGreaterThanOrEqual(1)
    })

    it('rejects invalid page number request', async () => {
      const data = loadFixture('simple-vector.pdf')
      const result = await importPdfPage(data, 99)

      expect(result.diagnostics.some((d) => d.code === 'PDF_INVALID_PAGE_NUMBER')).toBe(true)
    })

    it('rejects encrypted PDF on import attempt without crashing', async () => {
      const data = loadFixture('encrypted.pdf')
      const result = await importPdfPage(data, 1)

      expect(result.diagnostics.some((d) => d.code === 'PDF_ENCRYPTED')).toBe(true)
    })
  })

  describe('Stage B Vector & PNG Utilities', () => {
    it('encodes RGBA pixel buffer into valid PNG binary', () => {
      const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
      const png = encodeRgbaToPng(2, 2, rgba)

      expect(png.length).toBeGreaterThan(50)
      // Check PNG signature bytes
      expect(png[0]).toBe(0x89)
      expect(png[1]).toBe(0x50) // 'P'
      expect(png[2]).toBe(0x4e) // 'N'
      expect(png[3]).toBe(0x47) // 'G'
    })
  })

  describe('Round-trip and Export Isolation', () => {
    it('imported PDF content can be serialized to .fig format and recovered unchanged', async () => {
      const { initCodec, exportFigFile, parseFigFile } = await import('@open-pencil/core')
      await initCodec()

      const data = loadFixture('simple-vector.pdf')
      const { graph } = await importPdfPage(data, 1, { fileName: 'simple-vector.pdf' })

      const page = graph.getPages()[0]
      const frame = graph.getChildren(page.id)[0]
      const vectorNodes = graph.getChildren(frame.id).filter((n) => n.type === 'VECTOR' || n.type === 'RECTANGLE')
      expect(vectorNodes.length).toBeGreaterThan(0)

      const figBytes = await exportFigFile(graph)
      const restored = await parseFigFile(figBytes.buffer as ArrayBuffer)

      const restoredPage = restored.getPages()[0]
      expect(restoredPage).toBeDefined()

      const restoredFrame = [...restored.getAllNodes()].find((n) => n.name === frame.name)
      expect(restoredFrame).toBeDefined()
      expect(restoredFrame?.width).toBeCloseTo(frame.width, 1)
      expect(restoredFrame?.height).toBeCloseTo(frame.height, 1)

      const restoredFrameId = restoredFrame?.id ?? ''
      const restoredVectors = restoredFrameId
        ? restored.getChildren(restoredFrameId).filter((n) => n.type === 'VECTOR' || n.type === 'RECTANGLE')
        : []
      expect(restoredVectors.length).toBe(vectorNodes.length)
    })

    it('unrelated pen fixture parses and operates identically without export pollution', async () => {
      const penPath = resolve(import.meta.dir, '../../../../tests/fixtures/pencil_button.pen')
      const penText = readFileSync(penPath, 'utf8')
      const graph = parsePenFile(penText)

      expect(graph).toBeDefined()
      expect(graph.getPages().length).toBeGreaterThan(0)
    })
  })
})
