import { deflateSync } from 'fflate'

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function createPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + 4)
  const v = new DataView(out.buffer)
  v.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  const crc = crc32(out.subarray(4, 8 + data.length))
  v.setUint32(8 + data.length, crc)
  return out
}

export function encodeRGBAToPNG(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // Filter type: None
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1)
  }
  const idat = deflateSync(raw)

  const ihdr = new Uint8Array(13)
  const iv = new DataView(ihdr.buffer)
  iv.setUint32(0, width)
  iv.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA

  const magic = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const chIhdr = createPNGChunk('IHDR', ihdr)
  const chIdat = createPNGChunk('IDAT', idat)
  const chIend = createPNGChunk('IEND', new Uint8Array(0))

  const total = new Uint8Array(magic.length + chIhdr.length + chIdat.length + chIend.length)
  let offset = 0
  for (const chunk of [magic, chIhdr, chIdat, chIend]) {
    total.set(chunk, offset)
    offset += chunk.length
  }
  return total
}
