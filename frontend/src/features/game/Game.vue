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
import { buildSceneItems, type SceneItem } from './sceneItems'
import { isWithinInteractRange } from './interaction'
import { parseCommand, type CommandVocabularyEntry } from './command'

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
// are). Recognized/rejected results are shown as plain feedback text — this
// milestone proves the parser works against real per-topic vocabulary; wiring
// a recognized action to actual NPC/dialogue consequences is Milestone 7.
//
// buildSceneItems/isWithinInteractRange/parseCommand live in their own
// modules, not here — <script setup> cannot contain named ES module exports
// (Vue compiler restriction), and pure logic is easier to unit-test
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
const PLAYER_SPEED = 200
const INTERACT_RADIUS = 60
const PLAYER_COLOR = 0xffffff
const NPC_COLOR = 0x9b5de5
const NPC_INTERACTED_COLOR = 0x2ec4b6

// Module-level, not component state: MainScene is instantiated by Phaser
// itself (it's handed the class, not an instance) the moment the game boots,
// so this is how show() below reaches the running scene. Buffered in
// pendingItems for the (normal) case where show()'s data arrives before
// Phaser has finished booting and called create().
let sceneInstance: MainScene | null = null
let pendingItems: SceneItem[] | null = null

class MainScene extends Phaser.Scene {
  wordLabels: Phaser.GameObjects.Text[] = []
  player!: Phaser.GameObjects.Arc
  npc!: Phaser.GameObjects.Arc
  promptText!: Phaser.GameObjects.Text
  cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  keyE: Phaser.Input.Keyboard.Key | null = null
  interacted = false

  constructor() {
    super(SCENE_KEY)
  }

  create() {
    sceneInstance = this

    this.npc = this.add.circle(NPC_POSITION.x, NPC_POSITION.y, 16, NPC_COLOR)

    this.player = this.add.circle(PLAYER_START.x, PLAYER_START.y, 12, PLAYER_COLOR)
    this.physics.add.existing(this.player)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true)

    this.promptText = this.add.text(0, 0, 'Press E to interact', {
      color: '#ffffff',
      fontSize: '14px',
    })
    this.promptText.setVisible(false)

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

    if (inRange && this.keyE && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      this.interacted = !this.interacted
      this.npc.setFillStyle(this.interacted ? NPC_INTERACTED_COLOR : NPC_COLOR)
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
}

function renderInScene(items: SceneItem[]) {
  if (sceneInstance) {
    sceneInstance.renderItems(items)
  } else {
    pendingItems = items
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
})

async function show(lang: string, topic: { topic_id: string }) {
  game?.resume()
  const area = await getGameArea(lang, topic.topic_id)
  if (!area) {
    // No game-content mapping authored for this topic yet — expected for
    // most topics today (see getGameArea's docstring). Clear any stale
    // content from a previously-shown topic rather than leaving it up.
    renderInScene([])
    vocabulary.value = []
    return
  }
  const words = await getWords(lang)
  const items = buildSceneItems(area, words)
  renderInScene(items)
  // Feeds the command parser (./command.ts) below — the same word_id/text
  // pairs already resolved for the on-screen labels, so "known vocabulary"
  // always matches what the player can actually see in this topic.
  vocabulary.value = items.map((item): CommandVocabularyEntry => ({ word_id: item.word_id, text: item.text }))
}

function pause() {
  game?.pause()
}

function submitCommand() {
  const result = parseCommand(commandInput.value, vocabulary.value)
  commandFeedback.value = result.ok
    ? `Recognized: ${result.action.action_type} → ${result.action.target_word_id}`
    : FEEDBACK_MESSAGES[result.reason]
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
