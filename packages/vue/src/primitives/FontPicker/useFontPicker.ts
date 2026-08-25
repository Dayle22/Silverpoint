import { useFilter } from 'reka-ui'
import { computed, ref, unref, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { FontFamilyOption } from '@open-pencil/core/text'

export type FontAccessState = 'unsupported' | 'prompt' | 'granted' | 'denied'
export type { FontFamilyOption, FontFamilySource } from '@open-pencil/core/text'

export type FontCategory =
  | 'all'
  | 'in-file'
  | 'popular'
  | 'google'
  | 'variable'
  | 'installed'

export interface FontCategoryItem {
  id: FontCategory
  label: string
}

export const DEFAULT_FONT_CATEGORIES: FontCategoryItem[] = [
  { id: 'all', label: 'All fonts' },
  { id: 'in-file', label: 'In this file' },
  { id: 'popular', label: 'Popular fonts' },
  { id: 'google', label: 'Google fonts' },
  { id: 'variable', label: 'Variable fonts' },
  { id: 'installed', label: 'Installed by you' }
]

export interface FontAccessController {
  state: () => FontAccessState
  load: () => Promise<string[] | FontFamilyOption[]>
}

/**
 * Options for {@link useFontPicker}.
 */
export interface UseFontPickerOptions {
  /** Writable model for the selected font family. */
  modelValue: { value: string }
  /** Async source for available font families. */
  listFamilies: () => Promise<string[] | FontFamilyOption[]>
  /** Host-provided local-font permission controller. */
  localFontAccess?: FontAccessController
  /** Document / in-file font names */
  documentFonts?: MaybeRefOrGetter<string[]>
  /** Popular font family names */
  popularFonts?: MaybeRefOrGetter<string[]>
  /** Google font family names */
  googleFonts?: MaybeRefOrGetter<string[]>
  /** Variable font family names */
  variableFonts?: MaybeRefOrGetter<string[]>
  /** Initial selected category */
  initialCategory?: FontCategory
  /** Optional callback fired after a family is selected. */
  onSelect?: (family: string) => void
}

function normalizeOptions(items: string[] | FontFamilyOption[]): FontFamilyOption[] {
  return items.map((item) => (typeof item === 'string' ? { family: item, source: 'local' } : item))
}

/**
 * Returns searchable font-picker state and selection helpers.
 */
export function useFontPicker(options: UseFontPickerOptions) {
  const families = ref<FontFamilyOption[]>([])
  const searchTerm = ref('')
  const open = ref(false)
  const loading = ref(false)
  const activeCategory = ref<FontCategory>(options.initialCategory ?? 'all')
  const accessState = ref<FontAccessState>(options.localFontAccess?.state() ?? 'granted')

  const documentFonts = computed<string[]>(() => {
    if (!options.documentFonts) return []
    const val =
      typeof options.documentFonts === 'function'
        ? options.documentFonts()
        : unref(options.documentFonts)
    return Array.isArray(val) ? val : []
  })

  const popularFonts = computed<string[]>(() => {
    if (!options.popularFonts) return []
    const val =
      typeof options.popularFonts === 'function'
        ? options.popularFonts()
        : unref(options.popularFonts)
    return Array.isArray(val) ? val : []
  })

  const googleFonts = computed<string[]>(() => {
    if (!options.googleFonts) return []
    const val =
      typeof options.googleFonts === 'function'
        ? options.googleFonts()
        : unref(options.googleFonts)
    return Array.isArray(val) ? val : []
  })

  const variableFonts = computed<string[]>(() => {
    if (!options.variableFonts) return []
    const val =
      typeof options.variableFonts === 'function'
        ? options.variableFonts()
        : unref(options.variableFonts)
    return Array.isArray(val) ? val : []
  })

  const categoryFamilies = computed<FontFamilyOption[]>(() => {
    const all = families.value
    const cat = activeCategory.value

    switch (cat) {
      case 'all':
        return all

      case 'in-file': {
        const docSet = new Set(documentFonts.value.map((f) => f.toLowerCase().trim()))
        const matched = all.filter((opt) => docSet.has(opt.family.toLowerCase().trim()))
        const matchedNames = new Set(matched.map((m) => m.family.toLowerCase().trim()))
        const missing: FontFamilyOption[] = documentFonts.value
          .filter((name) => name && !matchedNames.has(name.toLowerCase().trim()))
          .map((family) => ({ family, source: 'local' }))
        return [...missing, ...matched]
      }

      case 'popular': {
        const popSet = new Set(popularFonts.value.map((f) => f.toLowerCase().trim()))
        const matched = all.filter((opt) => popSet.has(opt.family.toLowerCase().trim()))
        const matchedNames = new Set(matched.map((m) => m.family.toLowerCase().trim()))
        const missing: FontFamilyOption[] = popularFonts.value
          .filter((name) => name && !matchedNames.has(name.toLowerCase().trim()))
          .map((family) => ({ family, source: 'local' }))
        return [...matched, ...missing].sort((a, b) => a.family.localeCompare(b.family))
      }

      case 'google': {
        const googleSet = new Set(googleFonts.value.map((f) => f.toLowerCase().trim()))
        const matched = all.filter(
          (opt) =>
            opt.source === 'google' ||
            opt.source === 'fontsource' ||
            opt.source === 'bunny' ||
            opt.source === 'fontshare' ||
            googleSet.has(opt.family.toLowerCase().trim())
        )
        const matchedNames = new Set(matched.map((m) => m.family.toLowerCase().trim()))
        const missing: FontFamilyOption[] = googleFonts.value
          .filter((name) => name && !matchedNames.has(name.toLowerCase().trim()))
          .map((family) => ({ family, source: 'google' }))
        return [...matched, ...missing].sort((a, b) => a.family.localeCompare(b.family))
      }

      case 'variable': {
        const varSet = new Set(variableFonts.value.map((f) => f.toLowerCase().trim()))
        return all.filter(
          (opt) =>
            varSet.has(opt.family.toLowerCase().trim()) ||
            opt.family.toLowerCase().includes('variable') ||
            opt.family.toLowerCase().includes('flex')
        )
      }

      case 'installed':
        return all.filter((opt) => opt.source === 'local' || opt.source === 'bundled')

      default:
        return all
    }
  })

  const { contains } = useFilter({ sensitivity: 'base' })
  const filtered = computed(() => {
    if (!searchTerm.value) return categoryFamilies.value
    return categoryFamilies.value.filter((option) => contains(option.family, searchTerm.value))
  })

  async function loadFamilies() {
    if (families.value.length > 0 || loading.value) return
    loading.value = true
    try {
      families.value = normalizeOptions(await options.listFamilies())
      accessState.value = options.localFontAccess?.state() ?? accessState.value
    } finally {
      loading.value = false
    }
  }

  watch(open, async (isOpen) => {
    if (!isOpen) return
    searchTerm.value = ''
    accessState.value = options.localFontAccess?.state() ?? accessState.value
    if (accessState.value === 'prompt') {
      await requestAccess()
      return
    }
    await loadFamilies()
  })

  async function requestAccess() {
    if (!options.localFontAccess || loading.value) return
    loading.value = true
    try {
      families.value = normalizeOptions(await options.localFontAccess.load())
      accessState.value = options.localFontAccess.state()
    } finally {
      loading.value = false
    }
  }

  function select(family: string) {
    options.modelValue.value = family
    options.onSelect?.(family)
    open.value = false
  }

  function setCategory(category: FontCategory) {
    activeCategory.value = category
  }

  return {
    families,
    categories: DEFAULT_FONT_CATEGORIES,
    activeCategory,
    setCategory,
    searchTerm,
    open,
    filtered,
    loading,
    accessState,
    requestAccess,
    select
  }
}
