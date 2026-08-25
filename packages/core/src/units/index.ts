export * from './document'
import type { DocumentUnit, DocumentUnits } from './document'

export const DPI_PRESETS = [72, 96, 150, 300, 600] as const

export function pxPerUnit(units: DocumentUnits): number {
  const dpi = units.dpi > 0 ? units.dpi : 300
  switch (units.unit) {
    case 'in':
      return dpi
    case 'mm':
      return dpi / 25.4
    case 'cm':
      return dpi / 2.54
    default:
      return 1
  }
}

export function pxToUnit(px: number, units: DocumentUnits): number {
  return px / pxPerUnit(units)
}

export function unitToPx(value: number, units: DocumentUnits): number {
  return value * pxPerUnit(units)
}

export function formatUnitValue(px: number, units: DocumentUnits): string {
  const unitVal = pxToUnit(px, units)
  if (units.unit === 'px') {
    return Math.round(unitVal).toString()
  }
  const rounded = Math.round(unitVal * 100) / 100
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  return normalized.toString()
}

export function unitStepLadder(unit: DocumentUnit): number[] {
  switch (unit) {
    case 'px':
      return [1, 2, 5, 10]
    case 'mm':
      return [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
    case 'cm':
      return [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]
    case 'in':
      return [0.125, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]
    default:
      return [1, 2, 5, 10]
  }
}

export function resolveUnitCommitPx(
  inputUnitValue: number,
  currentPx: number,
  units: DocumentUnits
): number {
  const nextPx = unitToPx(inputUnitValue, units)
  if (formatUnitValue(currentPx, units) === formatUnitValue(nextPx, units)) {
    return currentPx
  }
  return nextPx
}

export * from './presets'
export * from './dpi'
export * from './document'


