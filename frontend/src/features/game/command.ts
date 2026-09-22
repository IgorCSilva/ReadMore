// Pure and Phaser-free on purpose, same reasoning as interaction.ts and
// sceneItems.ts — GAME_ARCHITECTURE.md's testing strategy specifically calls
// out the command parser as independent of both Phaser and FastAPI.
//
// Milestone 6 slice: SAY is the only intent. The current anchor topic
// (Greetings & self-introduction, see GAME_DESIGN.md's "Current slice") is
// dialogue-shaped — its vocabulary is dialogue lines and nouns/grammar words,
// not the OPEN/TAKE/PUSH-style verbs game_approach.md §34 illustrates — so
// "attempt to say this word" is the one action this slice's vocabulary
// supports. SAY itself is a fixed, hardcoded keyword rather than drawn from
// the topic's vocabulary (it's the universal action, available regardless of
// topic); TARGET must match a real word from the *active* topic's vocabulary,
// which is what makes this language-gated rather than a free-text box — the
// player has to already know the right word to produce a valid command.
//
// Field names (action_type/target_word_id) mirror the backend GameAction
// dataclass (backend/app/domain/entities.py) rather than camelCase, since
// GAME_ARCHITECTURE.md requires this shape to be exactly what a future
// ApplyGameAction call sends over the wire (Milestone 9/10) — no translation
// layer to keep in sync.

export interface CommandVocabularyEntry {
  word_id: string
  text: string
}

export interface GameAction {
  action_type: string
  target_word_id: string | null
}

export type ParsedCommand =
  | { ok: true; action: GameAction }
  | { ok: false; reason: 'empty' | 'unknown_intent' | 'unknown_target' }

const INTENTS = ['SAY']

export function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean)
}

export function parseCommand(input: string, vocabulary: CommandVocabularyEntry[]): ParsedCommand {
  const tokens = tokenize(input)
  if (tokens.length === 0) {
    return { ok: false, reason: 'empty' }
  }

  const [intent, ...targetTokens] = tokens
  if (!INTENTS.includes(intent.toUpperCase())) {
    return { ok: false, reason: 'unknown_intent' }
  }

  const targetText = targetTokens.join(' ').toLowerCase()
  const match = vocabulary.find((entry) => entry.text.toLowerCase() === targetText)
  if (!match) {
    return { ok: false, reason: 'unknown_target' }
  }

  return { ok: true, action: { action_type: intent.toUpperCase(), target_word_id: match.word_id } }
}
