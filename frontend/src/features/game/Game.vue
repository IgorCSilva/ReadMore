<template>
  <div id="topic-game-panel" style="display:none">
    <div class="game-stage" ref="containerRef"></div>
    <form class="command-bar" @submit.prevent="submitCommand">
      <input
        v-model="commandInput"
        type="text"
        placeholder="SAY <word>"
        aria-label="Game command input"
      />
      <button type="submit">Send</button>
    </form>
    <p class="command-feedback">{{ commandFeedback }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Phaser from 'phaser'
import { getGameArea, getWords } from '../../shared/api'
import { performWrite } from '../../shared/writeQueue'
import { buildSceneItems, type SceneItem } from './sceneItems'
import { isWithinInteractRange } from './interaction'
import { parseCommand, type CommandVocabularyEntry, type GameAction } from './command'
import { advanceQuest, buildQuestSteps, questPrompt, type QuestProgress, type QuestStep } from './quest'
import { buildGateState, tryOpenGate, type GateState } from './gate'

// Milestone 4 of game_approach/documents/DEVELOPMENT_ROADMAP.md: renders a
// topic's game-content mapping (see LANGUAGE_INTEGRATION.md) as static
// labelled text, one per GameObject, color-coded by role. Scene content is
// entirely data-driven from the active lang/topic; MainScene itself has no
// per-topic or per-language logic.
//
// Milestone 5 adds the first gameplay primitive on top of that: a player
// character (arrow-key movement, bounded to the canvas via Arcade physics)
// and one interactable object — the NPC anchor for this dialogue-shaped
// slice (see GAME_DESIGN.md's "Current slice" section) — that shows a
// prompt on proximity and toggles a visible state on interact. No dialogue
// or language-gating yet; that's Milestones 6–7 building on this.
//
// This component stays mounted for the lifetime of the app (same as Typing/
// Dictation/Quiz/Phrases) — only #topic-game-panel's display is toggled when
// switching tabs. The Phaser.Game instance is therefore created once in
// onMounted and kept alive across tab switches; show()/pause() resume/pause
// the scene rather than recreating the game each time the tab is reopened.
//
// Milestone 6 adds the first slice of the command system
// (GAME_ARCHITECTURE.md's "Command system" section): a text input below the
// canvas, parsed by ./command.ts's parseCommand against the active topic's
// vocabulary (word_id/text pairs built the same way renderItems' word labels
// are). Recognized/rejected results are shown as plain feedback text.
//
// Milestone 7 gives the NPC a deterministic, scripted conversation (see
// ./quest.ts) instead of the plain toggle Milestone 5 had: pressing E in
// range starts it, then each recognized SAY command from the bar below is
// forwarded to MainScene.applyAction, which advances the conversation one
// step if it matches what the NPC is currently waiting for. The script is
// matched by the game-content mapping's semantic `data.line` tag
// (greeting-formal → affirmation → courtesy-thanks), never a hardcoded
// word_id, so the same three-beat conversation works for any origin→target
// pair whose mapping tags those lines the same way.
//
// Milestone 8 adds one locked gate (see ./gate.ts) — a second, independent
// puzzle alongside the NPC's quest, open-able only by SAYing the correct
// target-language word while standing near it. Same semantic-tag matching
// convention as the quest: the required word is found by `data.concept` on
// the topic's own mapping, not a hardcoded word_id.
//
// Milestone 9 wires a WORD_USED learning event (GAME_ARCHITECTURE.md's event
// catalog) into the *existing* progress system instead of a parallel one:
// whenever a SAY command actually accomplishes something in the world (an
// expected quest step, or opening the gate) — not merely a recognized
// command — MainScene.applyAction reports that back to submitCommand, which
// calls the same shared/writeQueue.ts performWrite("increment", ...) every
// other feature already uses to bump a word's shown_count, offline-queueing
// included for free. A recognized-but-inconsequential SAY (right word,
// nothing currently needs it) does not fire an event — the signal is "this
// word did something," not "this word was typed."
//
// buildSceneItems/isWithinInteractRange/parseCommand/quest/gate live in their
// own modules, not here — <script setup> cannot contain named ES module
// exports (Vue compiler restriction), and pure logic is easier to unit-test
// standalone.

const SCENE_KEY = 'MainScene'
const ROLE_COLORS: Record<string, string> = {
  dialogue: '#ffd166',
  noun: '#8ecae6',
}
const DEFAULT_COLOR = '#e0e0e0'
const GRID_COLUMNS = 5
const CELL_WIDTH = 120
const CELL_HEIGHT = 60

// Positioned below the word-label grid (which occupies roughly y 20-280 for
// up to 25 words) so the play area and the discovered-word display don't
// overlap.
const PLAYER_START = { x: 120, y: 380 }
const NPC_POSITION = { x: 480, y: 380 }
// Off in its own corner, clear of both the word-label grid (y up to ~280)
// and the player/NPC row (y 380) — a separate puzzle, not part of the
// conversation.
const GATE_POSITION = { x: 580, y: 440 }
const GATE_SIZE = { width: 36, height: 56 }
const PLAYER_SPEED = 200
const INTERACT_RADIUS = 60
const GATE_INTERACT_RADIUS = 60
const PLAYER_COLOR = 0xffffff
const NPC_COLOR = 0x9b5de5
const NPC_TALKING_COLOR = 0x2ec4b6
const NPC_QUEST_COMPLETE_COLOR = 0xffd166
const GATE_LOCKED_COLOR = 0x6b4226
const GATE_OPEN_COLOR = 0x90ee90

// Module-level, not component state: MainScene is instantiated by Phaser
// itself (it's handed the class, not an instance) the moment the game boots,
// so this is how show() below reaches the running scene. Buffered in
// pendingItems/pendingQuestSteps/pendingGateState for the (normal) case
// where show()'s data arrives before Phaser has finished booting and called
// create().
let sceneInstance: MainScene | null = null
let pendingItems: SceneItem[] | null = null
let pendingQuestSteps: QuestStep[] | null = null
let pendingGateState: GateState | null = null

class MainScene extends Phaser.Scene {
  wordLabels: Phaser.GameObjects.Text[] = []
  player!: Phaser.GameObjects.Arc
  npc!: Phaser.GameObjects.Arc
  promptText!: Phaser.GameObjects.Text
  cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  keyE: Phaser.Input.Keyboard.Key | null = null
  questSteps: QuestStep[] = []
  questProgress: QuestProgress = { stageIndex: 0, completed: false }
  questStarted = false
  gate!: Phaser.GameObjects.Rectangle
  gateHintText!: Phaser.GameObjects.Text
  gateState: GateState = { wordId: null, open: false }

  constructor() {
    super(SCENE_KEY)
  }

  create() {
    sceneInstance = this

    this.npc = this.add.circle(NPC_POSITION.x, NPC_POSITION.y, 16, NPC_COLOR)

    this.player = this.add.circle(PLAYER_START.x, PLAYER_START.y, 12, PLAYER_COLOR)
    this.physics.add.existing(this.player)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true)

    this.promptText = this.add.text(0, 0, 'Press E to talk', {
      color: '#ffffff',
      fontSize: '14px',
    })
    this.promptText.setVisible(false)

    this.gate = this.add.rectangle(GATE_POSITION.x, GATE_POSITION.y, GATE_SIZE.width, GATE_SIZE.height, GATE_LOCKED_COLOR)
    this.gateHintText = this.add.text(0, 0, '', { color: '#ffffff', fontSize: '14px' })
    this.gateHintText.setVisible(false)

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.keyE = this.input.keyboard.addKey('E')
      // createCursorKeys()/addKey() default to capturing their key codes,
      // which calls event.preventDefault() on every matching keydown
      // *anywhere in the document*, not just while this canvas has focus —
      // Phaser's KeyboardManager listens on window with no target/focus
      // check (verified in node_modules/phaser/src/input/keyboard/
      // KeyboardManager.js). Left uncleared, that would silently break
      // typing "e" or using arrow keys in any other text input in the app
      // (including this milestone's own command box below), the same class
      // of cross-feature bug Flashcards.vue's keydown handler caused in the
      // other direction (Milestone 5). Key state (isDown/JustDown) tracking
      // is unaffected — only the preventDefault side effect is disabled.
      this.input.keyboard.clearCaptures()
    }

    if (pendingItems) {
      this.renderItems(pendingItems)
      pendingItems = null
    }
    if (pendingQuestSteps) {
      this.setQuestSteps(pendingQuestSteps)
      pendingQuestSteps = null
    }
    if (pendingGateState) {
      this.setGateState(pendingGateState)
      pendingGateState = null
    }
  }

  update() {
    if (!this.cursors) return

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0)
    if (this.cursors.left.isDown) body.setVelocityX(-PLAYER_SPEED)
    else if (this.cursors.right.isDown) body.setVelocityX(PLAYER_SPEED)
    if (this.cursors.up.isDown) body.setVelocityY(-PLAYER_SPEED)
    else if (this.cursors.down.isDown) body.setVelocityY(PLAYER_SPEED)

    const inRange = isWithinInteractRange(
      { x: this.player.x, y: this.player.y },
      { x: this.npc.x, y: this.npc.y },
      INTERACT_RADIUS,
    )
    this.promptText.setPosition(this.npc.x - 55, this.npc.y - 40)
    this.promptText.setVisible(inRange)
    if (inRange) {
      this.promptText.setText(this.questStarted ? questPrompt(this.questSteps, this.questProgress) : 'Press E to talk')
    }

    if (inRange && !this.questStarted && this.keyE && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.questStarted = true
      this.npc.setFillStyle(NPC_TALKING_COLOR)
    }

    const inGateRange = isWithinInteractRange(
      { x: this.player.x, y: this.player.y },
      { x: this.gate.x, y: this.gate.y },
      GATE_INTERACT_RADIUS,
    )
    this.gateHintText.setPosition(this.gate.x - 55, this.gate.y - 45)
    this.gateHintText.setVisible(inGateRange)
    if (inGateRange) {
      this.gateHintText.setText(this.gateState.open ? 'Open.' : 'Locked. Try a word.')
    }
  }

  // Only touches the word-label text objects, not the player/NPC/prompt —
  // show() can call this again on every tab switch or topic change, and
  // those gameplay objects must survive a topic's word list re-rendering.
  renderItems(items: SceneItem[]) {
    this.wordLabels.forEach((label) => label.destroy())
    this.wordLabels = items.map((item, index) => {
      const x = 20 + (index % GRID_COLUMNS) * CELL_WIDTH
      const y = 20 + Math.floor(index / GRID_COLUMNS) * CELL_HEIGHT
      return this.add.text(x, y, item.text, {
        color: ROLE_COLORS[item.role] ?? DEFAULT_COLOR,
        fontSize: '16px',
      })
    })
  }

  // Resets conversation state on every show() (topic switch mid-quest
  // shouldn't leave a stale "talking" NPC color or a completed quest showing
  // for the new topic's own, independently-scripted conversation).
  setQuestSteps(steps: QuestStep[]) {
    this.questSteps = steps
    this.questProgress = { stageIndex: 0, completed: false }
    this.questStarted = false
    this.npc.setFillStyle(NPC_COLOR)
  }

  // Resets on every show() — same reasoning as setQuestSteps: a topic swap
  // shouldn't leave a previous topic's open gate looking open for a topic
  // whose gate word hasn't been said yet.
  setGateState(state: GateState) {
    this.gateState = state
    this.gate.setFillStyle(state.open ? GATE_OPEN_COLOR : GATE_LOCKED_COLOR)
  }

  // Called for every recognized GameAction from the command bar below,
  // regardless of whether the NPC conversation is active or the player is
  // near the gate — advanceQuest/tryOpenGate are no-ops (return the same
  // reference) unless their own preconditions (quest started; in gate range
  // with the right word) are met, so both can safely be tried on every
  // action without an if/else between them. Returns whether the action
  // actually accomplished something (quest step matched, or the gate
  // opened) — submitCommand uses that to decide whether this was a real
  // WORD_USED event, not just a recognized-but-idle command.
  applyAction(action: GameAction): boolean {
    let consequential = false

    if (this.questStarted) {
      const next = advanceQuest(this.questSteps, this.questProgress, action)
      if (next !== this.questProgress) {
        this.questProgress = next
        consequential = true
        if (next.completed) {
          this.npc.setFillStyle(NPC_QUEST_COMPLETE_COLOR)
        }
      }
    }

    const inGateRange = isWithinInteractRange(
      { x: this.player.x, y: this.player.y },
      { x: this.gate.x, y: this.gate.y },
      GATE_INTERACT_RADIUS,
    )
    const nextGate = tryOpenGate(this.gateState, action, inGateRange)
    if (nextGate !== this.gateState) {
      this.gateState = nextGate
      consequential = true
      this.gate.setFillStyle(GATE_OPEN_COLOR)
    }

    return consequential
  }
}

