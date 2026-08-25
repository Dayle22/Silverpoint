import { describe, expect, mock, test } from 'bun:test'

import {
  DEFAULT_CANVAS_GRID_SETTINGS,
  normalizeCanvasGridSettings
} from '@open-pencil/core/canvas'
import { drawCanvasGrid } from '#core/canvas/grid'

describe('canvas grid settings', () => {
  test('defaults to a visible 16px dot grid', () => {
    expect(DEFAULT_CANVAS_GRID_SETTINGS).toEqual({
      visible: true,
      mode: 'dots',
      spacing: 16,
      dotSize: 1.5,
      opacity: 0.2,
      color: '#808080'
    })
  })

  test('normalises mode and clamps spacing to the safe range', () => {
    expect(normalizeCanvasGridSettings({ visible: true, mode: 'lines', spacing: 1, dotSize: 20, opacity: 1, color: '#ff00aa' })).toEqual({
      visible: true,
      mode: 'lines',
      spacing: 4,
      dotSize: 8,
      opacity: 0.8,
      color: '#FF00AA'
    })
    expect(normalizeCanvasGridSettings({ spacing: 1000 })).toEqual({
      visible: true,
      mode: 'dots',
      spacing: 256,
      dotSize: 1.5,
      opacity: 0.2,
      color: '#808080'
    })
  })

  test('thins dots to keep visible grid spacing at least 8px when zoomed out', () => {
    const drawCircle = mock(() => undefined)
    const renderer = {
      zoom: 0.25,
      worldViewport: { x: 0, y: 0, w: 256, h: 256 },
      rulerTheme: null,
      ck: {
        Color4f: (r: number, g: number, b: number, a: number) => [r, g, b, a]
      }
    }
    const canvas = { drawCircle }
    const paint = {
      setColor: mock(() => undefined),
      setStrokeWidth: mock(() => undefined)
    }

    drawCanvasGrid(renderer as never, canvas as never, DEFAULT_CANVAS_GRID_SETTINGS, paint as never)

    expect(drawCircle).toHaveBeenCalledTimes(81)
    expect(drawCircle).toHaveBeenCalledWith(32, 32, 3, paint)
  })
})
