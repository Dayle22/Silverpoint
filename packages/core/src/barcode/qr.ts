import QRCode from 'qrcode'
import type { Fill } from '@open-pencil/scene-graph'

import { createVectorNetworkBuilder } from './geometry'
import { checkBarcodeContrast, evaluateScanCheck } from './scan-check'
import {
  checkFiniteDimensions,
  checkFinderPatternIntegrity,
  checkModuleGridConsistency,
  checkQuietZoneClear
} from './geometry-check'
import {
  createBarcodeLayers,
  type BarcodeChildPlan,
  type BarcodePlan,
  type QRCodeEcc,
  type QRCodeOptions,
  type QRCodeStyle
} from './types'

export function isFinderPatternModule(row: number, col: number, matrixSize: number): boolean {
  // Top-Left Finder (0..6, 0..6)
  if (row < 7 && col < 7) return true
  // Top-Right Finder (0..6, size-7..size-1)
  if (row < 7 && col >= matrixSize - 7) return true
  // Bottom-Left Finder (size-7..size-1, 0..6)
  if (row >= matrixSize - 7 && col < 7) return true
  return false
}

export function generateQRCodePlan(options: QRCodeOptions): BarcodePlan {
  const payload = options.payload
  if (payload.trim().length === 0) {
    throw new Error('QR code payload cannot be empty')
  }

  const moduleSize = Math.max(1, Math.round(options.moduleSize))
  const ecc: QRCodeEcc = options.ecc
  const style: QRCodeStyle = options.style

  // Generate matrix using qrcode library
  const qr = QRCode.create(payload, {
    errorCorrectionLevel: ecc
  })

  const rawSize = qr.modules.size
  const quietZone = 4
  const totalGridSize = rawSize + quietZone * 2
  const width = totalGridSize * moduleSize
  const height = totalGridSize * moduleSize

  // 1. Build Background
  const bgBuilder = createVectorNetworkBuilder()
  bgBuilder.addRect(0, 0, width, height)
  const bgFill: Fill = {
    type: 'SOLID',
    color: { ...options.lightColor },
    opacity: 1,
    visible: true
  }

  // 2. Build Modules
  const modulesBuilder = createVectorNetworkBuilder()
  let darkModuleCount = 0

  for (let r = 0; r < rawSize; r++) {
    for (let c = 0; c < rawSize; c++) {
      const isDark = Boolean(qr.modules.get(r, c))
      if (!isDark) continue

      darkModuleCount++
      const x = (c + quietZone) * moduleSize
      const y = (r + quietZone) * moduleSize
      const isFinder = isFinderPatternModule(r, c, rawSize)

      if (isFinder || style === 'square') {
        modulesBuilder.addRect(x, y, moduleSize, moduleSize)
      } else if (style === 'rounded') {
        const radius = Math.max(0.5, moduleSize * 0.3)
        modulesBuilder.addRoundedRect(x, y, moduleSize, moduleSize, radius)
      } else {
        const radius = (moduleSize / 2) * 0.95
        modulesBuilder.addCircle(x + moduleSize / 2, y + moduleSize / 2, radius)
      }
    }
  }

  const modulesFill: Fill = {
    type: 'SOLID',
    color: { ...options.darkColor },
    opacity: 1,
    visible: true
  }

  // 3. Scan check - geometry gate per Fixed Decision 7: quiet zone, module-grid
  // consistency, finder-pattern integrity, finite positive dimensions, contrast.
  const warnings: string[] = []
  const contrastRatio = checkBarcodeContrast(options.darkColor, options.lightColor, warnings)

  if (moduleSize < 2) {
    warnings.push('Module size is below 2px; geometry may be small.')
  }

  checkFiniteDimensions(width, height, warnings)
  checkModuleGridConsistency(width, moduleSize, warnings, 'Symbol width')
  checkModuleGridConsistency(height, moduleSize, warnings, 'Symbol height')

  const modulesNetwork = modulesBuilder.build()
  const quietZoneMargin = quietZone * moduleSize
  checkQuietZoneClear(modulesNetwork, quietZoneMargin, quietZoneMargin, width, height, warnings)

  checkFinderPatternIntegrity(
    (r, c) => Boolean(qr.modules.get(r, c)),
    rawSize,
    warnings
  )

  const scanCheck = evaluateScanCheck(warnings, contrastRatio)

  const children: BarcodeChildPlan[] = createBarcodeLayers(
    bgBuilder.build(),
    bgFill,
    modulesNetwork,
    modulesFill,
    'QR Modules'
  )

  return {
    type: 'QR_CODE',
    width,
    height,
    metadata: {
      v: 1,
      type: 'QR_CODE',
      payload,
      options: {
        type: 'QR_CODE',
        payload,
        ecc,
        moduleSize,
        style,
        darkColor: { ...options.darkColor },
        lightColor: { ...options.lightColor }
      }
    },
    children,
    scanCheck,
    info: {
      version: qr.version,
      moduleCount: darkModuleCount
    }
  }
}
