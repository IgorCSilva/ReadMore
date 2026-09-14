import type {
  ChaptersResponse,
  LanguagesResponse,
  ProgressActionRequest,
  UserWordsResponse,
  WordsResponse,
} from './types'

// /data and /chapters are both backed by Google Sheets on the server side,
// which occasionally has a slow/failed round trip even after the server's
// own retries are exhausted. One extra client-side retry clears most of
// those without the user having to notice or reload manually.
async function fetchJsonWithRetry<T>(url: string, attempts = 2): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${url} responded with ${res.status}`)
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw lastErr
}

export async function getLanguages(): Promise<LanguagesResponse> {
  const res = await fetch('/languages', { cache: 'no-store' })
  if (!res.ok) throw new Error(`/languages responded with ${res.status}`)
  return (await res.json()) as LanguagesResponse
}

export function getUserWords(user: string, lang: string): Promise<UserWordsResponse> {
  const url = `/data?user=${encodeURIComponent(user)}&lang=${encodeURIComponent(lang)}`
  return fetchJsonWithRetry<UserWordsResponse>(url)
}

export function getChapters(user: string, lang: string): Promise<ChaptersResponse> {
  const url = `/chapters?user=${encodeURIComponent(user)}&lang=${encodeURIComponent(lang)}`
  return fetchJsonWithRetry<ChaptersResponse>(url)
}

export function getWords(lang: string): Promise<WordsResponse> {
  return fetchJsonWithRetry<WordsResponse>(`/words?lang=${encodeURIComponent(lang)}`)
}

export function ttsUrl(text: string): string {
  return `/tts?text=${encodeURIComponent(text)}`
}

function postProgressAction(path: string, body: ProgressActionRequest): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// These three intentionally return the raw fetch Response, unparsed and
// unchecked for status — matching viewer.html's original recordShown/
// markKnownAndAdvance/unhideWord, none of which read the response body or
// status (they're fire-and-forget; callers only .catch network-level
// failures). Preserved as-is rather than "fixed" during this extraction.

export function incrementShownCount(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/increment', { user, lang, word_id: wordId })
}

export function markWordKnown(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/mark-known', { user, lang, word_id: wordId })
}

export function showWordAgain(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/show-word', { user, lang, word_id: wordId })
}
