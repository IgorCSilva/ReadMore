# Multiplayer Architecture

Not implemented in the first vertical slice. This document exists so
single-player decisions don't quietly foreclose multiplayer later — every
architectural choice in `GAME_ARCHITECTURE.md` is checked against this file.
See `game_approach.md` §18–21 and §47–48 for the original requirements.

## Why this matters now, before any multiplayer code exists

The single-player prototype must not treat the browser as authoritative. The
conceptual shape to preserve from day one:

```
CLIENT → GAME SERVER → PERSISTENT GAME STATE
```

Even with one player and no server round-trip for game actions yet, the code
should already be structured so a server can later sit in that position without
a rewrite.

## State separation (enforced from Milestone 2 onward)

| Category | Examples | Lives in | Persisted? |
|---|---|---|---|
| Local/client state | camera, transient UI, animation | Phaser scene instance only | No |
| Authoritative game state | player position, inventory, object/puzzle/quest state, unlocked abilities | plain serializable objects, mutated only via `ApplyGameAction` | Yes — `GameStateRepository` |
| Learning state | word familiarity, shown_count, confidence | existing progress system (unchanged) | Yes — existing `ProgressRepository` |

The critical discipline: **Phaser draw/update code never mutates authoritative
state directly.** It calls into the action layer (`ApplyGameAction`), which
returns a state delta; the scene re-renders from that delta. This is what makes
the same action handler usable locally now and server-side later without the
scene code changing.

## Persistence

Render's default filesystem is ephemeral — instances get replaced, deployments
wipe local files. Authoritative game state therefore cannot live in local JSON
or in-memory server state, even in the single-player prototype (§21 of
`game_approach.md`). Following the pattern already established for
progress/topics/corrections: a new Sheets-backed `GameStateRepository`,
scoped `(email, lang)`, is the default choice — consistent with the rest of the
app's persistence strategy rather than introducing a second storage technology
for one feature. Revisit only if/when game state's shape or write volume
outgrows what the Sheets webapp can reasonably handle.

## Event catalog (shared with `GAME_ARCHITECTURE.md`'s event system)

The same events that drive learning-system integration are the ones a future
server would broadcast to other clients:

```
PLAYER_JOINED, PLAYER_LEFT, PLAYER_MOVED
OBJECT_INTERACTED, OBJECT_CHANGED, ITEM_PICKED_UP
QUEST_UPDATED, DIALOGUE_STARTED, PUZZLE_SOLVED
```

Designing one event vocabulary now — rather than a single-player-only one plus
a separate multiplayer one later — avoids a translation layer when WebSockets
are added.

## Future transport

When multiplayer is actually built: WebSockets, since Render supports them on
Web Services (not static-only deployments). Not evaluated further until the
single-player loop is validated — no transport code should be written before
there's an authoritative-state/action-layer boundary for it to sit behind.

## Design intent for when it arrives (not built yet)

Per `game_approach.md` §48, multiplayer should make the target language part of
cooperation, not bolt on a generic chat box — e.g. one player knows a word the
other doesn't, and they must combine what each has learned to proceed. This
shapes future quest/puzzle design (two-player word-combination puzzles) but has
no bearing on the current single-player architecture beyond "keep state
separation clean enough that this is addable later."

## Status

Design constraints only — no server, no WebSocket, no multi-client code exists.
Revisit this document once the single-player vertical slice (Milestones 2–10)
is validated and playable.
