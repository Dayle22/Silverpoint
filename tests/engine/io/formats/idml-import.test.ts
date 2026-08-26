import { beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SceneGraph } from '@open-pencil/scene-graph'

import { parseFrameGuides, upsertFrameGuides } from '#core/guides/frame'
import {
  BUILTIN_IO_FORMATS,
  idmlFormat,
  importIdml,
  initCanvasKit,
  IORegistry,
  readIdmlSummary,
  renderNodesToIdml
} from '#core/io'
import { IDML_MAX_ITEMS } from '#core/io/formats/idml'
import { setupFakeDomEnvironment } from '#tests/helpers/svg-dom-shim'
import { strToU8, zipSync } from 'fflate'

setupFakeDomEnvironment()

function loadFixture(name: string): Uint8Array {
  const filePath = resolve(import.meta.dir, '../../../fixtures/idml', name)
  return new Uint8Array(readFileSync(filePath))
}

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('IDML Import — T-064', () => {
  beforeAll(async () => {
    await initCanvasKit()
  }, 30000)

  describe('Format Adapter & Registry Seam', () => {
    it('registers readDocument support on idmlFormat and resolves via IORegistry', () => {
      const io = new IORegistry(BUILTIN_IO_FORMATS)
      const reader = io.findReader('document.idml')
      expect(reader).toBeDefined()
      expect(reader?.id).toBe('idml')
      expect(reader?.support.readDocument).toBe(true)
      expect(idmlFormat.support.readDocument).toBe(true)
    })
  })

  describe('readIdmlSummary (Pre-scan for Dialog)', () => {
    it('correctly reads summary, page count and dimensions for InDesign fixture', async () => {
      const data = loadFixture('indesign-sample.idml')
      const summary = await readIdmlSummary(data)

      expect(summary.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(summary.pages).toHaveLength(1)
      expect(summary.pages[0].pageNumber).toBe(1)
      expect(summary.pages[0].widthPt).toBe(400)
      expect(summary.pages[0].heightPt).toBe(300)

      // Verifies CMYK conversion diagnostic and external image link warning
      expect(summary.diagnostics.some((d) => d.code === 'IDML_CMYK_CONVERTED')).toBe(true)
      expect(summary.diagnostics.some((d) => d.code === 'IDML_EXTERNAL_LINK_SKIPPED')).toBe(true)
    })

    it('correctly reads summary for Affinity Publisher fixture', async () => {
      const data = loadFixture('affinity-sample.idml')
      const summary = await readIdmlSummary(data)

      expect(summary.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
      expect(summary.pages).toHaveLength(1)
      expect(summary.pages[0].pageNumber).toBe(1)
      expect(summary.pages[0].widthPt).toBe(480)
      expect(summary.pages[0].heightPt).toBe(360)
    })

    it('rejects empty input with IDML_EMPTY_FILE', async () => {
      const summary = await readIdmlSummary(new Uint8Array(0))
      expect(summary.pages).toHaveLength(0)
      expect(summary.diagnostics[0]?.code).toBe('IDML_EMPTY_FILE')
    })
  })

  describe('importIdml (InDesign Dialect)', () => {
    it('imports InDesign fixture with editable objects, text, swatches, images and guides', async () => {
      const data = loadFixture('indesign-sample.idml')
      const result = await importIdml(data, { fileName: 'indesign-sample.idml', documentDpi: 300 })

      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const page = result.graph.getPages()[0]
      expect(page).toBeDefined()

      const frames = result.graph.getChildren(page.id).filter((n) => n.type === 'FRAME')
      expect(frames).toHaveLength(1)

      const frame = frames[0]
      // 400 pt * 300 / 72 = 1666.67 px, 300 pt * 300 / 72 = 1250 px
      expect(frame.width).toBeCloseTo(1666.67, 1)
      expect(frame.height).toBeCloseTo(1250, 1)

      // Margin guides
      const guides = parseFrameGuides(frame.pluginData)
      expect(guides.margins.enabled).toBe(true)
      expect(guides.margins.top).toBeCloseTo(20 * (300 / 72), 1)
      expect(guides.margins.left).toBeCloseTo(30 * (300 / 72), 1)

      const children = result.graph.getChildren(frame.id)

      // Master spread banner item inherited
      const masterItem = children.find((c) =>
        c.pluginData.some((p) => p.key === 'idmlMasterItem' && p.value === 'true')
      )
      expect(masterItem).toBeDefined()

      // Rectangle with Indesign_Blue (RGB 30 90 200 -> r: 30/255, g: 90/255, b: 200/255)
      const rect = children.find((c) => c.name.includes('rect_1'))
      expect(rect).toBeDefined()
      expect(rect?.type).toBe('RECTANGLE')
      const fill = rect?.fills[0]
      expect(fill?.type).toBe('SOLID')
      if (fill?.type === 'SOLID') {
        expect(fill.color.r).toBeCloseTo(30 / 255, 2)
        expect(fill.color.g).toBeCloseTo(90 / 255, 2)
        expect(fill.color.b).toBeCloseTo(200 / 255, 2)
      }

      // Oval with CMYK converted red
      const oval = children.find((c) => c.name.includes('oval_1'))
      expect(oval).toBeDefined()
      expect(oval?.type).toBe('ELLIPSE')

      // Text frame with exact text and single missing font warning
      const textNode = children.find((c) => c.type === 'TEXT')
      expect(textNode).toBeDefined()
      expect(textNode?.text).toBe('InDesign Sample Document Heading')

      const fontWarnings = result.diagnostics.filter((d) => d.code === 'IDML_UNRESOLVED_FONT')
      expect(fontWarnings).toHaveLength(1)
      expect(fontWarnings[0].detail).toBe('CustomExoticFont')

      // Embedded image extracted into graph.images
      expect(result.graph.images.size).toBeGreaterThanOrEqual(1)
      const imgNode = children.find((c) => c.fills.some((f) => f.type === 'IMAGE'))
      expect(imgNode).toBeDefined()
    })
  })

  describe('importIdml (Affinity Publisher Dialect)', () => {
    it('imports Affinity Publisher fixture accurately with native shapes and text', async () => {
      const data = loadFixture('affinity-sample.idml')
      const result = await importIdml(data, { fileName: 'affinity-sample.idml', documentDpi: 300 })

      expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const page = result.graph.getPages()[0]
      const frame = result.graph.getChildren(page.id).find((n) => n.type === 'FRAME')
      expect(frame).toBeDefined()

      // 480 pt * 300 / 72 = 2000 px, 360 pt * 300 / 72 = 1500 px
      expect(frame?.width).toBe(2000)
      expect(frame?.height).toBe(1500)

      const children = frame ? result.graph.getChildren(frame.id) : []

      // Rectangle with Affinity_Emerald (RGB 16 185 129)
      const rect = children.find((c) => c.name.includes('Rect_Affinity'))
      expect(rect).toBeDefined()
      const rectFill = rect?.fills[0]
      if (rectFill?.type === 'SOLID') {
        expect(rectFill.color.r).toBeCloseTo(16 / 255, 2)
        expect(rectFill.color.g).toBeCloseTo(185 / 255, 2)
        expect(rectFill.color.b).toBeCloseTo(129 / 255, 2)
      }

      // Text node with exact text
      const textNode = children.find((c) => c.type === 'TEXT')
      expect(textNode).toBeDefined()
      expect(textNode?.text).toBe('Affinity Publisher Layout Header')

      // Oval with Navy swatch
      const oval = children.find((c) => c.name.includes('Oval_Affinity'))
      expect(oval).toBeDefined()
      expect(oval?.type).toBe('ELLIPSE')
    })
  })

  describe('Non-default DPI Scaling', () => {
    it('scales page dimensions and item coordinates proportionally at 150 DPI', async () => {
      const data = loadFixture('indesign-sample.idml')
      const result = await importIdml(data, { fileName: 'scaled.idml', documentDpi: 150 })

      const page = result.graph.getPages()[0]
      const frame = result.graph.getChildren(page.id).find((n) => n.type === 'FRAME')
      expect(frame).toBeDefined()

      // 400 pt * 150 / 72 = 833.33 px, 300 pt * 150 / 72 = 625 px
      expect(frame?.width).toBeCloseTo(833.33, 1)
      expect(frame?.height).toBeCloseTo(625, 1)
    })
  })

  describe('T-063 Exporter -> T-064 Importer Round-Trip Fidelity', () => {
    it('exports a rich graph through T-063, imports through T-064, and preserves frames, sizes, text, and colours', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Roundtrip Frame',
        x: 0,
        y: 0,
        width: 480,
        height: 360
      })

      const guides = {
        version: 1 as const,
        margins: { enabled: true, linked: false, top: 18, right: 24, bottom: 18, left: 24 },
        bleed: { enabled: false, linked: true, top: 0, right: 0, bottom: 0, left: 0 }
      }
      frame.pluginData = upsertFrameGuides(frame.pluginData, guides)

      // Solid Rectangle
      graph.createNode('RECTANGLE', frame.id, {
        name: 'Card Box',
        x: 20,
        y: 20,
        width: 140,
        height: 90,
        fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.8, a: 1 }, opacity: 1, visible: true }],
        strokes: [{ color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'INSIDE' }]
      })

      // Solid Ellipse
      graph.createNode('ELLIPSE', frame.id, {
        name: 'Badge Oval',
        x: 180,
        y: 20,
        width: 70,
        height: 70,
        fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.1, b: 0.3, a: 1 }, opacity: 1, visible: true }]
      })

      // Text Node
      graph.createNode('TEXT', frame.id, {
        name: 'Product Title',
        text: 'Bio Sculpture Premium Gel Treatment',
        fontFamily: 'Inter',
        fontSize: 16,
        x: 20,
        y: 130,
        width: 320,
        height: 40,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      // Image Node
      const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])
      const hash = 'roundtrip_img_hash'
      graph.images.set(hash, imageBytes)
      graph.createNode('RECTANGLE', frame.id, {
        name: 'Photo Asset',
        x: 20,
        y: 180,
        width: 80,
        height: 80,
        fills: [{ type: 'IMAGE', imageHash: hash, opacity: 1, visible: true }]
      })

      // 1. Export via T-063
      const exported = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id }, { documentDpi: 300 })
      expect(exported.data).toBeDefined()
      expect(exported.data.length).toBeGreaterThan(0)

      // 2. Import back via T-064
      const imported = await importIdml(exported.data, { fileName: 'roundtrip.idml', documentDpi: 300 })
      expect(imported.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)

      const importedPages = imported.graph.getPages()
      expect(importedPages).toHaveLength(1)

      const importedFrames = imported.graph.getChildren(importedPages[0].id).filter((n) => n.type === 'FRAME')
      expect(importedFrames).toHaveLength(1)

      const importedFrame = importedFrames[0]
      expect(importedFrame.width).toBeCloseTo(frame.width, 0.5)
      expect(importedFrame.height).toBeCloseTo(frame.height, 0.5)

      const importedChildren = imported.graph.getChildren(importedFrame.id)

      // Assert text string
      const importedText = importedChildren.find((c) => c.type === 'TEXT')
      expect(importedText).toBeDefined()
      expect(importedText?.text).toBe('Bio Sculpture Premium Gel Treatment')

      // Assert rectangle fill colour
      const importedRect = importedChildren.find((c) => c.type === 'RECTANGLE' && !c.fills.some((f) => f.type === 'IMAGE') && !c.pluginData.some((p) => p.key === 'idmlMasterItem'))
      expect(importedRect).toBeDefined()
      const rectFill = importedRect?.fills[0]
      if (rectFill?.type === 'SOLID') {
        expect(rectFill.color.r).toBeCloseTo(0.2, 2)
        expect(rectFill.color.g).toBeCloseTo(0.5, 2)
        expect(rectFill.color.b).toBeCloseTo(0.8, 2)
      }

      // Assert image byte identity
      expect(imported.graph.images.size).toBeGreaterThanOrEqual(1)
      const importedImageBytes = Array.from(imported.graph.images.values())[0]
      expect(importedImageBytes).toEqual(imageBytes)
    })
  })

  describe('IDML as Non-Save-Target (.fig isolation)', () => {
    it('ensures imported IDML document can be serialized to .fig format safely', async () => {
      const { initCodec, exportFigFile, parseFigFile } = await import('@open-pencil/core')
      await initCodec()

      const data = loadFixture('affinity-sample.idml')
      const { graph } = await importIdml(data, { fileName: 'affinity-sample.idml' })

      const figBytes = await exportFigFile(graph)
      expect(figBytes).toBeDefined()
      expect(figBytes.byteLength).toBeGreaterThan(0)

      const restored = await parseFigFile(figBytes.buffer as ArrayBuffer)
      expect(restored.getPages().length).toBeGreaterThan(0)
    })
  })

  describe('Import Limits — IDML_MAX_ITEMS / IDML_MAX_DIMENSION_PX', () => {
    function buildSyntheticPackage(spreadXML: string): Uint8Array {
      const designMapXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
  <idPkg:Spread src="Spreads/Spread_s1.xml" />
</Document>`
      return zipSync({
        'designmap.xml': [strToU8(designMapXML), { level: 0 }],
        'Spreads/Spread_s1.xml': [strToU8(spreadXML), { level: 0 }]
      })
    }

    it('rejects a package whose item count exceeds IDML_MAX_ITEMS with no nodes created', async () => {
      const rectangles = Array.from(
        { length: IDML_MAX_ITEMS + 1 },
        (_, i) => `<Rectangle Self="r${i}" GeometricBounds="0 0 10 10" FillColor="Color/Black" />`
      ).join('')
      const spreadXML = `<?xml version="1.0" encoding="UTF-8"?>
<Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" Self="s1">
  <Page Self="p1" GeometricBounds="0 0 400 300" />
  ${rectangles}
</Spread>`

      const result = await importIdml(buildSyntheticPackage(spreadXML), { fileName: 'huge.idml' })
      expect(
        result.diagnostics.some((d) => d.code === 'IDML_ITEM_COUNT_EXCEEDED' && d.severity === 'error')
      ).toBe(true)
      expect(result.graph.getChildren(result.graph.getPages()[0].id)).toHaveLength(0)
    })

    it('rejects a page whose pixel dimension exceeds IDML_MAX_DIMENSION_PX with no nodes created', async () => {
      const spreadXML = `<?xml version="1.0" encoding="UTF-8"?>
<Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" Self="s1">
  <Page Self="p1" GeometricBounds="0 0 999999 999999" />
</Spread>`

      const result = await importIdml(buildSyntheticPackage(spreadXML), {
        fileName: 'giant.idml',
        documentDpi: 300
      })
      expect(
        result.diagnostics.some((d) => d.code === 'IDML_DIMENSION_EXCEEDED' && d.severity === 'error')
      ).toBe(true)
      expect(result.graph.getChildren(result.graph.getPages()[0].id)).toHaveLength(0)
    })
  })
})
