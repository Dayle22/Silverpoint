import { browser, localeFrom } from '@nanostores/i18n'
import { atom } from 'nanostores'

export const AVAILABLE_LOCALES = ['en'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English'
}

const LOCALE_STORAGE_KEY = 'open-pencil-locale'

export const localeSetting = atom<Locale | undefined>(undefined)

export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))

function getLocalStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  if (typeof localStorage.getItem !== 'function') return null
  if (typeof localStorage.setItem !== 'function') return null
  return localStorage
}

export function setLocale(code: Locale) {
  localeSetting.set(code)
  getLocalStorage()?.setItem(LOCALE_STORAGE_KEY, code)
}

const saved = getLocalStorage()?.getItem(LOCALE_STORAGE_KEY) as Locale | null | undefined
if (saved && AVAILABLE_LOCALES.includes(saved)) {
  localeSetting.set(saved)
}
