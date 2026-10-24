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
  // Contextual example sentence (origin language, target word **bolded**),
  // shown under the word on the teaching flow's first page — authored per
  // topic under backend/content/auxiliar_sentences/, so most words don't
  // have one yet and this comes back "". Optional for the same reason as
  // pinyin below: most test fixtures predate this field.
  auxiliar_sentence?: string
  // Only Chinese words carry this (romanization shown on the teaching flow's
  // first page) — every other language's wire response has it as "" (the
  // backend's row.get("pinyin", "") default), which is why it's optional
  // here rather than required: most test fixtures across the app predate
  // this field and never set it.
  pinyin?: string
  gender_id: string
  particle_type: string
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

// A user's own "users" sheet data (see backend/apps-script/Code.gs's schema
// comment) — one shape covering every field a caller might need about them,
// rather than one endpoint per field.
export interface UserResponse {
  exists: boolean
  language_pairs: string[]
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

// Listing weight only (no sentences/glossary) — what /stories returns for
// every story across every level, grouped client-side by `level`.
export interface StorySummary {
  story_id: string
  title: string
  level: string
}

export interface ChatTurn {
  role: 'user' | 'ai'
  content: string
}

export interface ChatRequest {
  lang: string
  level: string
  message: string
  history: ChatTurn[]
}

export interface ChatResponse {
  reply: string
}

export interface StoriesResponse {
  lang: string
  stories: StorySummary[]
}

// meaning is in the pair's origin language (what's being explained);
// examples/synonyms/antonyms are in the target language (what's being
// learned, and what the Study modal's listen buttons play back).
export interface GlossaryEntry {
  meaning: string
  examples: string[]
  synonyms: string[]
  antonyms: string[]
}

// sentences is one array entry per original line of the source text, not
// per grammatical sentence — "" marks a blank line between stanzas/
// paragraphs. glossary is keyed by normalized word (lowercased, outer
// punctuation stripped, curly quotes folded to straight) — see
// tokenizeStoryWords in shared/text.ts for the matching lookup key.
export interface Story {
  story_id: string
  title: string
  level: string
  sentences: string[]
  glossary: Record<string, GlossaryEntry>
}

export interface StoryResponse {
  lang: string
  story: Story
}

// Listing weight only (no sentences) — what /api/learning-topics returns
// for every topic across every theme, grouped client-side by `theme`.
export interface LearningTopicSummary {
  topic_id: string
  theme: string
  title: string
  level: string
}

export interface LearningTopicsResponse {
  lang: string
  topics: LearningTopicSummary[]
}

// sentences is one array entry per original line of the source Markdown
// file, same "" blank-line convention as Story.sentences above. glossary
// is the same pair-specific Study overlay as Story.glossary (including
// phrase keys like "método del plato") — see tokenizeStoryWords in
// shared/text.ts for the matching lookup key/merge logic.
export interface LearningTopic {
  topic_id: string
  theme: string
  title: string
  level: string
  sentences: string[]
  glossary: Record<string, GlossaryEntry>
}

export interface LearningTopicResponse {
  lang: string
  topic: LearningTopic
}
