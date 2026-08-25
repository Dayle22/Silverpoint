import { i18n } from '#vue/i18n/create'

export const toolMessageDefaults = {
  move: 'Move',
  frame: 'Frame',
  section: 'Section',
  slice: 'Slice',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  polygon: 'Polygon',
  star: 'Star',
  pen: 'Pen',
  pencil: 'Pencil',
  brush: 'Brush',
  text: 'Text',
  hand: 'Hand',
  shapeBuilder: 'Shape Builder',
  barcode: 'QR Code',
  barcodeEan13: 'EAN-13 Barcode'
} as const

export const toolMessages = i18n('tools', toolMessageDefaults)
