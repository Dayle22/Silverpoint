import { beforeAll, describe, expect, test } from 'bun:test'

import { exportFigFile, FigmaAPI, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'

import {
  DEFAULT_FRAME_GUIDES,
  FRAME_GUIDES_PLUGIN_KEY,
  parseFrameGuides,
  upsertFrameGuides
} from '#core/guides/frame'

describe('frame guide fig roundtrip', () => {
  beforeAll(async () => {
    await initCodec()
  })

  test('preserves the exact frameGuides record and unrelated plugin data', async () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.name = 'Guided frame'
    const rawFrame = graph.getNode(frame.id)
    if (!rawFrame) throw new Error('Expected frame')

    const settings = structuredClone(DEFAULT_FRAME_GUIDES)
    settings.margins.enabled = true
    settings.margins.top = 24
    settings.bleed.enabled = true
    settings.bleed.top = 8
    graph.updateNode(frame.id, {
      pluginData: upsertFrameGuides(
        [{ pluginId: 'another-plugin', key: 'keep', value: 'yes' }],
        settings
      )
    })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedFrame = [...parsed.getAllNodes()].find((node) => node.name === 'Guided frame')

    expect(parsedFrame?.pluginData).toContainEqual({
      pluginId: 'another-plugin',
      key: 'keep',
      value: 'yes'
    })
    expect(
      parsedFrame?.pluginData.filter((entry) => entry.key === FRAME_GUIDES_PLUGIN_KEY)
    ).toHaveLength(1)
    expect(parseFrameGuides(parsedFrame?.pluginData ?? [])).toEqual(settings)
  })

  test('retains malformed frameGuides payloads while the parser fails safe', async () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const frame = api.createFrame()
    frame.name = 'Malformed guided frame'
    graph.updateNode(frame.id, {
      pluginData: [
        { pluginId: 'open-pencil', key: FRAME_GUIDES_PLUGIN_KEY, value: '{future-format' }
      ]
    })

    const bytes = await exportFigFile(graph)
    const parsed = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const parsedFrame = [...parsed.getAllNodes()].find(
      (node) => node.name === 'Malformed guided frame'
    )

    expect(parsedFrame?.pluginData[0]?.value).toBe('{future-format')
    expect(parseFrameGuides(parsedFrame?.pluginData ?? [])).toEqual(DEFAULT_FRAME_GUIDES)
  })
})
