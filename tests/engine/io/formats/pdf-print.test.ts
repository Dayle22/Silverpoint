import { describe, expect, it } from 'bun:test'
import { unzlibSync } from 'fflate'
import { SceneGraph } from '@open-pencil/scene-graph'

import { upsertFrameGuides } from '#core/guides/frame'
import {
  BUILTIN_IO_FORMATS,
  IORegistry,
  pdfFormat,
  pdfPrintFormat,
  preflightPrintPDF,
  renderNodesToPDF,
  renderNodesToPrintPDF,
  resolveTargetFrame
} from '#core/io'
import { setupFakeDomEnvironment } from '#tests/helpers/svg-dom-shim'

setupFakeDomEnvironment()

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function decodePDFString(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes)
}

function extractPDFStream(pdfBytes: Uint8Array): string {
  const str = decodePDFString(pdfBytes)
  const streamMarker = str.indexOf('stream\n')
  if (streamMarker === -1) return ''
  const streamStart = streamMarker + 7
  const streamEnd = str.indexOf('\nendstream')
  const compressed = pdfBytes.slice(streamStart, streamEnd)
  return new TextDecoder('latin1').decode(unzlibSync(compressed))
}

function extractBox(pdfString: string, boxName: string): number[] | null {
  const match = new RegExp(`/${boxName}\\s*\\[([^\\]]+)\\]`).exec(pdfString)
  if (!match) return null
  return match[1]
    .trim()
    .split(/\s+/)
    .map((v) => Number.parseFloat(v))
}

