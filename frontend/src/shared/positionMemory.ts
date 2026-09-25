// Remembers a single numeric "where was I" value per page across a full
// unmount/remount cycle (e.g. leaving ReadUnderstandPage via Exit/Finish and
// reopening the same topic from Home, or leaving mid-way through
// ListenIdentifyPage's phrase rounds) — a plain module-level Map, same "no
// store" convention as homeExpansion.ts, keyed by caller-chosen strings so
// unrelated pages/topics can't collide. The value is opaque to this module
// (a scroll offset in pixels, a round index, ...) — callers own the meaning.
const positions = new Map<string, number>()

export function savePosition(key: string, value: number): void {
  positions.set(key, value)
}

export function getPosition(key: string): number {
  return positions.get(key) ?? 0
}
