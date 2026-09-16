<template>
  <button
    v-if="selection.topicNumber !== null"
    type="button"
    class="correct-fab"
    @click="open"
  >
    Correct sentence
  </button>

  <div v-if="isOpen" class="correction-overlay" @click.self="close">
    <div class="correction-modal">
      <div class="correction-header">
        <h3>Correct sentence</h3>
        <button type="button" class="correction-close" aria-label="Close" @click="close">×</button>
      </div>

      <div class="correction-body">
        <label class="correction-field">
          Current
          <textarea v-model="currentText" placeholder="avó" rows="2"></textarea>
        </label>
        <label class="correction-field">
          Correction
          <textarea v-model="correctionText" placeholder="abuela" rows="2"></textarea>
        </label>
        <p class="correction-hint">
          Matching is case-sensitive. Use commas for multiple variants, e.g. "meu, minha".
        </p>
      </div>

      <div class="correction-footer">
        <button type="button" class="correction-cancel" @click="close">Cancel</button>
        <button type="button" class="correction-submit" :disabled="submitting" @click="submit">
          {{ submitting ? "Submitting…" : "Submit" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { HttpError, NetworkError, submitCorrection } from '../../shared/api'
import { getCurrentSelection } from '../../shared/currentSelection'
import { notify } from '../../shared/notifications'

const selection = getCurrentSelection()
const isOpen = ref(false)
const currentText = ref('')
const correctionText = ref('')
const submitting = ref(false)

function open(): void {
  isOpen.value = true
}

function close(): void {
  isOpen.value = false
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) close()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

function splitValues(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

async function submit(): Promise<void> {
  const current = splitValues(currentText.value)
  const correction = splitValues(correctionText.value)
  if (current.length === 0 || correction.length === 0) {
    notify('error', 'Enter both a current and a correction value')
    return
  }
  if (selection.chapterNumber === null || selection.topicNumber === null) {
    notify('error', 'Select a topic before submitting a correction')
    return
  }

  submitting.value = true
  try {
    await submitCorrection({
      chapter_number: selection.chapterNumber,
      topic_number: selection.topicNumber,
      lang: selection.lang,
      current,
      correction,
    })
    notify('success', 'Correction submitted')
    currentText.value = ''
    correctionText.value = ''
    isOpen.value = false
  } catch (err) {
    const message = err instanceof HttpError || err instanceof NetworkError ? err.message : 'Failed to submit correction'
    notify('error', message)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.correct-fab {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 900;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}
.correct-fab:hover {
  filter: brightness(1.1);
}

.correction-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 1000;
}

.correction-modal {
  width: min(90vw, 420px);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
}

.correction-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.correction-header h3 {
  margin: 0;
  font-size: 15px;
}
.correction-close {
  background: none;
  border: none;
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.correction-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.correction-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted);
}
.correction-field textarea {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  font-weight: 400;
  text-transform: none;
  resize: vertical;
}
.correction-hint {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.correction-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
.correction-cancel {
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
}
.correction-submit {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
}
.correction-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
