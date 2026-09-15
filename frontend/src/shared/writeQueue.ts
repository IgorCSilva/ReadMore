// Offline-first handling for the three progress-writing endpoints: try the
// network immediately; if it fails because we're offline (NetworkError, not
// a server-side rejection), save the write to localStorage and retry it
// once connectivity is back, instead of silently dropping it.
import { HttpError, NetworkError, incrementShownCount, markWordKnown, showWordAgain } from './api'
import { notify } from './notifications'

export type WriteActionType = 'increment' | 'mark-known' | 'show-word'

export interface QueuedWrite {
  id: number
  type: WriteActionType
  user: string
  lang: string
  wordId: string
  queuedAt: number
}

const QUEUE_KEY = 'readmore:write-queue:v1'

const ACTION_FNS: Record<WriteActionType, (user: string, lang: string, wordId: string) => Promise<Response>> = {
  increment: incrementShownCount,
  'mark-known': markWordKnown,
  'show-word': showWordAgain,
}

const ACTION_LABELS: Record<WriteActionType, string> = {
  increment: 'record that word as shown',
  'mark-known': 'mark that word as known',
  'show-word': 'show that word again',
}

function readQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueueToStorage(queue: QueuedWrite[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Best-effort — if storage is unavailable the write is simply lost on
    // reload instead of retried, no worse than before this feature existed.
  }
}

let nextId = 1

function enqueueWrite(entry: Omit<QueuedWrite, 'id' | 'queuedAt'>): void {
  const queue = readQueue()
  queue.push({ ...entry, id: nextId++, queuedAt: Date.now() })
  writeQueueToStorage(queue)
}

export function getQueuedWrites(): QueuedWrite[] {
  return readQueue()
}

// True if there's a queued write for this word that hasn't reached the
// server yet — lets the UI stay honest about words the user already acted
// on locally, even before the retry succeeds (see Flashcards.vue, which uses
// this to stop a background refresh from re-showing a word the user just
// marked known while offline).
export function hasQueuedAction(
  user: string,
  lang: string,
  wordId: string,
  type: WriteActionType,
): boolean {
  return readQueue().some(
    (w) => w.user === user && w.lang === lang && w.wordId === wordId && w.type === type,
  )
}

// Fire-and-forget: attempts the write now; queues it for later on a
// connectivity failure, or reports a real server-side rejection. Never
// throws — callers already applied their optimistic UI update and don't
// need to react to the outcome beyond what this already notifies.
export function performWrite(type: WriteActionType, user: string, lang: string, wordId: string): void {
  ACTION_FNS[type](user, lang, wordId).catch((err) => {
    if (err instanceof NetworkError) {
      enqueueWrite({ type, user, lang, wordId })
      notify('warning', `You're offline — we'll ${ACTION_LABELS[type]} once you're back online.`)
    } else {
      const message = err instanceof HttpError ? err.message : String(err)
      notify('error', `Couldn't ${ACTION_LABELS[type]} (${message}).`)
    }
  })
}

let flushing = false

// Replays queued writes in the order they were queued. Stops at the first
// connectivity failure (everything from there on is left queued — no point
// burning through the rest while still offline); a real server-side
// rejection drops just that one item and says so, since retrying it forever
// wouldn't help.
export async function flushQueuedWrites(): Promise<void> {
  if (flushing) return
  const queue = readQueue()
  if (queue.length === 0) return

  flushing = true
  try {
    let synced = 0
    let stillOffline = false
    const remaining: QueuedWrite[] = []

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      if (stillOffline) {
        remaining.push(item)
        continue
      }
      try {
        await ACTION_FNS[item.type](item.user, item.lang, item.wordId)
        synced++
      } catch (err) {
        if (err instanceof NetworkError) {
          stillOffline = true
          remaining.push(item)
        } else {
          const message = err instanceof HttpError ? err.message : String(err)
          notify(
            'error',
            `Couldn't ${ACTION_LABELS[item.type]} for a word saved while offline (${message}). It won't be retried.`,
          )
        }
      }
    }

    writeQueueToStorage(remaining)
    if (synced > 0) {
      notify('success', `Synced ${synced} change${synced === 1 ? '' : 's'} saved while offline.`)
    }
  } finally {
    flushing = false
  }
}
