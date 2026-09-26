// Mirrors backend/app/infrastructure/dtos/*.py — field names match the wire
// JSON exactly (snake_case, same as the Pydantic models serialize), not
// camelCase, so these stay a direct reflection of the actual response
// shapes rather than an additional translation layer.

export interface Word {
  word_id: string
  original: string
  filename: string
  sentence: string
  cue: string
  gender_id: string
}

export interface WordsResponse {
  lang: string
  words: Word[]
}

export interface UserWord extends Word {
  confident: boolean
  shown_count: number
  show: boolean
}

export interface UserWordsResponse {
  lang: string
  words: UserWord[]
}

export interface Text {
  text_id: string
  number: number
  title: string
  body: string
}

export interface Sentence {
  sentence_number: number
  content: string
}

// A standalone, natural target-language sentence (unlike Sentence, which is
// an origin-language sentence with **bolded** target words) — used by the
// Phrases tab. word_ids lists every topic word present in the sentence, in
// the order it appears, already resolved to root word_ids.
export interface Phrase {
  id: string
  sentence: string
  word_ids: string[]
}

export interface Topic {
  topic_id: string
  number: number
  title: string
  description: string
  word_ids: string[]
  texts: Text[]
  sentences: Sentence[]
  phrases: Phrase[]
  status: string
  // Left untyped on purpose, matching backend/app/domain/entities.py's
  // Topic.exercises (list[dict]) — modeling every exercise variant's shape
  // is out of scope for this step on both sides.
  exercises: Record<string, unknown>[]
}

export interface Chapter {
  chapter_id: string
  number: number
  title: string
  description: string
  topics: Topic[]
  status: string
}

export interface ChaptersResponse {
  lang: string
  chapters: Chapter[]
}

export interface LanguagesResponse {
  languages: string[]
}

// word_ids carried over from earlier topics for spaced review, in
// curriculum order — see reinforcement_word_ids in
// backend/app/application/services/reinforcement_words.py.
export type ReinforcementWords = string[]

export interface ProgressActionRequest {
  user: string
  lang: string
  word_id: string
}

export interface IncrementResponse {
  word_id: string
  shown_count: number
}

export interface MarkKnownResponse {
  word_id: string
  show: false
}

export interface ShowWordResponse {
  word_id: string
  show: true
}

export interface ErrorResponse {
  error: string
}

export interface CorrectionRequest {
  chapter_number: number
  topic_number: number
  lang: string
  current: string[]
  correction: string[]
}
