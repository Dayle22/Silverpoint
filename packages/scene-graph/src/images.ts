export function computeImageHash(data: Uint8Array): string {
  let h1 = 0x811c9dc5 >>> 0
  let h2 = 0x811c9dc5 >>> 0
  let h3 = 0x811c9dc5 >>> 0
  let h4 = 0x811c9dc5 >>> 0
  let h5 = 0x811c9dc5 >>> 0
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    switch (i % 5) {
      case 0:
        h1 ^= b
        h1 = Math.imul(h1, 0x01000193) >>> 0
        break
      case 1:
        h2 ^= b
        h2 = Math.imul(h2, 0x01000193) >>> 0
        break
      case 2:
        h3 ^= b
        h3 = Math.imul(h3, 0x01000193) >>> 0
        break
      case 3:
        h4 ^= b
        h4 = Math.imul(h4, 0x01000193) >>> 0
        break
      default:
        h5 ^= b
        h5 = Math.imul(h5, 0x01000193) >>> 0
        break
    }
  }
  h5 = Math.imul(h5 ^ data.length, 0x01000193) >>> 0
  return [h1, h2, h3, h4, h5].map((hash) => hash.toString(16).padStart(8, '0')).join('')
}

export interface ImagePixelSize {
  width: number
  height: number
}

function readPngSize(data: Uint8Array): ImagePixelSize | null {
  if (
    data.length >= 24 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    const width = ((data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]) >>> 0
    const height = ((data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]) >>> 0
    if (width > 0 && height > 0) {
      return { width, height }
    }
  }
  return null
}

function readGifSize(data: Uint8Array): ImagePixelSize | null {
  if (
    data.length >= 10 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x38 &&
    (data[4] === 0x37 || data[4] === 0x39) &&
    data[5] === 0x61
  ) {
    const width = data[6] | (data[7] << 8)
    const height = data[8] | (data[9] << 8)
    if (width > 0 && height > 0) {
      return { width, height }
    }
  }
  return null
}

function isWebpHeader(data: Uint8Array): boolean {
  return (
    data.length >= 16 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  )
}

function readVp8xSize(data: Uint8Array): ImagePixelSize | null {
  if (data.length < 30) return null
  const width = 1 + (data[24] | (data[25] << 8) | (data[26] << 16))
  const height = 1 + (data[27] | (data[28] << 8) | (data[29] << 16))
  return width > 0 && height > 0 ? { width, height } : null
}

function readVp8LossySize(data: Uint8Array): ImagePixelSize | null {
  if (data.length < 30) return null
  if (data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
    const width = (data[26] | (data[27] << 8)) & 0x3fff
    const height = (data[28] | (data[29] << 8)) & 0x3fff
    return width > 0 && height > 0 ? { width, height } : null
  }
  return null
}

function readVp8LosslessSize(data: Uint8Array): ImagePixelSize | null {
  if (data.length < 25 || data[20] !== 0x2f) return null
  const val = (data[21] | (data[22] << 8) | (data[23] << 16) | (data[24] << 24)) >>> 0
  const width = (val & 0x3fff) + 1
  const height = ((val >>> 14) & 0x3fff) + 1
  return width > 0 && height > 0 ? { width, height } : null
}

function readWebpSize(data: Uint8Array): ImagePixelSize | null {
  if (!isWebpHeader(data)) return null

  const chunkType = String.fromCharCode(data[12], data[13], data[14], data[15])
  if (chunkType === 'VP8X') return readVp8xSize(data)
  if (chunkType === 'VP8 ') return readVp8LossySize(data)
  if (chunkType === 'VP8L') return readVp8LosslessSize(data)
  return null
}

function isJpegStandaloneMarker(marker: number): boolean {
  return (
    marker === 0xd8 ||
    marker === 0xd9 ||
    marker === 0x00 ||
    (marker >= 0xd0 && marker <= 0xd7)
  )
}

function isJpegSofMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function readJpegSize(data: Uint8Array): ImagePixelSize | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return null
  }

  let offset = 2
  let segmentsScanned = 0

  while (offset < data.length && segmentsScanned < 1000) {
    while (offset < data.length && data[offset] !== 0xff) {
      offset++
    }
    if (offset >= data.length) break
    while (offset < data.length && data[offset] === 0xff) {
      offset++
    }
    if (offset >= data.length) break

    const marker = data[offset]
    offset++
    segmentsScanned++

    if (isJpegStandaloneMarker(marker)) {
      continue
    }
    if (marker === 0xda) {
      break
    }

    if (offset + 2 > data.length) break
    const segmentLength = (data[offset] << 8) | data[offset + 1]
    if (segmentLength < 2) break

    if (isJpegSofMarker(marker)) {
      if (offset + 7 > data.length) return null
      const height = (data[offset + 3] << 8) | data[offset + 4]
      const width = (data[offset + 5] << 8) | data[offset + 6]
      return width > 0 && height > 0 ? { width, height } : null
    }

    offset += segmentLength
  }

  return null
}

export function readImagePixelSize(data: Uint8Array): ImagePixelSize | null {
  if (data.length < 8) return null

  return (
    readPngSize(data) ??
    readGifSize(data) ??
    readWebpSize(data) ??
    readJpegSize(data)
  )
}

