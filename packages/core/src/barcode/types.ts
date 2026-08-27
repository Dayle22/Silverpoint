import type { Color, Fill, VectorNetwork } from '@open-pencil/scene-graph'
import { BLACK, WHITE } from '#core/constants'

export type BarcodeType = 'QR_CODE' | 'EAN_13'

export type QRCodeEcc = 'L' | 'M' | 'Q' | 'H'
export type QRCodeStyle = 'square' | 'rounded' | 'dots'

export interface QRCodeOptions {
  type: 'QR_CODE'
  payload: string
  ecc: QRCodeEcc
  moduleSize: number
  style: QRCodeStyle
  darkColor: Color
  lightColor: Color
}

export interface EAN13Options {
  type: 'EAN_13'
  payload: string
  moduleSize: number
  barHeight: number
  includeText: boolean
  darkColor: Color
  lightColor: Color
}

export type BarcodeOptions = QRCodeOptions | EAN13Options

export type BarcodeRole = 'modules' | 'background' | 'text'

export interface BarcodeMetadata {
  v: 1
  type: BarcodeType
  payload: string
  options: BarcodeOptions
}

export interface BarcodeScanCheck {
  status: 'PASS' | 'WARN'
  contrastRatio: number
  warnings: string[]
}

export interface BarcodeVectorChildPlan {
  role: 'modules' | 'background'
  name: string
  vectorNetwork: VectorNetwork
  fills: Fill[]
}

export interface BarcodeTextChildPlan {
  role: 'text'
  name: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fills: Fill[]
}

export type BarcodeChildPlan = BarcodeVectorChildPlan | BarcodeTextChildPlan

export interface BarcodePlan {
  type: BarcodeType
  width: number
  height: number
  metadata: BarcodeMetadata
  children: BarcodeChildPlan[]
  scanCheck: BarcodeScanCheck
  info?: {
    version?: number
    checksum?: string
    moduleCount?: number
  }
}

export const BARCODE_METADATA_VERSION = 1
export const BARCODE_PLUGIN_KEY = 'barcode'
export const BARCODE_ROLE_PLUGIN_KEY = 'barcodeRole'

export const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  type: 'QR_CODE',
  payload: 'https://silverpoint.org',
  ecc: 'M',
  moduleSize: 4,
  style: 'square',
  darkColor: BLACK,
  lightColor: WHITE
}

export const DEFAULT_EAN13_OPTIONS: EAN13Options = {
  type: 'EAN_13',
  payload: '978020137962',
  moduleSize: 2,
  barHeight: 80,
  includeText: true,
  darkColor: BLACK,
  lightColor: WHITE
}

export function createBarcodeLayers(
  bgNetwork: VectorNetwork,
  bgFill: Fill,
  modulesNetwork: VectorNetwork,
  modulesFill: Fill,
  modulesName: string
): BarcodeChildPlan[] {
  return [
    {
      role: 'background',
      name: 'Background',
      vectorNetwork: bgNetwork,
      fills: [bgFill]
    },
    {
      role: 'modules',
      name: modulesName,
      vectorNetwork: modulesNetwork,
      fills: [modulesFill]
    }
  ]
}
