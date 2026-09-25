<template>
  <div class="flow-topbar">
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="flow-page read-page">
    <Sentences ref="sentencesRef" />
  </div>

  <div class="flow-bottombar">
    <button type="button" class="flow-next-btn" @click="finish">Finish</button>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sentences from '../features/sentences/Sentences.vue'
import { getChapters } from '../shared/api'
import { ensureUserEmail } from '../shared/currentUser'
import { requestHomeExpansion } from '../shared/homeExpansion'
import { getPosition, savePosition } from '../shared/positionMemory'
import { numberedPartsCount } from '../shared/topicParts'

// Hardcoded until a language picker exists on the new pages — matches the
// app's existing default language elsewhere (see HomePage.vue/PartFlowPage.vue).
const LANG = 'pt-en'

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const sentencesRef = ref(null)

// Static for this mount — the page fully remounts on every navigation here,
// so there's no need to track topicId changing underneath it.
const scrollKey = `read-understand:${route.params.topicId}`

function exit() {
  router.push('/')
}

// "Read and Understand" has no numbered-part slot of its own — the next
// entry in Home's accordion is always "Listen and identify", the fixed
// action part right after the `count` numbered ones (see topicParts/
// HomePage's partsForTopic).
function finish() {
  const topicId = route.params.topicId
  const nextPartIndex = numberedPartsCount(topic.value) + 1
  requestHomeExpansion({ topicId, partIndex: nextPartIndex })
  router.push('/')
}

async function load() {
  const email = ensureUserEmail()
  const topicId = route.params.topicId

  const data = await getChapters(email, LANG)
  let foundTopic = null
  for (const chapter of data.chapters || []) {
    foundTopic = chapter.topics.find((t) => t.topic_id === topicId)
    if (foundTopic) break
  }
  topic.value = foundTopic || null
  if (!foundTopic) return

  const panel = document.getElementById('topic-sentences-panel')
  if (panel) panel.style.display = 'flex'
  sentencesRef.value?.show(topic.value, LANG)

  // Restore only after the sentence list has actually rendered — otherwise
  // there's nothing tall enough yet for the saved offset to land on.
  await nextTick()
  window.scrollTo(0, getPosition(scrollKey))
}

// body's global padding (App.vue) exists for the normal centered-card pages
// — this is a full-bleed, fixed-top/bottom-bar page instead, same reasoning
// as PartFlowPage.vue.
onMounted(() => {
  document.body.classList.add('part-flow-active')
  load()
})

// Captured at the moment of leaving, not continuously — this page is fully
// torn down and rebuilt on the next visit, so there's no state to keep in
// sync in between.
onBeforeUnmount(() => {
  savePosition(scrollKey, window.scrollY)
})

onUnmounted(() => {
  document.body.classList.remove('part-flow-active')
})
</script>

<style scoped>
.flow-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 0 16px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}

.flow-exit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
}

.flow-exit-btn:hover {
  background: var(--border);
  color: var(--text);
}

.flow-page {
  width: 100%;
  max-width: 640px;
  padding-top: 56px;
  padding-bottom: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.read-page {
  padding: 24px;
}

.flow-bottombar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  background: var(--card);
  border-top: 1px solid var(--border);
  z-index: 100;
}

.flow-next-btn {
  width: 100%;
  max-width: 640px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.flow-next-btn:hover {
  background: var(--accent-strong);
}
</style>
