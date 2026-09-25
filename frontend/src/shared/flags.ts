export interface FlagInfo {
  code: string
  file: string
  country: string
}

// Flag image + native-writing country name shown per language code in the
// language-pair picker (SettingsPage.vue). Images live in
// frontend/public/images/flags — file names/extensions match exactly what's
// there. "en" maps to England/the England flag file (not a US flag, unlike
// shared/languages.ts's SPEECH_LOCALES table, which is a separate concern:
// picking a BCP-47 locale for speech synthesis, not a country to display).
const FLAGS: Record<string, FlagInfo> = {
  pt: { code: 'pt', file: 'brazil.png', country: 'Brasil' },
  en: { code: 'en', file: 'england.webp', country: 'England' },
  es: { code: 'es', file: 'spain.jpg', country: 'España' },
  ko: { code: 'ko', file: 'korea.png', country: '한국' },
  fr: { code: 'fr', file: 'france.png', country: 'France' },
  de: { code: 'de', file: 'germany.jpg', country: 'Deutschland' },
  ru: { code: 'ru', file: 'russia.webp', country: 'Россия' },
}

export function flagFor(code: string): FlagInfo {
  return FLAGS[code] ?? { code, file: '', country: code }
}

export function flagUrl(code: string): string {
  const file = flagFor(code).file
  return file ? `/images/flags/${file}` : ''
}
