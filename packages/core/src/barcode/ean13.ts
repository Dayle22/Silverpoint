import type { Fill } from '@open-pencil/scene-graph'

import { createVectorNetworkBuilder } from './geometry'
import { checkBarcodeContrast, evaluateScanCheck } from './scan-check'
import {
  checkFiniteDimensions,
  checkGuardBarIntegrity,
  checkModuleGridConsistency,
  checkQuietZoneClear
} from './geometry-check'
import { createBarcodeLayers, type BarcodeChildPlan, type BarcodePlan, type EAN13Options } from './types'

export const EAN13_PARITY_PATTERNS = [
  'LLLLLL', // 0
  'LLGLGG', // 1
  'LLGGLG', // 2
  'LLGGGL', // 3
  'LGLLGG', // 4
  'LGGLLG', // 5
  'LGGGLL', // 6
  'LGLGLG', // 7
  'LGLGGL', // 8
  'LGGLGL' // 9
]

export const L_CODES = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011' // 9
]

export const G_CODES = [
  '0100111', // 0
  '0110011', // 1
  '0011011', // 2
  '0100001', // 3
  '0011101', // 4
  '0111001', // 5
  '0000101', // 6
  '0010001', // 7
  '0001001', // 8
  '0010111' // 9
]

export const R_CODES = [
  '1110010', // 0
  '1100110', // 1
  '1101100', // 2
  '1000010', // 3
  '1011100', // 4
  '1001110', // 5
  '1010000', // 6
  '1000100', // 7
  '1001000', // 8
  '1110100' // 9
]

