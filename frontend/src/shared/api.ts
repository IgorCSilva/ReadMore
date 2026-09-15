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

// Thrown when fetch() itself rejects — offline, DNS failure, server
// unreachable, CORS block. Never thrown for a non-2xx response, which
// resolves normally and is handled separately below. That split is what
// lets callers (see shared/writeQueue.ts) tell "retry once we're back
// online" apart from "the server rejected this, retrying won't help".
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('network request failed')
    this.cause = cause
  }
}

// Thrown for a non-2xx response — the request reached the server, so this
// is a real rejection (bad input, word not assigned, etc.), not a
// connectivity problem.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function postProgressAction(path: string, body: ProgressActionRequest): Promise<Response> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new NetworkError(err)
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as { error?: string } | null
    throw new HttpError(res.status, parsed?.error || `${path} responded with ${res.status}`)
  }
  return res
}

export function incrementShownCount(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/increment', { user, lang, word_id: wordId })
}

export function markWordKnown(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/mark-known', { user, lang, word_id: wordId })
}

export function showWordAgain(user: string, lang: string, wordId: string): Promise<Response> {
  return postProgressAction('/show-word', { user, lang, word_id: wordId })
}
