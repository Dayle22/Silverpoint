export const PREFERENCES_SECTION_IDS = [
  'appearance',
  'canvas',
  'guides',
  'capabilities',
  'ai',
  'shortcuts'
] as const

export type PreferencesSectionId = (typeof PREFERENCES_SECTION_IDS)[number]

export const DEFAULT_PREFERENCES_SECTION: PreferencesSectionId = 'appearance'

export function normalisePreferencesSection(value: unknown): PreferencesSectionId {
  if (typeof value === 'string' && (PREFERENCES_SECTION_IDS as readonly string[]).includes(value)) {
    return value as PreferencesSectionId
  }
  return DEFAULT_PREFERENCES_SECTION
}
