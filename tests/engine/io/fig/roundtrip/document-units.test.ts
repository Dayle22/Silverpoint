import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { DEFAULT_DOCUMENT_UNITS, type DocumentUnits } from '@open-pencil/core/units'
import {
  DOCUMENT_UNITS_PLUGIN_KEY,
  parseDocumentUnits,
  upsertDocumentUnits
} from '@open-pencil/core/units/document'

describe('document units fig roundtrip', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('preserves documentUnits record on root node across fig roundtrip', async () => {
    const graph = new SceneGraph()
    const units: DocumentUnits = {
      unit: 'mm',
      dpi: 600
    }

    const root = graph.getNode(graph.rootId)
    if (!root) throw new Error('Expected root document node')

    graph.updateNode(graph.rootId, {
      pluginData: upsertDocumentUnits(
        [{ pluginId: 'another-plugin', key: 'keep', value: 'yes' }],
        units
      )
    })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedRoot = parsed.getNode(parsed.rootId)

    expect(parsedRoot?.pluginData).toContainEqual({
      pluginId: 'another-plugin',
      key: 'keep',
      value: 'yes'
    })
    expect(
      parsedRoot?.pluginData.filter((entry) => entry.key === DOCUMENT_UNITS_PLUGIN_KEY)
    ).toHaveLength(1)
    expect(parseDocumentUnits(parsedRoot?.pluginData ?? [])).toEqual(units)
  })

  test('retains malformed documentUnits payloads while the parser fails safe', async () => {
    const graph = new SceneGraph()
    graph.updateNode(graph.rootId, {
      pluginData: [
        { pluginId: 'open-pencil', key: DOCUMENT_UNITS_PLUGIN_KEY, value: '{bad-json' }
      ]
    })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedRoot = parsed.getNode(parsed.rootId)

    expect(parsedRoot?.pluginData[0]?.value).toBe('{bad-json')
    expect(parseDocumentUnits(parsedRoot?.pluginData ?? [])).toEqual(DEFAULT_DOCUMENT_UNITS)
  })
})
