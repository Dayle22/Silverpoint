export * from './types'
export { generateQRCodePlan, isFinderPatternModule } from './qr'
export {
  generateEAN13Plan,
  computeEan13CheckDigit,
  validateAndFormatEan13,
  buildEan13BitPattern
} from './ean13'
export { createVectorNetworkBuilder } from './geometry'
export {
  checkBarcodeContrast,
  calculateContrastRatio,
  relativeLuminance,
  evaluateScanCheck
} from './scan-check'
export {
  checkQuietZoneClear,
  checkModuleGridConsistency,
  checkFiniteDimensions,
  checkFinderPatternIntegrity,
  checkGuardBarIntegrity,
  type GuardBarModule
} from './geometry-check'

import { generateQRCodePlan } from './qr'
import { generateEAN13Plan } from './ean13'
import type { BarcodeOptions, BarcodePlan } from './types'

export function generateBarcodePlan(options: BarcodeOptions): BarcodePlan {
  if (options.type === 'QR_CODE') {
    return generateQRCodePlan(options)
  }
  return generateEAN13Plan(options)
}
