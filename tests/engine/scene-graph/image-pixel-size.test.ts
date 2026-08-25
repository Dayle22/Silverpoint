import { describe, expect, test } from 'bun:test'

import { readImagePixelSize } from '@open-pencil/scene-graph'

function createPng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(33)
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  buf[8] = 0
  buf[9] = 0
  buf[10] = 0
  buf[11] = 13
  buf.set([0x49, 0x48, 0x44, 0x52], 12)
  buf[16] = (width >>> 24) & 0xff
  buf[17] = (width >>> 16) & 0xff
  buf[18] = (width >>> 8) & 0xff
  buf[19] = width & 0xff
  buf[20] = (height >>> 24) & 0xff
  buf[21] = (height >>> 16) & 0xff
  buf[22] = (height >>> 8) & 0xff
  buf[23] = height & 0xff
  buf[24] = 8
  buf[25] = 6
  buf[26] = 0
  buf[27] = 0
  buf[28] = 0
  return buf
}

function createJpeg(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(41)
  let pos = 0
  buf[pos++] = 0xff
  buf[pos++] = 0xd8
  buf[pos++] = 0xff
  buf[pos++] = 0xe0
  buf[pos++] = 0x00
  buf[pos++] = 0x10
  buf.set([0x4a, 0x46, 0x49, 0x46, 0x00], pos)
  pos += 5
  buf[pos++] = 1
  buf[pos++] = 1
  buf[pos++] = 0
  buf[pos++] = 0
  buf[pos++] = 1
  buf[pos++] = 0
  buf[pos++] = 1
  buf[pos++] = 0
  buf[pos++] = 0
  buf[pos++] = 0xff
  buf[pos++] = 0xc0
  buf[pos++] = 0x00
  buf[pos++] = 0x11
  buf[pos++] = 8
  buf[pos++] = (height >>> 8) & 0xff
  buf[pos++] = height & 0xff
  buf[pos++] = (width >>> 8) & 0xff
  buf[pos++] = width & 0xff
  buf[pos++] = 3
  for (let c = 1; c <= 3; c++) {
    buf[pos++] = c
    buf[pos++] = 0x11
    buf[pos++] = 0
  }
  buf[pos++] = 0xff
  buf[pos++] = 0xd9
  return buf
}

function createGif(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(10)
  buf.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0)
  buf[6] = width & 0xff
  buf[7] = (width >>> 8) & 0xff
  buf[8] = height & 0xff
  buf[9] = (height >>> 8) & 0xff
  return buf
}

function createWebpVP8X(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30)
  buf.set([0x52, 0x49, 0x46, 0x46], 0)
  buf[4] = 22
  buf[5] = 0
  buf[6] = 0
  buf[7] = 0
  buf.set([0x57, 0x45, 0x42, 0x50], 8)
  buf.set([0x56, 0x50, 0x38, 0x58], 12)
  buf[16] = 10
  buf[17] = 0
  buf[18] = 0
  buf[19] = 0
  buf[20] = 0
  buf[21] = 0
  buf[22] = 0
  buf[23] = 0
  const w = width - 1
  buf[24] = w & 0xff
  buf[25] = (w >>> 8) & 0xff
  buf[26] = (w >>> 16) & 0xff
  const h = height - 1
  buf[27] = h & 0xff
  buf[28] = (h >>> 8) & 0xff
  buf[29] = (h >>> 16) & 0xff
  return buf
}

function createWebpVP8(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30)
  buf.set([0x52, 0x49, 0x46, 0x46], 0)
  buf[4] = 22
  buf[5] = 0
  buf[6] = 0
  buf[7] = 0
  buf.set([0x57, 0x45, 0x42, 0x50], 8)
  buf.set([0x56, 0x50, 0x38, 0x20], 12)
  buf[16] = 10
  buf[17] = 0
  buf[18] = 0
  buf[19] = 0
  buf[20] = 0
  buf[21] = 0
  buf[22] = 0
  buf[23] = 0x9d
  buf[24] = 0x01
  buf[25] = 0x2a
  buf[26] = width & 0xff
  buf[27] = (width >>> 8) & 0x3f
  buf[28] = height & 0xff
  buf[29] = (height >>> 8) & 0x3f
  return buf
}

function createWebpVP8L(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(25)
  buf.set([0x52, 0x49, 0x46, 0x46], 0)
  buf[4] = 17
  buf[5] = 0
  buf[6] = 0
  buf[7] = 0
  buf.set([0x57, 0x45, 0x42, 0x50], 8)
  buf.set([0x56, 0x50, 0x38, 0x4c], 12)
  buf[16] = 5
  buf[17] = 0
  buf[18] = 0
  buf[19] = 0
  buf[20] = 0x2f
  const val = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)
  buf[21] = val & 0xff
  buf[22] = (val >>> 8) & 0xff
  buf[23] = (val >>> 16) & 0xff
  buf[24] = (val >>> 24) & 0xff
  return buf
}

describe('readImagePixelSize', () => {
  test('valid PNG reports correct dimensions', () => {
    const png = createPng(800, 600)
    expect(readImagePixelSize(png)).toEqual({ width: 800, height: 600 })
  })

  test('valid JPEG reports correct dimensions', () => {
    const jpeg = createJpeg(1920, 1080)
    expect(readImagePixelSize(jpeg)).toEqual({ width: 1920, height: 1080 })
  })

  test('valid GIF reports correct dimensions', () => {
    const gif = createGif(320, 240)
    expect(readImagePixelSize(gif)).toEqual({ width: 320, height: 240 })
  })

  test('valid WebP VP8X reports correct dimensions', () => {
    const webp = createWebpVP8X(1024, 768)
    expect(readImagePixelSize(webp)).toEqual({ width: 1024, height: 768 })
  })

  test('valid WebP VP8 lossy reports correct dimensions', () => {
    const webp = createWebpVP8(500, 400)
    expect(readImagePixelSize(webp)).toEqual({ width: 500, height: 400 })
  })

  test('valid WebP VP8L lossless reports correct dimensions', () => {
    const webp = createWebpVP8L(640, 480)
    expect(readImagePixelSize(webp)).toEqual({ width: 640, height: 480 })
  })

  test('truncated PNG returns null without throwing', () => {
    const truncated = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
    expect(readImagePixelSize(truncated)).toBeNull()
  })

  test('JPEG with no SOF returns null without throwing', () => {
    const noSof = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0
      0xff, 0xd9 // EOI
    ])
    expect(readImagePixelSize(noSof)).toBeNull()
  })

  test('3-byte buffer returns null without throwing', () => {
    const buf = new Uint8Array([1, 2, 3])
    expect(readImagePixelSize(buf)).toBeNull()
  })

  test('empty buffer returns null without throwing', () => {
    const empty = new Uint8Array(0)
    expect(readImagePixelSize(empty)).toBeNull()
  })

  test('10 MB buffer of random bytes returns null without throwing', () => {
    const large = new Uint8Array(10 * 1024 * 1024)
    // Populate with deterministic non-zero pseudo-random pattern
    for (let i = 0; i < 10000; i++) {
      large[i * 1000] = (i * 37 + 13) & 0xff
    }
    expect(readImagePixelSize(large)).toBeNull()
  })
})
