import { beforeAll, describe, expect, test } from 'bun:test'

import {
  createEditor,
  exportFigFile,
  getBarcodeMetadata,
  initCodec,
  parseFigFile,
  SceneGraph,
  type EAN13Options,
  type QRCodeOptions
} from '@open-pencil/core'
import type { SceneGraph as SceneGraphType, SceneNode } from '@open-pencil/scene-graph'

import { getPluginData } from '#core/figma-api/plugin-data'
import { expectDefined } from '#tests/helpers/assert'

describe('barcode fig roundtrip', () => {
  let parsed: SceneGraphType
  let parsedQR: SceneNode | undefined
  let parsedEAN: SceneNode | undefined

  beforeAll(async () => {
    await initCodec()

    const graph = new SceneGraph()
    const editor = createEditor({ graph })

    const qrOptions: QRCodeOptions = {
      type: 'QR_CODE',
      payload: 'https://silverpoint.org/roundtrip',
      ecc: 'H',
      moduleSize: 3,
      style: 'rounded',
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    }
    editor.createBarcode(qrOptions)

    const eanOptions: EAN13Options = {
      type: 'EAN_13',
      payload: '978020137962',
      moduleSize: 2,
      barHeight: 90,
      includeText: true,
      darkColor: { r: 0, g: 0, b: 0, a: 1 },
      lightColor: { r: 1, g: 1, b: 1, a: 1 }
    }
    editor.createBarcode(eanOptions)

    const bytes = await exportFigFile(graph)
    parsed = await parseFigFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

    const allNodes = [...parsed.getAllNodes()]
    parsedQR = allNodes.find((n) => n.name === 'QR Code')
    parsedEAN = allNodes.find((n) => n.name === 'EAN-13 Barcode')
  })

  test('preserves the barcode frames', () => {
    expect(parsedQR).toBeDefined()
    expect(parsedQR?.type).toBe('FRAME')
    expect(parsedEAN).toBeDefined()
    expect(parsedEAN?.type).toBe('FRAME')
  })

  test('preserves the barcode pluginData metadata across save/reopen', () => {
    const qrMeta = expectDefined(
      getBarcodeMetadata(expectDefined(parsedQR, 'parsed QR frame')),
      'parsed QR metadata'
    )
    expect(qrMeta.type).toBe('QR_CODE')
    expect(qrMeta.payload).toBe('https://silverpoint.org/roundtrip')
    expect(qrMeta.options.ecc).toBe('H')
    expect((qrMeta.options as QRCodeOptions).style).toBe('rounded')

    const eanMeta = expectDefined(
      getBarcodeMetadata(expectDefined(parsedEAN, 'parsed EAN frame')),
      'parsed EAN metadata'
    )
    expect(eanMeta.type).toBe('EAN_13')
    expect(eanMeta.payload).toBe('9780201379624')
    expect((eanMeta.options as EAN13Options).includeText).toBe(true)
  })

  test('preserves barcodeRole-tagged QR child structure', () => {
    const children = parsed.getChildren(expectDefined(parsedQR, 'parsed QR frame').id)
    expect(children).toHaveLength(2)

    const roles = children.map((c) => getPluginData(c, 'barcodeRole'))
    expect(roles).toContain('background')
    expect(roles).toContain('modules')

    const modulesChild = children.find((c) => getPluginData(c, 'barcodeRole') === 'modules')
    expect(modulesChild?.type).toBe('VECTOR')
    expect(modulesChild?.vectorNetwork?.regions.length).toBeGreaterThan(0)
  })

  test('preserves barcodeRole-tagged EAN-13 child structure including the text child', () => {
    const children = parsed.getChildren(expectDefined(parsedEAN, 'parsed EAN frame').id)
    expect(children).toHaveLength(3)

    const roles = children.map((c) => getPluginData(c, 'barcodeRole'))
    expect(roles).toContain('background')
    expect(roles).toContain('modules')
    expect(roles).toContain('text')

    const textChild = children.find((c) => getPluginData(c, 'barcodeRole') === 'text')
    expect(textChild?.type).toBe('TEXT')
    expect(textChild?.text).toContain('9')
  })

  test('generator-owned children remain independently editable after reopen', () => {
    const qrFrame = expectDefined(parsedQR, 'parsed QR frame')
    const qrModules = expectDefined(
      parsed.getChildren(qrFrame.id).find((c) => getPluginData(c, 'barcodeRole') === 'modules'),
      'QR modules child'
    )
    const network = expectDefined(qrModules.vectorNetwork, 'QR modules vector network')

    const before = network.vertices.length
    parsed.updateNode(qrModules.id, {
      vectorNetwork: {
        ...network,
        vertices: network.vertices.slice(0, before - 4)
      }
    })

    const after = parsed.getNode(qrModules.id)
    expect(after?.vectorNetwork?.vertices.length).toBe(before - 4)

    // Editing the modules child must not disturb the frame's own metadata or the sibling children
    const qrMeta = getBarcodeMetadata(expectDefined(parsed.getNode(qrFrame.id), 'reparsed QR frame'))
    expect(qrMeta?.payload).toBe('https://silverpoint.org/roundtrip')
    expect(parsed.getChildren(qrFrame.id)).toHaveLength(2)
  })
})