function renderInScene(items: SceneItem[]) {
  if (sceneInstance) {
    sceneInstance.renderItems(items)
  } else {
    pendingItems = items
  }
}

function applyQuestSteps(steps: QuestStep[]) {
  if (sceneInstance) {
    sceneInstance.setQuestSteps(steps)
  } else {
    pendingQuestSteps = steps
  }
}

function applyGateState(state: GateState) {
  if (sceneInstance) {
    sceneInstance.setGateState(state)
  } else {
    pendingGateState = state
  }
}

const FEEDBACK_MESSAGES: Record<'empty' | 'unknown_intent' | 'unknown_target', string> = {
  empty: 'Type a command, e.g. SAY HOLA.',
  unknown_intent: 'Unknown intent — try SAY <word>.',
  unknown_target: "That word isn't recognized yet.",
}

const containerRef = ref<HTMLDivElement | null>(null)
const vocabulary = ref<CommandVocabularyEntry[]>([])
const commandInput = ref('')
const commandFeedback = ref('')
let game: Phaser.Game | null = null
// Set by show(), same as every other feature receives via load()/show() —
// no shared session module exists (see App.vue), so this is just the plain
// argument-passing convention every sibling feature component already uses.
let currentUserEmail = ''
let currentLang = ''

onMounted(() => {
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: containerRef.value ?? undefined,
    width: 640,
    height: 480,
    backgroundColor: '#111318',
    physics: { default: 'arcade' },
    // No sound in the game yet — without this, Phaser's SoundManager still
    // creates a WebAudio AudioContext on boot, which every browser then logs
    // a "prevented from starting automatically" warning for, since it's
    // created before any user gesture. Revisit when a milestone actually
    // adds audio.
    audio: { noAudio: true },
    scene: MainScene,
  })
})

