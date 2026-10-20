// Shared by App.vue's chapter/topic list cards (itemCard) and exercises'
// boldInline, plus features/texts/Texts.vue's renderTextBody — extracted
// here rather than duplicated across those, since it's a genuine shared
// dependency of this step (Texts.vue needs it too), not a speculative
// refactor.
export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export interface StoryWordToken {
  // Original token with only leading/trailing punctuation stripped — shown
  // on the Study modal's word button and sent to /tts, so it keeps the
  // story's own casing and any curly apostrophe (e.g. "Than", "didn’t").
  display: string
  // Lookup key into Story.glossary: display further lowercased, with curly
  // apostrophes (‘/’) folded to a straight one so the backend
  // content (authored with straight apostrophes) always matches regardless
  // of which quote style the sentence text itself uses.
  key: string
}

// Only a leading/trailing letter or digit stops the strip — internal
// apostrophes ("didn't") and hyphens ("splish-sploshing") stay put, while a
// trailing stray dash used as punctuation ("went-") or a leading/trailing
// quote/comma/period is dropped.
const EDGE_PUNCTUATION_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu
const CURLY_APOSTROPHE_RE = /[‘’]/g

// Splits a story line/sentence into its words, in reading order (including
// repeats), for the Study modal's horizontally-scrollable word row — each
// token's `key` looks up straight into Story.glossary.
//
// `glossary`, when given, lets a run of consecutive words merge into one
// token when their space-joined key matches a multi-word glossary entry
// (e.g. "método del plato") — a handful of terms mean something genuinely
// different combined than word-by-word (closer to a phrasal verb than a
// plain noun phrase), so they get a single word-button and a single
// lookup, same one-click model as every other word. Greedy longest-match:
// at each position, the longest phrase found wins over a shorter one.
export function tokenizeStoryWords(
  sentence: string,
  glossary?: Record<string, unknown>,
): StoryWordToken[] {
  const singleTokens = sentence
    .split(/\s+/)
    .map((raw) => raw.replace(EDGE_PUNCTUATION_RE, ''))
    .filter((display) => display.length > 0)
    .map((display) => ({
      display,
      key: display.toLowerCase().replace(CURLY_APOSTROPHE_RE, "'"),
    }))

  const phraseKeyWordCounts = glossary
    ? Object.keys(glossary)
        .filter((key) => key.includes(' '))
        .map((key) => key.split(' ').length)
    : []
  if (phraseKeyWordCounts.length === 0) return singleTokens

  const maxWords = Math.max(...phraseKeyWordCounts)
  const merged: StoryWordToken[] = []
  let i = 0
  while (i < singleTokens.length) {
    let matchedWords = 0
    for (let n = Math.min(maxWords, singleTokens.length - i); n >= 2; n--) {
      const candidate = singleTokens.slice(i, i + n)
      const candidateKey = candidate.map((t) => t.key).join(' ')
      if (glossary && candidateKey in glossary) {
        merged.push({ display: candidate.map((t) => t.display).join(' '), key: candidateKey })
        matchedWords = n
        break
      }
    }
    if (matchedWords > 0) {
      i += matchedWords
    } else {
      merged.push(singleTokens[i])
      i += 1
    }
  }
  return merged
}
