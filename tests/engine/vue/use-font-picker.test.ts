import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'

import { useFontPicker } from '@open-pencil/vue'
import type { FontFamilyOption } from '@open-pencil/core/text'

const mockFamilies: FontFamilyOption[] = [
  { family: 'Inter', source: 'bundled' },
  { family: 'Roboto', source: 'google' },
  { family: 'Open Sans', source: 'google' },
  { family: 'Custom Local Font', source: 'local' },
  { family: 'Futura Md BT', source: 'local' },
  { family: 'DM Sans', source: 'google' },
  { family: 'Fira Code', source: 'google' }
]

describe('useFontPicker categories and filtering', () => {
  test('initializes with default categories and filters by category', async () => {
    const modelValue = ref('Inter')
    const listFamilies = async () => mockFamilies
    const documentFonts = ['Custom Local Font', 'Inter']
    const popularFonts = ['Inter', 'Roboto', 'DM Sans']
    const variableFonts = ['Inter', 'DM Sans']

    const picker = useFontPicker({
      modelValue,
      listFamilies,
      documentFonts: () => documentFonts,
      popularFonts,
      variableFonts
    })

    // Open picker to trigger load
    picker.open.value = true
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })

    // Default category is 'all'
    expect(picker.activeCategory.value).toBe('all')
    expect(picker.filtered.value.length).toBe(mockFamilies.length)

    // Switch to 'in-file'
    picker.setCategory('in-file')
    expect(picker.activeCategory.value).toBe('in-file')
    const inFileFamilies = picker.filtered.value.map((f) => f.family)
    expect(inFileFamilies).toContain('Custom Local Font')
    expect(inFileFamilies).toContain('Inter')
    expect(inFileFamilies).not.toContain('Roboto')

    // Switch to 'installed'
    picker.setCategory('installed')
    const installedFamilies = picker.filtered.value.map((f) => f.family)
    expect(installedFamilies).toContain('Custom Local Font')
    expect(installedFamilies).toContain('Futura Md BT')
    expect(installedFamilies).toContain('Inter') // bundled counts as local
    expect(installedFamilies).not.toContain('Roboto')

    // Switch to 'popular'
    picker.setCategory('popular')
    const popularResults = picker.filtered.value.map((f) => f.family)
    expect(popularResults).toContain('Inter')
    expect(popularResults).toContain('Roboto')
    expect(popularResults).toContain('DM Sans')
    expect(popularResults).not.toContain('Futura Md BT')

    // Switch to 'google'
    picker.setCategory('google')
    const googleResults = picker.filtered.value.map((f) => f.family)
    expect(googleResults).toContain('Roboto')
    expect(googleResults).toContain('Open Sans')
    expect(googleResults).toContain('DM Sans')
    expect(googleResults).not.toContain('Futura Md BT')

    // Filter by search term
    picker.searchTerm.value = 'Roboto'
    expect(picker.filtered.value.map((f) => f.family)).toEqual(['Roboto'])

    // Select font
    picker.select('Roboto')
    expect(modelValue.value).toBe('Roboto')
    expect(picker.open.value).toBe(false)
  })
})
