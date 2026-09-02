import { describe, expect, it } from 'bun:test'
import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  checkAllocation,
  createAllocationHealth,
  defaultAllocationLimits,
  MAX_ALLOCATION_COOLDOWN_FRAMES,
  recordAllocationFailure,
  recordAllocationSuccess,
  stepAllocationCooldown,
  tryAllocate,
  type AllocationLimits,
  type AllocationRequest
} from './allocation'
import { getAllocationHealth } from './retained-backing'

describe('F-018i CanvasKit Allocation Guards & Recovery', () => {
  describe('1. checkAllocation and pixel caps', () => {
    it('1. an allocation exceeding the pixel cap is refused without calling CanvasKit at all', () => {
      const limits: AllocationLimits = {
        maxDevicePixels: 10_000,
        maxBytesPerAllocation: 1_000_000
      }
      const req: AllocationRequest = {
        kind: 'surface',
        widthPx: 200,
        heightPx: 100,
        bytesPerPixel: 4
      } // 20,000 pixels > 10,000 maxDevicePixels

      let canvasKitMakeSurfaceCalled = false
      const mockCanvasKitMakeSurface = () => {
        canvasKitMakeSurfaceCalled = true
        return { mockSurface: true }
      }

      const decision = checkAllocation(req, limits)
      expect(decision.allow).toBe(false)
      if (!decision.allow) {
        expect(decision.reason).toBe('exceeds-pixel-cap')
        expect(decision.bytes).toBe(200 * 100 * 4)
      } else {
        mockCanvasKitMakeSurface()
      }

      // Assert CanvasKit was never called
      expect(canvasKitMakeSurfaceCalled).toBe(false)
    })

    it('allows allocation when within pixel and byte caps', () => {
      const limits: AllocationLimits = {
        maxDevicePixels: 50_000,
        maxBytesPerAllocation: 500_000
      }
      const req: AllocationRequest = {
        kind: 'surface',
        widthPx: 100,
        heightPx: 100
      } // 10,000 px, 40,000 bytes

      const decision = checkAllocation(req, limits)
      expect(decision.allow).toBe(true)
      if (decision.allow) {
        expect(decision.bytes).toBe(40_000)
      }
    })

    it('refuses allocations with invalid dimensions', () => {
      const limits: AllocationLimits = {
        maxDevicePixels: 100_000,
        maxBytesPerAllocation: 1_000_000
      }

      const zeroWidth = checkAllocation({ kind: 'surface', widthPx: 0, heightPx: 100 }, limits)
      expect(zeroWidth.allow).toBe(false)
      if (!zeroWidth.allow) expect(zeroWidth.reason).toBe('invalid-dimensions')

      const negativeHeight = checkAllocation({ kind: 'picture', widthPx: 100, heightPx: -5 }, limits)
      expect(negativeHeight.allow).toBe(false)
      if (!negativeHeight.allow) expect(negativeHeight.reason).toBe('invalid-dimensions')

      const nanDim = checkAllocation({ kind: 'snapshot', widthPx: Number.NaN, heightPx: 100 }, limits)
      expect(nanDim.allow).toBe(false)
      if (!nanDim.allow) expect(nanDim.reason).toBe('invalid-dimensions')
    })

    it('refuses allocation exceeding byte cap even if within pixel cap', () => {
      const limits: AllocationLimits = {
        maxDevicePixels: 100_000,
        maxBytesPerAllocation: 50_000 // 50 KB byte cap
      }
      const req: AllocationRequest = {
        kind: 'surface',
        widthPx: 200,
        heightPx: 200,
        bytesPerPixel: 4 // 40,000 px <= 100,000 px, but 160,000 bytes > 50,000 bytes
      }

      const decision = checkAllocation(req, limits)
      expect(decision.allow).toBe(false)
      if (!decision.allow) {
        expect(decision.reason).toBe('exceeds-byte-cap')
        expect(decision.bytes).toBe(160_000)
      }
    })

    it('scales defaultAllocationLimits based on device memory and clamps to [0.25, 1.5]', () => {
      const baseline = defaultAllocationLimits(8)
      expect(baseline.maxDevicePixels).toBe(16_000_000)
      expect(baseline.maxBytesPerAllocation).toBe(128 * 1024 * 1024)

      const half = defaultAllocationLimits(4)
      expect(half.maxDevicePixels).toBe(8_000_000)
      expect(half.maxBytesPerAllocation).toBe(64 * 1024 * 1024)

      // Clamped at 0.25 for low memory
      const low = defaultAllocationLimits(1)
      expect(low.maxDevicePixels).toBe(4_000_000)
      expect(low.maxBytesPerAllocation).toBe(32 * 1024 * 1024)

      // Clamped at 1.5 for high memory
      const high = defaultAllocationLimits(32)
      expect(high.maxDevicePixels).toBe(24_000_000)
      expect(high.maxBytesPerAllocation).toBe(192 * 1024 * 1024)
    })
  })

  describe('2. tryAllocate error boundary', () => {
    it('2. a throwing allocation returns null and does not propagate', () => {
      let threw = false
      try {
        const result = tryAllocate('test-throw', () => {
          throw new Error('CanvasKit WASM out-of-memory')
        })
        expect(result).toBeNull()
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    })

    it('tolerates non-Error throws (string, object, null)', () => {
      const stringThrow = tryAllocate('throw-string', () => {
        throw 'Memory explosion'
      })
      expect(stringThrow).toBeNull()

      const nullThrow = tryAllocate('throw-null', () => {
        throw null
      })
      expect(nullThrow).toBeNull()
    })

    it('treats null and undefined returns as failure without throwing', () => {
      const nullReturn = tryAllocate('return-null', () => null)
      expect(nullReturn).toBeNull()

      const fnReturningUndefined = () => undefined
      const undefinedReturn = tryAllocate('return-undefined', fnReturningUndefined as () => null)
      expect(undefinedReturn).toBeNull()
    })

    it('returns valid allocated object on success', () => {
      const allocated = { handle: 12345 }
      const res = tryAllocate('successful-alloc', () => allocated)
      expect(res).toBe(allocated)
    })
  })

  describe('3. Failure halves budget and trims cache', () => {
    it('3. a failure halves the pixel budget and triggers a cache trim', () => {
      const maxBudget = 16_000_000
      const health = createAllocationHealth(maxBudget)
      let trimmedToBytes: number | null = null

      const mockCacheBudget = {
        totalBytes: () => 60_000_000,
        trimTo: (targetBytes: number) => {
          trimmedToBytes = targetBytes
          return 30_000_000
        }
      }

      recordAllocationFailure(health, maxBudget, mockCacheBudget)

      expect(health.failures).toBe(1)
      expect(health.currentPixelBudget).toBe(8_000_000) // halved from 16M
      expect(trimmedToBytes).toBe(30_000_000) // totalBytes / 2
      expect(health.cooldownFrames).toBe(2) // 2^1
      expect(health.lastFailureAt).not.toBeNull()
    })
  })

  describe('4. Exponential backoff and cooldown capping', () => {
    it('4. repeated failures back off exponentially and stop at the cap', () => {
      const maxBudget = 16_000_000
      const health = createAllocationHealth(maxBudget)

      const expectedCooldowns = [
        2,   // 2^1
        4,   // 2^2
        8,   // 2^3
        16,  // 2^4
        32,  // 2^5
        64,  // 2^6
        128, // 2^7
        256, // 2^8
        512, // 2^9
        600, // min(2^10 = 1024, 600)
        600, // min(2^11 = 2048, 600)
        600  // capped at MAX_ALLOCATION_COOLDOWN_FRAMES
      ]

      for (let i = 0; i < expectedCooldowns.length; i++) {
        recordAllocationFailure(health, maxBudget, null)
        expect(health.failures).toBe(i + 1)
        expect(health.cooldownFrames).toBe(expectedCooldowns[i])
      }

      expect(health.cooldownFrames).toBe(MAX_ALLOCATION_COOLDOWN_FRAMES)
    })

    it('steps down cooldown frames until 0', () => {
      const health = createAllocationHealth(16_000_000)
      health.cooldownFrames = 3

      expect(stepAllocationCooldown(health)).toBe(true)
      expect(health.cooldownFrames).toBe(2)

      expect(stepAllocationCooldown(health)).toBe(true)
      expect(health.cooldownFrames).toBe(1)

      expect(stepAllocationCooldown(health)).toBe(true)
      expect(health.cooldownFrames).toBe(0)

      expect(stepAllocationCooldown(health)).toBe(false)
      expect(health.cooldownFrames).toBe(0)
    })
  })

  describe('5. Gradual recovery on success', () => {
    it('5. successes restore the budget gradually, not instantly', () => {
      const maxBudget = 16_000_000
      const quarter = maxBudget * 0.25 // 4_000_000
      const health = createAllocationHealth(maxBudget)

      // Cause failures to drop to floor
      recordAllocationFailure(health, maxBudget, null) // 8M
      recordAllocationFailure(health, maxBudget, null) // 4M
      expect(health.currentPixelBudget).toBe(quarter)
      expect(health.failures).toBe(2)

      // First success: steps up by 25% of max (4M) -> 8M
      recordAllocationSuccess(health, maxBudget)
      expect(health.currentPixelBudget).toBe(8_000_000)
      expect(health.currentPixelBudget).toBeLessThan(maxBudget) // not instantly restored!
      expect(health.cooldownFrames).toBe(0)

      // Second success: steps up by 25% -> 12M
      recordAllocationSuccess(health, maxBudget)
      expect(health.currentPixelBudget).toBe(12_000_000)
      expect(health.currentPixelBudget).toBeLessThan(maxBudget)

      // Third success: steps up to max -> 16M
      recordAllocationSuccess(health, maxBudget)
      expect(health.currentPixelBudget).toBe(16_000_000)
      expect(health.failures).toBe(0) // fully reset on reaching max
    })
  })

  describe('6. Budget clamping boundaries', () => {
    it('6. the budget never falls below one quarter of maximum, and never exceeds maximum', () => {
      const maxBudget = 16_000_000
      const floor = maxBudget * 0.25 // 4_000_000
      const health = createAllocationHealth(maxBudget)

      // Test lower bound: 10 repeated failures
      for (let i = 0; i < 10; i++) {
        recordAllocationFailure(health, maxBudget, null)
        expect(health.currentPixelBudget).toBeGreaterThanOrEqual(floor)
      }
      expect(health.currentPixelBudget).toBe(floor)

      // Test upper bound: 10 repeated successes
      for (let i = 0; i < 10; i++) {
        recordAllocationSuccess(health, maxBudget)
        expect(health.currentPixelBudget).toBeLessThanOrEqual(maxBudget)
      }
      expect(health.currentPixelBudget).toBe(maxBudget)
    })
  })

  describe('Retained Backing AllocationHealth integration', () => {
    it('lazily associates health with SkiaRenderer and remembers state', () => {
function asType<T>(val: unknown): T {
  return val as T
}

      const mockRenderer = asType<SkiaRenderer>({
        viewportWidth: 1920,
        viewportHeight: 1080,
        dpr: 1,
        sceneBackingAllocationFailed: false
      })

      const health1 = getAllocationHealth(mockRenderer)
      expect(health1).toBeDefined()
      expect(health1.failures).toBe(0)
      expect(health1.cooldownFrames).toBe(0)
      expect(health1.currentPixelBudget).toBe(16_000_000)

      // Multiple calls return the identical WeakMap entry
      const health2 = getAllocationHealth(mockRenderer)
      expect(health1).toBe(health2)

      health1.failures = 3
      expect(getAllocationHealth(mockRenderer).failures).toBe(3)
    })
  })
})
