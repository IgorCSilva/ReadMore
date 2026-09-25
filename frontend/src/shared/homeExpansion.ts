import { reactive } from 'vue'

export interface HomeExpansionRequest {
  topicId: string
  partIndex: number
}

// A plain module-level reactive object — same "no store, single shared
// module instance" pattern as currentSelection.ts/currentUser.ts. Bridges
// PartFlowPage (finishing a part) to HomePage (whose accordion state is its
// own local refs, reset on every mount) across a router navigation: read
// once via consumeHomeExpansion() on Home's mount, then cleared, so a later
// plain visit to Home doesn't keep re-expanding a stale request.
const state = reactive<{ pending: HomeExpansionRequest | null }>({ pending: null })

export function requestHomeExpansion(request: HomeExpansionRequest): void {
  state.pending = request
}

export function consumeHomeExpansion(): HomeExpansionRequest | null {
  const pending = state.pending
  state.pending = null
  return pending
}
