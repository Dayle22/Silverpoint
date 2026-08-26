import { zipSync, type Zippable } from 'fflate'

import { buildFigKiwi } from '#core/kiwi/fig/node-change/serialize'

export function compressFigDataSync(
  schemaDeflated: Uint8Array,
  kiwiData: Uint8Array,
  thumbnailPNG: Uint8Array,
  metaJSON: string,
  imageEntries: Array<{ name: string; data: Uint8Array }>,
  figKiwiVersion?: number
): Uint8Array {
  const canvasData = buildFigKiwi(schemaDeflated, kiwiData, figKiwiVersion)
  const zipEntries: Zippable = {
    'canvas.fig': [canvasData, { level: 0 }],
    'thumbnail.png': [thumbnailPNG, { level: 0 }],
    'meta.json': new TextEncoder().encode(metaJSON)
  }
  for (const entry of imageEntries) {
    zipEntries[entry.name] = [entry.data, { level: 0 }]
  }
  return zipSync(zipEntries)
}
