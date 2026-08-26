import type { VectorNetwork } from '@open-pencil/scene-graph'

/**
 * Pure, dependency-free geometric verifications for generated barcode plans.
 * These read the plan that generation already produced and report a WARN when
 * it does not hold the invariant - they never alter the geometry itself.
 */

function computeVertexBounds(
  network: VectorNetwork
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (network.vertices.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const v of network.vertices) {
    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Verifies that no dark geometry intrudes into the quiet zone band around the
 * symbol. Operates on the actual produced vector network's bounding box, so a
 * regression in the offset/placement math will be caught here.
 */
export function checkQuietZoneClear(
  vectorNetwork: VectorNetwork,
  marginX: number,
  marginY: number,
  totalWidth: number,
  totalHeight: number,
  warnings: string[],
  label = 'quiet zone'
): void {
  const bounds = computeVertexBounds(vectorNetwork)
  if (!bounds) return
  const epsilon = 1e-6
  if (
    bounds.minX < marginX - epsilon ||
    bounds.minY < marginY - epsilon ||
    bounds.maxX > totalWidth - marginX + epsilon ||
    bounds.maxY > totalHeight - marginY + epsilon
  ) {
    warnings.push(`Dark geometry intrudes into the ${label}.`)
  }
}

/**
 * Verifies a produced dimension is an exact, positive integer multiple of the
 * module size - i.e. the module grid is consistent, not merely assumed.
 */
export function checkModuleGridConsistency(
  dimension: number,
  moduleSize: number,
  warnings: string[],
  label: string
): void {
  if (
    !Number.isFinite(dimension) ||
    !Number.isFinite(moduleSize) ||
    moduleSize <= 0 ||
    dimension <= 0 ||
    dimension % moduleSize !== 0
  ) {
    warnings.push(`${label} is not an exact multiple of the module size.`)
  }
}

/** Verifies the overall symbol has finite, positive dimensions. */
export function checkFiniteDimensions(width: number, height: number, warnings: string[]): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    warnings.push('Barcode dimensions are not finite and positive.')
  }
}

/**
 * The canonical QR finder pattern: a 7x7 nested-square shape (dark border,
 * light ring, dark 3x3 center), independent of module styling.
 */
const STANDARD_FINDER_PATTERN: readonly (readonly boolean[])[] = [
  [true, true, true, true, true, true, true],
  [true, false, false, false, false, false, true],
  [true, false, true, true, true, false, true],
  [true, false, true, true, true, false, true],
  [true, false, true, true, true, false, true],
  [true, false, false, false, false, false, true],
  [true, true, true, true, true, true, true]
]

/**
 * Verifies each of the three QR finder patterns matches the standard
 * nested-square shape bit-for-bit in the raw module matrix, regardless of the
 * rendering style applied to non-finder modules.
 */
export function checkFinderPatternIntegrity(
  isDarkModule: (row: number, col: number) => boolean,
  matrixSize: number,
  warnings: string[]
): void {
  const positions = [
    { rowOffset: 0, colOffset: 0 },
    { rowOffset: 0, colOffset: matrixSize - 7 },
    { rowOffset: matrixSize - 7, colOffset: 0 }
  ]

  for (const { rowOffset, colOffset } of positions) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const expected = STANDARD_FINDER_PATTERN[r][c]
        const actual = isDarkModule(rowOffset + r, colOffset + c)
        if (actual !== expected) {
          warnings.push(
            `Finder pattern at module (${rowOffset}, ${colOffset}) does not match the standard nested-square shape.`
          )
          return
        }
      }
    }
  }
}

export interface GuardBarModule {
  isDark: boolean
  isGuard: boolean
}

// EAN-13 has no finder pattern - that is a QR-specific concept. Fixed Decision 7's
// "finder-pattern integrity" requirement is satisfied here instead by verifying
// guard-bar integrity (left 101, center 01010, right 101) and the 95-module core
// width (guards + 2x6 digit groups, excluding the two 9-module quiet zones).
export function checkGuardBarIntegrity(modules: readonly GuardBarModule[], warnings: string[]): void {
  const QUIET_ZONE = 9
  const LEFT_GUARD = [true, false, true]
  const CENTER_GUARD = [false, true, false, true, false]
  const RIGHT_GUARD = [true, false, true]
  const DIGIT_GROUP = 42

  const expectedTotal =
    QUIET_ZONE * 2 + LEFT_GUARD.length + DIGIT_GROUP * 2 + CENTER_GUARD.length + RIGHT_GUARD.length
  if (modules.length !== expectedTotal) {
    warnings.push(`EAN-13 module count (${modules.length}) does not match the expected total of ${expectedTotal}.`)
    return
  }

  const coreWidth = modules.length - QUIET_ZONE * 2
  if (coreWidth !== 95) {
    warnings.push(`EAN-13 core width (${coreWidth} modules) does not match the required 95-module core.`)
  }

  let cursor = QUIET_ZONE
  const leftGuard = modules.slice(cursor, cursor + LEFT_GUARD.length)
  if (!leftGuard.every((m, i) => m.isDark === LEFT_GUARD[i] && m.isGuard)) {
    warnings.push('Left guard bar does not match the required 101 pattern.')
  }
  cursor += LEFT_GUARD.length + DIGIT_GROUP

  const centerGuard = modules.slice(cursor, cursor + CENTER_GUARD.length)
  if (!centerGuard.every((m, i) => m.isDark === CENTER_GUARD[i] && m.isGuard)) {
    warnings.push('Center guard pattern does not match the required 01010 pattern.')
  }
  cursor += CENTER_GUARD.length + DIGIT_GROUP

  const rightGuard = modules.slice(cursor, cursor + RIGHT_GUARD.length)
  if (!rightGuard.every((m, i) => m.isDark === RIGHT_GUARD[i] && m.isGuard)) {
    warnings.push('Right guard bar does not match the required 101 pattern.')
  }
}
