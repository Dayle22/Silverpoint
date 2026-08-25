import { mock } from 'bun:test'

const icons = [
  'boxes',
  'square-dashed-bottom',
  'eclipse',
  'droplet',
  'layers-2',
  'focus',
  'dice-5',
  'contrast',
  'palette',
  'spline'
]

for (const icon of icons) {
  mock.module(`~icons/lucide/${icon}`, () => ({
    default: { name: `IconLucide_${icon}` }
  }))
}