onUnmounted(() => {
  game?.destroy(true)
  game = null
  sceneInstance = null
  pendingItems = null
  pendingQuestSteps = null
  pendingGateState = null
})

async function show(userEmail: string, lang: string, topic: { topic_id: string }) {
  currentUserEmail = userEmail
  currentLang = lang
  game?.resume()
  const area = await getGameArea(lang, topic.topic_id)
  if (!area) {
    // No game-content mapping authored for this topic yet — expected for
    // most topics today (see getGameArea's docstring). Clear any stale
    // content from a previously-shown topic rather than leaving it up.
    renderInScene([])
    vocabulary.value = []
    applyQuestSteps([])
    applyGateState({ wordId: null, open: false })
    return
  }
  const words = await getWords(lang)
  const items = buildSceneItems(area, words)
  renderInScene(items)
  // Feeds the command parser (./command.ts) below — the same word_id/text
  // pairs already resolved for the on-screen labels, so "known vocabulary"
  // always matches what the player can actually see in this topic.
  vocabulary.value = items.map((item): CommandVocabularyEntry => ({ word_id: item.word_id, text: item.text }))
  // Rebuilds the NPC's scripted conversation from this topic's own mapping
  // (see quest.ts) — a topic swap always restarts the quest fresh.
  applyQuestSteps(buildQuestSteps(area.objects))
  // Same for the locked gate (see ./gate.ts) — an independent puzzle, reset
  // fresh on every topic swap.
  applyGateState(buildGateState(area.objects))
}

