// Dedicated color/style definitions for grammatical gender, one entry per
// gender_id a word can carry (see backend/words/en_words.json and
// backend/words/es_words.json's own "gender_id" field). `style` is a
// template with "{word}" standing in for the word text: masculine words
// get "|" prepended (|padre), feminine words get "°" appended (casa°),
// neuter and not_apply words are left undecorated.
export interface Gender {
  id: string
  color: string | null
  style: string
}

const GENDERS: Record<string, Gender> = {
  masculine: { id: 'masculine', color: '#4f8cff', style: '|{word}' },
  feminine: { id: 'feminine', color: '#ff5e8b', style: '{word}°' },
  neuter: { id: 'neuter', color: '#8b91a0', style: '{word}' },
  not_apply: { id: 'not_apply', color: null, style: '{word}' },
}

const DEFAULT_GENDER = GENDERS.not_apply

export function getGender(genderId?: string | null): Gender {
  return (genderId && GENDERS[genderId]) || DEFAULT_GENDER
}

export function formatWordByGender(word: string, genderId?: string | null): string {
  return getGender(genderId).style.replace('{word}', word)
}
