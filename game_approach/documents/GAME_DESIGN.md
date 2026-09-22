# Game Design

Living design reference. Source of truth for game-*feel* decisions; see
`GAME_ARCHITECTURE.md` for how those decisions get implemented, and
`PROJECT_ANALYSIS.md` for how the game relates to the existing ReadMore app.

## Core idea

The language is not the content of the game — it's one of the player's tools for
interacting with the world. The player never sees "here are 20 words to
memorize"; they encounter a situation, want to do something, and the language
they need to do it is what they learn.

```
Encounter something → Want to do something → Need language → Discover/learn it
   → Use it → World responds → New possibility appears → Explore → repeat
```

If a proposed feature doesn't serve this loop, question whether it belongs in
the current milestone.

## Emotional target

Calm, curious, mysterious, playful, exploratory, welcoming, rewarding. The
player should feel like they're exploring a little world and gradually figuring
out how it works — never like they're in a classroom or taking a quiz with a
game skin.

## Design principles (non-negotiable, from `game_approach.md`)

1. **The world creates language need, not the reverse.** Never ask "how do we
   fit word X into the game" — ask "what situation makes the player need word
   X". A word earns its place by solving a problem, not by belonging to a topic
   category.
2. **Words become abilities.** Learning a word expands what the player can do
   (OPEN → doors become usable; UNDER → spatial puzzles become solvable).
   Progression is language knowledge → available actions → world possibilities.
3. **Discovery over instruction.** The player is rarely told "learn WORD_X"
   directly. Repeated context (an NPC using it, a label, a locked situation)
   builds meaning before the game asks for recall.
4. **Language controls access, not artificial levels.** A locked door stays
   locked because the player doesn't yet have the words to open it or find the
   key — not because of an XP gate.
5. **Deterministic first, AI/NLP later.** The first slice uses a controlled
   command grammar and scripted dialogue — no LLM dependency in the core loop
   (see `game_approach.md` §33–34 for the future parser evolution path).
6. **Quizzing is a tool, not the experience.** Traditional recall checks may
   exist but must not dominate; exploration/interaction/consequence carry most
   of the learning.

## Language-as-mechanics catalog

| Category      | Becomes                          | Example words (topic-dependent) |
|---------------|-----------------------------------|----------------------------------|
| Nouns         | Objects in the world               | door, key, box |
| Verbs         | Actions the player can perform     | open, take, give, follow |
| Adjectives    | Object modifiers                   | big, small, hot |
| Prepositions  | Spatial relationships               | under, on, behind |
| Expressions   | Social/dialogue abilities           | come here, help me, where is...? |

Not all categories need to ship in the first slice — see per-topic scope below.

## Current slice: Greetings & self-introduction

Anchor pair/topic: pt-es `top-A0-EL-1` (25 words) — decided in
`PROJECT_ANALYSIS.md` §H (pt-en has the same topic id but its own independent
15-word vocabulary; it's the step-11 cross-pair validation target instead).
This topic is dialogue-shaped, not object-shaped, so the design leans into
conversation mechanics rather than spatial ones:

- **World**: a small space built around meeting someone (e.g. an entryway/room
  where an NPC is encountered) — not an object-dense environment.
- **Core interaction**: the NPC won't respond/proceed until the player produces
  the right greeting/self-introduction phrase from the topic's vocabulary.
- **Vocabulary role split** (finalized in Milestone 4's game-content mapping,
  `game_approach/content/game-pt-es.json`): most of these 25 words are dialogue
  lines (hola, chao, cómo, sí, gracias, de nada, no) or pronouns/grammar words
  (yo, mi, es, estoy, nombre, de, ...) rather than objects or spatial
  prepositions — so the puzzle for this slice is conversational
  recall/production, not fetch-and-give.

Future slices on object-heavy topics (e.g. Food / Fruits & Vegetables) are
expected to lean on the object/spatial mechanics instead — the engine must
support both without being redesigned per topic (see
`LANGUAGE_INTEGRATION.md`).

## Difficulty control

The existing content model already scopes vocabulary per topic/chapter — reuse
that instead of inventing a separate difficulty system. A topic's word list *is*
the beginner-area constraint; combinations (`OPEN DOOR` → `TAKE KEY BEFORE OPEN
DOOR`) are a later-topic/later-chapter concern, not a first-slice one.

## Art direction & UI (target, not yet built)

- Small, beautiful, restrained environments; soft lighting; tactile objects.
- Minimal UI — the world occupies most of the screen; a word-discovery panel and
  a lightweight interaction prompt are the only expected overlays (see
  `game_approach.md` §44 for the reference layout).
- Avoid: generic cartoon assets, noisy HUD, aggressive particles, excessive
  gamification.

## Inspirations (principles only — never copy art/mechanics/IP)

- **Bomberman** — compact readable worlds, immediate cause and effect.
- **Cassette Beasts** — discovery, progression, curiosity about what's possible.
- **Koira** — quiet atmosphere, companionship, restrained presentation.
- **Organized Inside** — environmental interaction, learning through
  experimentation.

## Decisions log

- **2026-09-22** — First vertical slice is dialogue-shaped (Greetings), not
  object-shaped (Food). See `PROJECT_ANALYSIS.md` §H for the full reasoning.
