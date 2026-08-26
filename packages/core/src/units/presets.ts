export type PresetGroup = 'screen' | 'print'

export interface FramePresetDefinition {
  id: string
  group: PresetGroup
  labelKey: string
  width: number
  height: number
  unit: 'px' | 'mm' | 'in'
  margin?: { value: number; unit: 'mm' | 'in' }
  bleed?: { value: number; unit: 'mm' | 'in' }
  panels?: number
}

export const FRAME_PRESETS: readonly FramePresetDefinition[] = [
  {
    id: 'square-1080',
    group: 'screen',
    labelKey: 'presetSquare1080',
    width: 1080,
    height: 1080,
    unit: 'px'
  },
  {
    id: 'story-1080x1920',
    group: 'screen',
    labelKey: 'presetStory1080x1920',
    width: 1080,
    height: 1920,
    unit: 'px'
  },
  {
    id: 'portrait-1080x1440',
    group: 'screen',
    labelKey: 'presetPortrait1080x1440',
    width: 1080,
    height: 1440,
    unit: 'px'
  },
  {
    id: 'a4',
    group: 'print',
    labelKey: 'presetA4',
    width: 210,
    height: 297,
    unit: 'mm',
    margin: { value: 10, unit: 'mm' },
    bleed: { value: 3, unit: 'mm' }
  },
  {
    id: 'us-letter',
    group: 'print',
    labelKey: 'presetUsLetter',
    width: 8.5,
    height: 11,
    unit: 'in',
    margin: { value: 0.5, unit: 'in' },
    bleed: { value: 0.125, unit: 'in' }
  },
  {
    id: 'business-card',
    group: 'print',
    labelKey: 'presetBusinessCard',
    width: 3.5,
    height: 2,
    unit: 'in',
    margin: { value: 0.125, unit: 'in' },
    bleed: { value: 0.125, unit: 'in' }
  },
  {
    id: 'poster',
    group: 'print',
    labelKey: 'presetPoster',
    width: 18,
    height: 24,
    unit: 'in',
    margin: { value: 0.5, unit: 'in' },
    bleed: { value: 0.125, unit: 'in' }
  },
  {
    id: 'tri-fold',
    group: 'print',
    labelKey: 'presetTriFold',
    width: 11,
    height: 8.5,
    unit: 'in',
    margin: { value: 0.25, unit: 'in' },
    bleed: { value: 0.125, unit: 'in' },
    panels: 3
  }
]
