import { beforeAll, describe, expect, it } from 'bun:test'
import { unzipSync } from 'fflate'
import { SceneGraph } from '@open-pencil/scene-graph'

import { upsertFrameGuides } from '#core/guides/frame'
import {
  BUILTIN_IO_FORMATS,
  initCanvasKit,
  IORegistry,
  preflightIdmlExport,
  renderNodesToIdml,
  renderNodesToPDF,
  renderNodesToPrintPDF
} from '#core/io'
import { setupFakeDomEnvironment } from '#tests/helpers/svg-dom-shim'

setupFakeDomEnvironment()

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

describe('IDML Export — T-063', () => {
  beforeAll(async () => {
    await initCanvasKit()
  }, 30000)

  describe('Format Adapter Registration', () => {
    it('registers idml in BUILTIN_IO_FORMATS with correct metadata', () => {
      const io = new IORegistry(BUILTIN_IO_FORMATS)
      const format = io.getFormat('idml')
      expect(format).toBeDefined()
      expect(format?.id).toBe('idml')
      expect(format?.role).toBe('interchange-document')
      expect(format?.category).toBe('document')
      expect(format?.extensions).toEqual(['idml'])
      expect(format?.mimeTypes).toEqual(['application/vnd.adobe.indesign-idml-package'])
      expect(format?.support.exportPage).toBe(true)
      expect(format?.support.exportSelection).toBe(true)
      expect(format?.support.exportNode).toBe(true)
      expect(format?.support.exportDocument).toBeUndefined()
      expect(format?.exportOptions?.scale).toBe(false)
      expect(format?.exportOptions?.quality).toBe(false)
    })
  })

  describe('Package Structure & MimeType', () => {
    it('produces a valid zip where mimetype is stored uncompressed as the first entry', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Page 1',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      expect(result.data).toBeInstanceOf(Uint8Array)

      // Raw ZIP header check:
      // Local file header magic PK\x03\x04
      expect(result.data[0]).toBe(0x50)
      expect(result.data[1]).toBe(0x4b)
      expect(result.data[2]).toBe(0x03)
      expect(result.data[3]).toBe(0x04)

      // Compression method at offset 8 (0 = stored)
      const compressionMethod = result.data[8] | (result.data[9] << 8)
      expect(compressionMethod).toBe(0)

      // File name length at offset 26 (8 bytes for 'mimetype')
      const fileNameLen = result.data[26] | (result.data[27] << 8)
      expect(fileNameLen).toBe(8)

      // File name string
      const fileName = decodeUtf8(result.data.subarray(30, 30 + fileNameLen))
      expect(fileName).toBe('mimetype')

      // MimeType payload
      const mimePayload = decodeUtf8(result.data.subarray(30 + fileNameLen, 30 + fileNameLen + 43))
      expect(mimePayload).toBe('application/vnd.adobe.indesign-idml-package')

      // Unzip all entries
      const unzipped = unzipSync(result.data)
      expect(unzipped['mimetype']).toBeDefined()
      expect(decodeUtf8(unzipped['mimetype'])).toBe('application/vnd.adobe.indesign-idml-package')
      expect(unzipped['META-INF/container.xml']).toBeDefined()
      expect(unzipped['designmap.xml']).toBeDefined()
      expect(unzipped['Resources/Graphic.xml']).toBeDefined()
      expect(unzipped['Resources/Fonts.xml']).toBeDefined()
      expect(unzipped['Resources/Styles.xml']).toBeDefined()
      expect(unzipped['Resources/Preferences.xml']).toBeDefined()
      expect(unzipped['MasterSpreads/MasterSpread_m1.xml']).toBeDefined()
      expect(unzipped['Spreads/Spread_s1.xml']).toBeDefined()
    })
  })

  describe('Page Dimensions, DPI & Units', () => {
    it('calculates page dimensions matching frame size * 72 / dpi for default 300 dpi', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Frame A',
        x: 0,
        y: 0,
        width: 500,
        height: 400
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id }, { documentDpi: 300 })
      const unzipped = unzipSync(result.data)
      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])

      // 500 * 72 / 300 = 120 pt, 400 * 72 / 300 = 96 pt
      expect(spreadXml).toContain('GeometricBounds="0 0 96 120"')
    })

    it('calculates page dimensions accurately for non-default 150 dpi', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Frame Custom DPI',
        x: 0,
        y: 0,
        width: 300,
        height: 200
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id }, { documentDpi: 150 })
      const unzipped = unzipSync(result.data)
      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])

      // 300 * 72 / 150 = 144 pt, 200 * 72 / 150 = 96 pt
      expect(spreadXml).toContain('GeometricBounds="0 0 96 144"')
    })

    it('creates multiple pages matching multiple target frames', async () => {
      const graph = new SceneGraph()
      const _frame1 = graph.createNode('FRAME', pageId(graph), {
        name: 'Page 1',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })
      const _frame2 = graph.createNode('FRAME', pageId(graph), {
        name: 'Page 2',
        x: 500,
        y: 0,
        width: 600,
        height: 400
      })

      const result = await renderNodesToIdml(graph, { scope: 'page', pageId: pageId(graph) })
      const unzipped = unzipSync(result.data)

      expect(unzipped['Spreads/Spread_s1.xml']).toBeDefined()
      expect(unzipped['Spreads/Spread_s2.xml']).toBeDefined()

      const designmapXml = decodeUtf8(unzipped['designmap.xml'])
      expect(designmapXml).toContain('Spreads/Spread_s1.xml')
      expect(designmapXml).toContain('Spreads/Spread_s2.xml')
    })
  })

  describe('Margins and Bleed', () => {
    it('passes margins and bleed from frame guides into page setup', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Guides Frame',
        x: 0,
        y: 0,
        width: 300,
        height: 300
      })

      const ptPerPx = 72 / 300
      const guides = {
        version: 1 as const,
        margins: { enabled: true, linked: false, top: 20, right: 30, bottom: 20, left: 30 },
        bleed: { enabled: true, linked: false, top: 10, right: 10, bottom: 10, left: 10 }
      }
      const updatedPluginData = upsertFrameGuides(frame.pluginData, guides)
      graph.updateNode(frame.id, { pluginData: updatedPluginData })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id }, { documentDpi: 300 })
      const unzipped = unzipSync(result.data)

      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])
      expect(spreadXml).toContain(`Top="${20 * ptPerPx}"`)
      expect(spreadXml).toContain(`Right="${30 * ptPerPx}"`)

      const prefsXml = decodeUtf8(unzipped['Resources/Preferences.xml'])
      expect(prefsXml).toContain(`DocumentBleedTopOffset="${10 * ptPerPx}"`)
    })
  })

  describe('Vector Shapes & Swatches', () => {
    it('creates native Rectangle, Oval, and Polygon with solid swatches and PathGeometry', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Shapes Frame',
        x: 0,
        y: 0,
        width: 400,
        height: 400
      })

      graph.createNode('RECTANGLE', frame.id, {
        name: 'Rect Blue',
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }],
        strokes: [{ color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'INSIDE' }]
      })

      graph.createNode('ELLIPSE', frame.id, {
        name: 'Circle Red',
        x: 10,
        y: 80,
        width: 60,
        height: 60,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      const unzipped = unzipSync(result.data)

      const graphicXml = decodeUtf8(unzipped['Resources/Graphic.xml'])
      expect(graphicXml).toContain('ColorValue="0 0 255"')
      expect(graphicXml).toContain('ColorValue="255 0 0"')

      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])
      expect(spreadXml).toContain('<Rectangle')
      expect(spreadXml).toContain('<Oval')
      expect(spreadXml).toContain('<PathGeometry>')
      expect(spreadXml).toContain('<PathPointType')
    })
  })

  describe('Text and Stories', () => {
    it('exports text frames with referenced Story containing exact text content', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Text Frame Parent',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })

      const _textNode = graph.createNode('TEXT', frame.id, {
        name: 'Headline',
        text: 'Specialized Bio Sculpture Text',
        fontFamily: 'Helvetica',
        fontSize: 18,
        x: 20,
        y: 20,
        width: 250,
        height: 40,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      const unzipped = unzipSync(result.data)

      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])
      expect(spreadXml).toContain('<TextFrame')
      expect(spreadXml).toContain('ParentStory=')

      const storyEntries = Object.keys(unzipped).filter((k) => k.startsWith('Stories/Story_'))
      expect(storyEntries.length).toBe(1)

      const storyXml = decodeUtf8(unzipped[storyEntries[0]])
      expect(storyXml).toContain('Specialized Bio Sculpture Text')
      expect(storyXml).toContain('AppliedFont="Helvetica"')
    })
  })

  describe('Image Embedding', () => {
    it('embeds image fills directly as Base64 in Contents', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Image Frame',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })

      const dummyImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])
      const hash = 'img_hash_12345'
      graph.images.set(hash, dummyImageBytes)

      graph.createNode('RECTANGLE', frame.id, {
        name: 'Photo',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        fills: [{ type: 'IMAGE', imageHash: hash, opacity: 1, visible: true }]
      })

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      const unzipped = unzipSync(result.data)

      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])
      expect(spreadXml).toContain('<Image')
      expect(spreadXml).toContain('<Contents>')
      expect(spreadXml).toContain(btoa(String.fromCharCode(...dummyImageBytes)))
    })
  })

  describe('Fallback & Preflight Warnings', () => {
    it('produces preflight error when no frames exist in export target', () => {
      const graph = new SceneGraph()
      graph.createNode('RECTANGLE', pageId(graph), {
        name: 'Top level rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })

      const preflight = preflightIdmlExport(graph, { scope: 'page', pageId: pageId(graph) })
      expect(preflight.valid).toBe(false)
      expect(preflight.errors).toContain('IDML export requires at least one frame')
    })

    it('names rasterised nodes with visible effects in preflight warnings', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Effects Frame',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })

      graph.createNode('RECTANGLE', frame.id, {
        name: 'Shadow Card',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
        effects: [
          {
            type: 'DROP_SHADOW',
            radius: 4,
            visible: true,
            color: { r: 0, g: 0, b: 0, a: 0.5 },
            offset: { x: 2, y: 2 },
            spread: 0
          }
        ]
      })

      const preflight = preflightIdmlExport(graph, { scope: 'node', nodeId: frame.id })
      expect(preflight.valid).toBe(true)
      expect(preflight.rasterFallback).toBe(true)
      expect(preflight.warnings.some((w) => w.includes("Drop shadow on 'Shadow Card'"))).toBe(true)

      const result = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      expect(result.warnings.some((w) => w.includes("Drop shadow on 'Shadow Card'"))).toBe(true)

      const unzipped = unzipSync(result.data)
      const spreadXml = decodeUtf8(unzipped['Spreads/Spread_s1.xml'])
      expect(spreadXml).toContain('<Image')
    })
  })

  describe('Deterministic Output & Byte Equality', () => {
    it('produces byte-identical output across two independent exports of the same graph', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Deterministic Frame',
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
        fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
      })

      graph.createNode('TEXT', frame.id, {
        name: 'Text 1',
        text: 'Stable export content',
        fontFamily: 'Inter',
        fontSize: 16,
        x: 10,
        y: 100,
        width: 200,
        height: 30,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const export1 = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })
      const export2 = await renderNodesToIdml(graph, { scope: 'node', nodeId: frame.id })

      expect(export1.data.byteLength).toBe(export2.data.byteLength)
      expect(Buffer.from(export1.data).equals(Buffer.from(export2.data))).toBe(true)
    })

    it('T-008 & T-021 Byte Equality Regression: standard and print PDF export are unaffected', async () => {
      const graph = new SceneGraph()
      const frame = graph.createNode('FRAME', pageId(graph), {
        name: 'Regression Frame',
        x: 0,
        y: 0,
        width: 400,
        height: 300
      })

      graph.createNode('RECTANGLE', frame.id, {
        name: 'Rect Regression',
        x: 10,
        y: 10,
        width: 100,
        height: 80,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })

      const pdf = await renderNodesToPDF(graph, pageId(graph), [frame.id], { title: 'Standard PDF' })
      expect(pdf).not.toBeNull()
      const str = new TextDecoder('latin1').decode(pdf ?? new Uint8Array())
      expect(str).toContain('/MediaBox')
      expect(str).not.toContain('/TrimBox')
      expect(str).not.toContain('/BleedBox')
      expect(str).not.toContain('/ArtBox')
      expect(str).not.toContain('0.25 w')

      const printPdf = await renderNodesToPrintPDF(graph, { scope: 'node', nodeId: frame.id })
      expect(printPdf).not.toBeNull()
      const printStr = new TextDecoder('latin1').decode(printPdf.data)
      expect(printStr).toContain('/MediaBox')
      expect(printStr).toContain('/TrimBox')
      expect(printStr).toContain('/BleedBox')
    })
  })
})
