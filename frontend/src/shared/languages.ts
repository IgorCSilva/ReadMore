// /languages now returns canonical "origin-target" pair keys (e.g. "pt-en")
// instead of a bare target-language name (RESTRUCTURE_PLAN.md Step 3.1/3.2),
// so the dropdown's old `lang[0].toUpperCase() + lang.slice(1)` label logic
// would show "Pt-en" — this formats a readable label instead.
const LANGUAGE_NAMES: Record<string, string> = {
  pt: 'Portuguese',
  en: 'English',
  es: 'Spanish',
  ko: 'Korean',
}

export function formatLanguagePairLabel(pair: string): string {
  const [origin, target] = pair.split('-')
  const originName = LANGUAGE_NAMES[origin] ?? origin
  const targetName = LANGUAGE_NAMES[target] ?? target
  return `${originName} → ${targetName}`
}

// origin/target labels for the sentence/cue language pickers — same name
// table as the pair label above, just for one side of the pair at a time.
export function formatLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code
}

// BCP-47 locale tags for the Web Speech API fallback (SpeechSynthesisUtterance.lang)
// — the browser's local TTS needs a full locale tag, not the bare 2-letter
// code the backend's /tts proxy (Google Translate's `tl` param) accepts.
const SPEECH_LOCALES: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  ko: 'ko-KR',
}

export function speechLocaleFor(code: string): string {
  return SPEECH_LOCALES[code] ?? code
}