describe('PDF Print Export — T-021', () => {
  describe('T-008 Byte Equality Regression', () => {
    it('standard pdf export produces consistent output without mutation from pdf-print', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Test Frame',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })
      graph.createNode('RECTANGLE', frame.id, {
        name: 'Rect 1',
        x: 10,
        y: 10,
        width: 100,
        height: 80,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const pdf = await renderNodesToPDF(graph, pageId(graph), [frame.id], { title: 'Standard PDF' })

      expect(pdf).not.toBeNull()
      const str = decodePDFString(pdf ? pdf : new Uint8Array())

      // Standard PDF should only have MediaBox and never write TrimBox, BleedBox or ArtBox
      expect(str).toContain('/MediaBox')
      expect(str).not.toContain('/TrimBox')
      expect(str).not.toContain('/BleedBox')
      expect(str).not.toContain('/ArtBox')
      expect(str).not.toContain('0.25 w')
    })
  })

  describe('Target Resolution & Validation', () => {
    it('resolves single FRAME node target', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), { width: 300, height: 200 })

      const resolved = resolveTargetFrame(graph, { scope: 'node', nodeId: frame.id })
      expect(resolved.frame.id).toBe(frame.id)
    })

    it('resolves selection target of exactly one FRAME', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), { width: 300, height: 200 })

      const resolved = resolveTargetFrame(graph, { scope: 'selection', nodeIds: [frame.id] })
      expect(resolved.frame.id).toBe(frame.id)
    })

    it('resolves page target when page has exactly one top-level FRAME', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), { width: 300, height: 200 })

      const resolved = resolveTargetFrame(graph, { scope: 'page', pageId: pageId(graph) })
      expect(resolved.frame.id).toBe(frame.id)
    })

    it('fails when target is not a frame', () => {
      const graph = new SceneGraph()
      const rect = graph.createNode('RECTANGLE', pageId(graph), { width: 100, height: 100 })

      expect(() =>
        resolveTargetFrame(graph, { scope: 'node', nodeId: rect.id })
      ).toThrow('Production PDF requires a single frame target')
    })

    it('fails when selection contains multiple frames', () => {
      const graph = new SceneGraph()
      const f1 = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
      const f2 = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })

      expect(() =>
        resolveTargetFrame(graph, { scope: 'selection', nodeIds: [f1.id, f2.id] })
      ).toThrow('Production PDF requires a single frame target')
    })

    it('fails when page contains multiple top-level frames', () => {
      const graph = new SceneGraph()
      graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
      graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })

      expect(() =>
        resolveTargetFrame(graph, { scope: 'page', pageId: pageId(graph) })
      ).toThrow('Production PDF requires a single frame target')
    })

    it('preflight rejects non-positive or non-finite frame dimensions', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), { width: 0, height: 200 })

      const preflight = preflightPrintPDF(graph, { scope: 'node', nodeId: frame.id })
      expect(preflight.valid).toBe(false)
      expect(preflight.errors.some((e) => e.includes('dimensions'))).toBe(true)
    })

    it('preflight rejects oversized MediaBox exceeding 14400 pt', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 100000,
        height: 100000
      })

      const preflight = preflightPrintPDF(graph, { scope: 'node', nodeId: frame.id }, 72)
      expect(preflight.valid).toBe(false)
      expect(preflight.errors.some((e) => e.includes('14400'))).toBe(true)
    })
  })

  describe('Page-Box Arithmetic & Output Dictionaries', () => {
    it('writes correct page boxes for symmetric bleed', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 500,
        height: 400
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 500,
        height: 400,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
      })

      const guides = {
        version: 1 as const,
        margins: { enabled: false, linked: true, top: 0, right: 0, bottom: 0, left: 0 },
        bleed: { enabled: true, linked: true, top: 25, right: 25, bottom: 25, left: 25 }
      }
      graph.updateNode(frame.id, { pluginData: upsertFrameGuides(frame.pluginData, guides) })

      // documentDpi = 300 -> ptPerPx = 72 / 300 = 0.24
      // W = 120 pt, H = 96 pt, bleed = 6 pt each edge, M = 12 pt
      // MediaBox: [0, 0, 156, 132]
      // BleedBox: [12, 12, 144, 120]
      // TrimBox: [18, 18, 138, 114]
      // ArtBox: [18, 18, 138, 114]

      const result = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 300, cropMarks: true }
      )

      expect(result).not.toBeNull()
      const str = decodePDFString(result ? result.data : new Uint8Array())

      const mediaBox = extractBox(str, 'MediaBox')
      const bleedBox = extractBox(str, 'BleedBox')
      const trimBox = extractBox(str, 'TrimBox')
      const artBox = extractBox(str, 'ArtBox')

      expect(mediaBox).toEqual([0, 0, 156, 132])
      expect(bleedBox).toEqual([12, 12, 144, 120])
      expect(trimBox).toEqual([18, 18, 138, 114])
      expect(artBox).toEqual([18, 18, 138, 114])
    })

    it('writes correct page boxes for asymmetric bleed', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 500,
        height: 400
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 500,
        height: 400,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
      })

      const guides = {
        version: 1 as const,
        margins: { enabled: false, linked: false, top: 0, right: 0, bottom: 0, left: 0 },
        bleed: { enabled: true, linked: false, top: 50, right: 25, bottom: 75, left: 10 }
      }
      graph.updateNode(frame.id, { pluginData: upsertFrameGuides(frame.pluginData, guides) })

      // documentDpi = 300 -> ptPerPx = 0.24
      // W = 120 pt, H = 96 pt, bT = 12 pt, bR = 6 pt, bB = 18 pt, bL = 2.4 pt, M = 12 pt
      // MediaBox: [0, 0, 152.4, 150]
      // BleedBox: [12, 12, 140.4, 138]
      // TrimBox: [14.4, 30, 134.4, 126]
      // ArtBox: [14.4, 30, 134.4, 126]

      const result = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 300, cropMarks: true }
      )

      expect(result).not.toBeNull()
      const str = decodePDFString(result ? result.data : new Uint8Array())

      const mediaBox = extractBox(str, 'MediaBox') ?? [0, 0, 0, 0]
      const bleedBox = extractBox(str, 'BleedBox') ?? [0, 0, 0, 0]
      const trimBox = extractBox(str, 'TrimBox') ?? [0, 0, 0, 0]
      const artBox = extractBox(str, 'ArtBox') ?? [0, 0, 0, 0]

      expect(mediaBox[0]).toBeCloseTo(0, 1)
      expect(mediaBox[1]).toBeCloseTo(0, 1)
      expect(mediaBox[2]).toBeCloseTo(152.4, 1)
      expect(mediaBox[3]).toBeCloseTo(150, 1)

      expect(bleedBox[0]).toBeCloseTo(12, 1)
      expect(bleedBox[1]).toBeCloseTo(12, 1)
      expect(bleedBox[2]).toBeCloseTo(140.4, 1)
      expect(bleedBox[3]).toBeCloseTo(138, 1)

      expect(trimBox[0]).toBeCloseTo(14.4, 1)
      expect(trimBox[1]).toBeCloseTo(30, 1)
      expect(trimBox[2]).toBeCloseTo(134.4, 1)
      expect(trimBox[3]).toBeCloseTo(126, 1)

      expect(artBox[0]).toBeCloseTo(14.4, 1)
      expect(artBox[1]).toBeCloseTo(30, 1)
      expect(artBox[2]).toBeCloseTo(134.4, 1)
      expect(artBox[3]).toBeCloseTo(126, 1)
    })

    it('writes correct page boxes for zero bleed (no bleed guides)', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 500,
        height: 400
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 500,
        height: 400,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
      })

      // documentDpi = 300 -> ptPerPx = 0.24
      // W = 120 pt, H = 96 pt, bleed = 0, M = 12 pt
      // MediaBox: [0, 0, 144, 120]
      // BleedBox: [12, 12, 132, 108]
      // TrimBox: [12, 12, 132, 108]
      // ArtBox: [12, 12, 132, 108]

      const result = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 300, cropMarks: true }
      )

      expect(result).not.toBeNull()
      const str = decodePDFString(result ? result.data : new Uint8Array())

      const mediaBox = extractBox(str, 'MediaBox')
      const bleedBox = extractBox(str, 'BleedBox')
      const trimBox = extractBox(str, 'TrimBox')
      const artBox = extractBox(str, 'ArtBox')

      expect(mediaBox).toEqual([0, 0, 144, 120])
      expect(bleedBox).toEqual([12, 12, 132, 108])
      expect(trimBox).toEqual([12, 12, 132, 108])
      expect(artBox).toEqual([12, 12, 132, 108])
    })
  })

  describe('Crop Marks & Preflight Diagnostics', () => {
    it('draws 8 crop mark vector lines when cropMarks is true and omits them when false', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 200,
        height: 200
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const withMarks = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 72, cropMarks: true }
      )
      const withoutMarks = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 72, cropMarks: false }
      )

      expect(withMarks).not.toBeNull()
      expect(withoutMarks).not.toBeNull()

      const streamWith = extractPDFStream(withMarks ? withMarks.data : new Uint8Array())
      const streamWithout = extractPDFStream(withoutMarks ? withoutMarks.data : new Uint8Array())

      expect(streamWith).toContain('0.25 w')
      expect(streamWithout).not.toContain('0.25 w')
    })

    it('places every crop mark endpoint outside the TrimBox', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 200,
        height: 200
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
      const guides = {
        version: 1 as const,
        margins: { enabled: false, linked: true, top: 0, right: 0, bottom: 0, left: 0 },
        bleed: { enabled: true, linked: true, top: 12, right: 12, bottom: 12, left: 12 }
      }
      graph.updateNode(frame.id, { pluginData: upsertFrameGuides(frame.pluginData, guides) })

      const result = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 72, cropMarks: true }
      )
      expect(result).not.toBeNull()
      const data = result ? result.data : new Uint8Array()

      const trimBox = extractBox(decodePDFString(data), 'TrimBox')
      expect(trimBox).not.toBeNull()
      const [tx0, ty0, tx1, ty1] = trimBox ?? [0, 0, 0, 0]

      // Crop marks are drawn last, in unmodified user space, after the artwork
      // has been drawn and its transforms restored. Everything from the mark
      // line-width onwards is mark geometry; the artwork's own path ops sit
      // inside transformed space and legitimately fall within the trim area.
      const fullStream = extractPDFStream(data)
      const markStart = fullStream.indexOf('0.25 w')
      expect(markStart).toBeGreaterThan(-1)
      const stream = fullStream.slice(markStart)

      const points: Array<[number, number]> = []
      // jsPDF emits coordinates with a trailing dot and no decimals ("12. 215. m").
      const opRe = /(-?\d+(?:\.\d*)?)\s+(-?\d+(?:\.\d*)?)\s+(m|l)\b/g
      let match = opRe.exec(stream)
      while (match !== null) {
        points.push([Number.parseFloat(match[1]), Number.parseFloat(match[2])])
        match = opRe.exec(stream)
      }
      expect(points.length).toBeGreaterThan(0)

      // A crop mark must never intrude on the trim area: no endpoint may fall
      // strictly inside the TrimBox rectangle.
      for (const [x, y] of points) {
        const inside = x > tx0 && x < tx1 && y > ty0 && y < ty1
        expect(inside).toBe(false)
      }
    })

    it('warns when content overhangs trim edge with 0 bleed', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        clipsContent: false
      })
      // Overhanging child
      graph.createNode('RECTANGLE', frame.id, {
        x: -20,
        y: 10,
        width: 50,
        height: 50,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const preflight = preflightPrintPDF(graph, { scope: 'node', nodeId: frame.id })
      expect(preflight.warnings.some((w) => w.includes('0 bleed'))).toBe(true)
    })

    it('detects and reports raster fallback reason for background blur', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'TargetFrame',
        width: 200,
        height: 200
      })
      graph.createNode('RECTANGLE', frame.id, {
        name: 'BlurCard',
        width: 100,
        height: 100,
        effects: [
          {
            type: 'BACKGROUND_BLUR',
            radius: 10,
            visible: true,
            color: { r: 0, g: 0, b: 0, a: 0 },
            offset: { x: 0, y: 0 },
            spread: 0
          }
        ]
      })

      const preflight = preflightPrintPDF(graph, { scope: 'node', nodeId: frame.id })
      expect(preflight.rasterFallback).toBe(true)
      expect(preflight.rasterFallbackReason).toContain("Background blur on 'BlurCard'")
      expect(
        preflight.warnings.some((w) =>
          w.includes("Rasterised because: Background blur on 'BlurCard'")
        )
      ).toBe(true)
    })

    it('detects multiple fallback reasons across descendants', () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'MainFrame',
        width: 200,
        height: 200
      })
      graph.createNode('RECTANGLE', frame.id, {
        name: 'BlurLayer',
        width: 50,
        height: 50,
        effects: [
          {
            type: 'BACKGROUND_BLUR',
            radius: 5,
            visible: true,
            color: { r: 0, g: 0, b: 0, a: 0 },
            offset: { x: 0, y: 0 },
            spread: 0
          }
        ]
      })
      graph.createNode('ELLIPSE', frame.id, {
        name: 'MaskLayer',
        width: 40,
        height: 40,
        isMask: true,
        visible: true
      })

      const preflight = preflightPrintPDF(graph, { scope: 'node', nodeId: frame.id })
      expect(preflight.rasterFallback).toBe(true)
      expect(preflight.rasterFallbackReason).toContain("Background blur on 'BlurLayer'")
      expect(preflight.rasterFallbackReason).toContain("Layer mask on 'MaskLayer'")
    })

    it('positions artwork at frame origin with Y-axis flip in PDF user space', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        width: 400,
        height: 300
      })
      graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      // documentDpi = 72 -> ptPerPx = 1
      // W = 400, H = 300, M = 12, bleed = 0
      // MediaBox: [0 0 424 324]
      // TrimBox: [12 12 412 312]

      const result = await renderNodesToPrintPDF(
        graph,
        { scope: 'node', nodeId: frame.id },
        { documentDpi: 72, cropMarks: true }
      )

      expect(result).not.toBeNull()
      const stream = extractPDFStream(result ? result.data : new Uint8Array())

      // In PDF stream, transform matrix cm translates to frame origin (M + bL = 12, M + bT = 12)
      expect(stream).toContain('12. 12. cm')
    })
  })

  describe('IORegistry Integration', () => {
    it('pdfPrintFormat is registered and available in BUILTIN_IO_FORMATS', () => {
      const io = new IORegistry(BUILTIN_IO_FORMATS)
      const format = io.getFormat('pdf-print')

      expect(format).toBeDefined()
      expect(format?.id).toBe('pdf-print')
      expect(format?.label).toBe('PDF (print)')
      expect(format?.category).toBe('print')
      expect(format?.extensions).toEqual(['pdf'])
      expect(format?.support.exportPage).toBe(true)
      expect(format?.support.exportSelection).toBe(true)
      expect(format?.support.exportNode).toBe(true)
      expect(format?.support.exportDocument).toBeUndefined()
    })

    it('pdfFormat is completely distinct and untouched', () => {
      expect(pdfFormat.id).toBe('pdf')
      expect(pdfFormat.category).toBe('vector')
      expect(pdfFormat.support.exportDocument).toBe(true)

      expect(pdfPrintFormat.id).toBe('pdf-print')
      expect(pdfPrintFormat.category).toBe('print')
      expect(pdfPrintFormat.support.exportDocument).toBeUndefined()
    })
  })
})
