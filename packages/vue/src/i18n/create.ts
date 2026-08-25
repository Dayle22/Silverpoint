import { createI18n } from '@nanostores/i18n'

import { locale } from '#vue/i18n/locale'
import type { Locale } from '#vue/i18n/locale'

export const i18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get() {
    return {}
  }
})
