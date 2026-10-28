<template>
  <div class="conversation">
    <div class="conversation-header">
      <h1 class="conversation-title">Conversation Practice</h1>
      <label class="conversation-level-label">
        Level
        <select v-model="level" class="conversation-level-select">
          <option v-for="option in LEVELS" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <div class="conversation-messages" ref="listEl">
      <p class="conversation-empty" v-if="!messages.length">
        Say hello in {{ targetLangName }} to start practicing.
      </p>
      <div
        v-for="(turn, index) in messages"
        :key="index"
        class="conversation-bubble"
        :class="turn.role === 'user' ? 'conversation-bubble-user' : 'conversation-bubble-ai'"
      >{{ turn.content }}</div>
      <div class="conversation-bubble conversation-bubble-ai conversation-bubble-pending" v-if="isSending">…</div>
    </div>

    <div class="conversation-word-strip" v-if="leastUsedWords.length">
      <span
        v-for="w in leastUsedWords"
        :key="w.word_id"
        class="conversation-word-chip"
        :title="`used ${w.quantity} time${w.quantity === 1 ? '' : 's'}`"
      >{{ w.word }} · {{ w.quantity }}</span>
    </div>

    <form class="conversation-input-row" @submit.prevent="send">
      <input
        v-model="draft"
        class="conversation-input"
        type="text"
        placeholder="Type a message..."
        :disabled="isSending"
      />
      <button type="submit" class="conversation-send-btn" :disabled="isSending || !draft.trim()">Send</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { getConversationWords, sendChatMessage } from '../../shared/api'
import { ensureUserEmail } from '../../shared/currentUser'
import { getLangPair } from '../../shared/languagePreference'
import { formatLanguageName } from '../../shared/languages'
import { notify } from '../../shared/notifications'
import type { ChatTurn, ConversationWord } from '../../shared/types'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Saved via SettingsPage.vue, same resolve-once idiom as
// StoryReaderPage/PartFlowPage — the AI converses in this pair's target
// language, with corrections given in the origin language.
const LANG = getLangPair()
const targetLangName = formatLanguageName(LANG.split('-')[1] || LANG)
const USER_EMAIL = ensureUserEmail()

const level = ref('B1')
const messages = ref<ChatTurn[]>([])
const draft = ref('')
const isSending = ref(false)
const listEl = ref<HTMLDivElement | null>(null)
// The least-used words from this user's own "<email>-<target>-progress"
// sheet (seeded by hand — see backend/apps-script/Code.gs). Refreshed from
// each /chat reply so a word just used in a sent message drops out
// immediately. Missing/empty when the sheet hasn't been seeded for this
// pair yet — the strip simply doesn't render then.
const leastUsedWords = ref<ConversationWord[]>([])

onMounted(async () => {
  try {
    const data = await getConversationWords(USER_EMAIL, LANG)
    leastUsedWords.value = data.words
  } catch {
    // Non-critical: the strip just stays empty/hidden.
  }
})

// Changing level mid-conversation changes the system instruction the AI
// gets on the next request, so the prior turns aren't meaningful context
// anymore — starting fresh avoids sending a level-mismatched history.
watch(level, () => {
  messages.value = []
})

function scrollToBottom(): void {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || isSending.value) return

  const history = messages.value.slice()
  messages.value.push({ role: 'user', content: text })
  draft.value = ''
  isSending.value = true
  scrollToBottom()

  try {
    const data = await sendChatMessage({
      lang: LANG,
      level: level.value,
      message: text,
      history,
      user: USER_EMAIL,
    })
    messages.value.push({ role: 'ai', content: data.reply })
    if (data.conversation_words) leastUsedWords.value = data.conversation_words
  } catch (err) {
    notify('error', err instanceof Error ? err.message : 'Failed to reach the AI. Try again.')
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}
</script>

<style scoped>
.conversation {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
}

.conversation-title {
  margin: 0;
  font-size: 20px;
}

.conversation-level-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.conversation-level-select {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font: inherit;
  padding: 4px 8px;
}

.conversation-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 16px;
}

.conversation-empty {
  margin: 40px 0 0;
  text-align: center;
  color: var(--muted);
}

.conversation-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.conversation-bubble-user {
  align-self: flex-end;
  background: var(--accent);
  color: #fff;
}

.conversation-bubble-ai {
  align-self: flex-start;
  background: var(--card);
  border: 1px solid var(--border);
  color: var(--text);
}

.conversation-bubble-pending {
  color: var(--muted);
}

.conversation-word-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 16px 4px;
}

.conversation-word-chip {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font-size: 13px;
}

.conversation-input-row {
  display: flex;
  gap: 8px;
  padding: 10px 16px 16px;
  border-top: 1px solid var(--border);
}

.conversation-input {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--text);
  font: inherit;
  font-size: 15px;
  padding: 10px 16px;
}

.conversation-send-btn {
  padding: 0 22px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.conversation-send-btn:hover:not(:disabled) {
  background: var(--accent-strong);
}

.conversation-send-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