export function computeEan13CheckDigit(digits12: string): string {
  if (digits12.length !== 12 || !/^\d{12}$/.test(digits12)) {
    throw new Error('EAN-13 checksum requires exactly 12 numeric digits')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number.parseInt(digits12[i], 10)
    sum += digit * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit.toString()
}

export function validateAndFormatEan13(rawPayload: string): string {
  const sanitized = rawPayload.trim()
  if (!/^\d{12,13}$/.test(sanitized)) {
    throw new Error('EAN-13 payload must contain exactly 12 or 13 ASCII digits')
  }

  if (sanitized.length === 12) {
    const checkDigit = computeEan13CheckDigit(sanitized)
    return sanitized + checkDigit
  }

  const expected = computeEan13CheckDigit(sanitized.slice(0, 12))
  if (sanitized[12] !== expected) {
    throw new Error(`Invalid EAN-13 check digit: expected ${expected}, got ${sanitized[12]}`)
  }
  return sanitized
}

export interface Ean13Module {
  isDark: boolean
  isGuard: boolean
}

export function buildEan13BitPattern(full13Digits: string): Ean13Module[] {
  const firstDigit = Number.parseInt(full13Digits[0], 10)
  const parityPattern = EAN13_PARITY_PATTERNS[firstDigit]
  const leftDigits = full13Digits.slice(1, 7)
  const rightDigits = full13Digits.slice(7, 13)

  const modules: Ean13Module[] = []

  // Left quiet zone (9 modules)
  for (let i = 0; i < 9; i++) {
    modules.push({ isDark: false, isGuard: false })
  }

  // Left guard pattern: 101 (3 modules)
  modules.push({ isDark: true, isGuard: true })
  modules.push({ isDark: false, isGuard: true })
  modules.push({ isDark: true, isGuard: true })

  // Left 6 digits (42 modules)
  for (let i = 0; i < 6; i++) {
    const digit = Number.parseInt(leftDigits[i], 10)
    const codeType = parityPattern[i]
    const bitStr = codeType === 'L' ? L_CODES[digit] : G_CODES[digit]
    for (const bit of bitStr) {
      modules.push({ isDark: bit === '1', isGuard: false })
    }
  }

  // Center guard pattern: 01010 (5 modules)
  modules.push({ isDark: false, isGuard: true })
  modules.push({ isDark: true, isGuard: true })
  modules.push({ isDark: false, isGuard: true })
  modules.push({ isDark: true, isGuard: true })
  modules.push({ isDark: false, isGuard: true })

  // Right 6 digits (42 modules)
  for (let i = 0; i < 6; i++) {
    const digit = Number.parseInt(rightDigits[i], 10)
    const bitStr = R_CODES[digit]
    for (const bit of bitStr) {
      modules.push({ isDark: bit === '1', isGuard: false })
    }
  }

  // Right guard pattern: 101 (3 modules)
  modules.push({ isDark: true, isGuard: true })
  modules.push({ isDark: false, isGuard: true })
  modules.push({ isDark: true, isGuard: true })

  // Right quiet zone (9 modules)
  for (let i = 0; i < 9; i++) {
    modules.push({ isDark: false, isGuard: false })
  }

  return modules
}

export function generateEAN13Plan(options: EAN13Options): BarcodePlan {
  const full13 = validateAndFormatEan13(options.payload)
  const moduleSize = Math.max(1, Math.round(options.moduleSize))
  const barHeight = Math.max(20, Math.round(options.barHeight))
  const includeText = options.includeText

  const modules = buildEan13BitPattern(full13)
  const totalModuleCount = modules.length // 113
  const width = totalModuleCount * moduleSize

  const fontSize = Math.max(10, Math.round(12 * (moduleSize / 2)))
  const textHeight = includeText ? Math.round(fontSize * 1.5) : 0
  const guardExtension = includeText ? Math.round(4 * moduleSize) : 0
  const height = barHeight + textHeight

  // 1. Background
  const bgBuilder = createVectorNetworkBuilder()
  bgBuilder.addRect(0, 0, width, height)
  const bgFill: Fill = {
    type: 'SOLID',
    color: { ...options.lightColor },
    opacity: 1,
    visible: true
  }

  // 2. Bars
  const barsBuilder = createVectorNetworkBuilder()
  let darkBarCount = 0

  let i = 0
  while (i < totalModuleCount) {
    if (!modules[i].isDark) {
      i++
      continue
    }

    const startIdx = i
    const isGuard = modules[i].isGuard
    while (i < totalModuleCount && modules[i].isDark && modules[i].isGuard === isGuard) {
      i++
    }
    const count = i - startIdx
    const x = startIdx * moduleSize
    const w = count * moduleSize
    const h = isGuard ? barHeight + guardExtension : barHeight

    barsBuilder.addRect(x, 0, w, h)
    darkBarCount++
  }

  const barsFill: Fill = {
    type: 'SOLID',
    color: { ...options.darkColor },
    opacity: 1,
    visible: true
  }

  // 3. Scan check - geometry gate per Fixed Decision 7: quiet zone, module-grid
  // consistency, guard-bar integrity (EAN-13's equivalent of finder-pattern
  // integrity - see checkGuardBarIntegrity), finite positive dimensions, contrast.
  const warnings: string[] = []
  const contrastRatio = checkBarcodeContrast(options.darkColor, options.lightColor, warnings)

  if (moduleSize < 2) {
    warnings.push('Module width is below 2px.')
  }
  if (barHeight < 40) {
    warnings.push('Bar height is below 40px; aspect ratio is compact.')
  }

  checkFiniteDimensions(width, height, warnings)
  checkModuleGridConsistency(width, moduleSize, warnings, 'Symbol width')

  const barsNetwork = barsBuilder.build()
  const quietZoneMarginX = 9 * moduleSize
  checkQuietZoneClear(barsNetwork, quietZoneMarginX, 0, width, height, warnings, 'left/right quiet zone')

  checkGuardBarIntegrity(modules, warnings)

  const scanCheck = evaluateScanCheck(warnings, contrastRatio)

  const children: BarcodeChildPlan[] = createBarcodeLayers(
    bgBuilder.build(),
    bgFill,
    barsNetwork,
    barsFill,
    'Barcode Bars'
  )

  // Optional human-readable text child
  if (includeText) {
    const prefix = full13[0]
    const left6 = full13.slice(1, 7)
    const right6 = full13.slice(7, 13)
    const formattedText = `${prefix}  ${left6}  ${right6}`

    children.push({
      role: 'text',
      name: 'Digits',
      text: formattedText,
      x: 0,
      y: barHeight + 2,
      width,
      height: textHeight,
      fontSize,
      fills: [barsFill]
    })
  }

  return {
    type: 'EAN_13',
    width,
    height,
    metadata: {
      v: 1,
      type: 'EAN_13',
      payload: full13,
      options: {
        type: 'EAN_13',
        payload: full13,
        moduleSize,
        barHeight,
        includeText,
        darkColor: { ...options.darkColor },
        lightColor: { ...options.lightColor }
      }
    },
    children,
    scanCheck,
    info: {
      checksum: full13[12],
      moduleCount: darkBarCount
    }
  }
}