function pause() {
  game?.pause()
}

function submitCommand() {
  const result = parseCommand(commandInput.value, vocabulary.value)
  commandFeedback.value = result.ok
    ? `Recognized: ${result.action.action_type} → ${result.action.target_word_id}`
    : FEEDBACK_MESSAGES[result.reason]
  if (result.ok) {
    const consequential = sceneInstance?.applyAction(result.action) ?? false
    if (consequential && result.action.target_word_id) {
      performWrite('increment', currentUserEmail, currentLang, result.action.target_word_id)
    }
  }
  commandInput.value = ''
}

defineExpose({ show, pause })
</script>

<style scoped>
/* App.vue's switchTopicTab toggles this panel's display to "flex" (see
   App.vue:414) with no flex-direction set, so the browser default (row)
   would otherwise lay the canvas, command bar, and feedback text out
   side-by-side instead of stacked. */
#topic-game-panel {
  flex-direction: column;
  align-items: center;
}

.game-stage {
  width: min(90vw, 640px);
  aspect-ratio: 4 / 3;
  margin: 0 auto;
}

.command-bar {
  display: flex;
  gap: 0.5rem;
  width: min(90vw, 640px);
  margin: 0.75rem auto 0;
}

.command-bar input {
  flex: 1;
}

.command-feedback {
  width: min(90vw, 640px);
  margin: 0.5rem auto 0;
  min-height: 1.2em;
  font-size: 0.9rem;
  color: #cfcfcf;
}
</style>
