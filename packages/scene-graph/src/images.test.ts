import { describe, expect, it } from 'bun:test'

import {
  checkImageDecode,
  DEFAULT_IMAGE_DECODE_POLICY,
  type ImageDecodePolicy
} from './images'

function makeSyntheticPNGHeader(width: number, height: number): Uint8Array {
  const header = new Uint8Array(24)
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  header.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8)
  header[16] = (width >>> 24) & 0xff
  header[17] = (width >>> 16) & 0xff
  header[18] = (width >>> 8) & 0xff
  header[19] = width & 0xff
  header[20] = (height >>> 24) & 0xff
  header[21] = (height >>> 16) & 0xff
  header[22] = (height >>> 8) & 0xff
  header[23] = height & 0xff
  return header
}

describe('checkImageDecode', () => {
  it('allows a valid small PNG header', () => {
    const png = makeSyntheticPNGHeader(800, 600)
    const verdict = checkImageDecode(png)
    expect(verdict.kind).toBe('allow')
    if (verdict.kind === 'allow') {
      expect(verdict.width).toBe(800)
      expect(verdict.height).toBe(600)
      expect(verdict.estimatedBytes).toBe(800 * 600 * 4)
    }
  })

  it('rejects a PNG header declaring 20000x20000 with pixels-too-large', () => {
    const png = makeSyntheticPNGHeader(20000, 20000)
    const verdict = checkImageDecode(png)
    expect(verdict.kind).toBe('reject')
    if (verdict.kind === 'reject') {
      expect(verdict.reason).toBe('pixels-too-large')
      expect(verdict.detail).toContain('20000×20000')
      expect(verdict.detail).toContain('400 MP')
    }
  })

  it('flags a PNG header declaring 8000x5000 (40 MP) for downsampling', () => {
    const png = makeSyntheticPNGHeader(8000, 5000)
    const verdict = checkImageDecode(png)
    expect(verdict.kind).toBe('downsample')
    if (verdict.kind === 'downsample') {
      expect(verdict.width).toBe(8000)
      expect(verdict.height).toBe(5000)
      expect(verdict.targetScale).toBeGreaterThan(0)
      expect(verdict.targetScale).toBeLessThan(1)
      expect(verdict.estimatedBytes).toBeGreaterThan(0)
    }
  })

  it('rejects empty byte array with unreadable-header', () => {
    const verdict = checkImageDecode(new Uint8Array(0))
    expect(verdict.kind).toBe('reject')
    if (verdict.kind === 'reject') {
      expect(verdict.reason).toBe('unreadable-header')
    }
  })

  it('rejects a header declaring 0x100 with zero-dimension', () => {
    const png = makeSyntheticPNGHeader(0, 100)
    const verdict = checkImageDecode(png)
    expect(verdict.kind).toBe('reject')
    if (verdict.kind === 'reject') {
      expect(verdict.reason).toBe('zero-dimension')
    }
  })

  it('rejects payload exceeding maxEncodedBytes with encoded-too-large before reading header', () => {
    const customPolicy: ImageDecodePolicy = {
      ...DEFAULT_IMAGE_DECODE_POLICY,
      maxEncodedBytes: 10
    }
    // An invalid/random byte array longer than maxEncodedBytes
    const payload = new Uint8Array(11)
    const verdict = checkImageDecode(payload, customPolicy)
    expect(verdict.kind).toBe('reject')
    if (verdict.kind === 'reject') {
      expect(verdict.reason).toBe('encoded-too-large')
    }
  })
})
