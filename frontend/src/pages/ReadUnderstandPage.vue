<template>
  <div class="flow-topbar">
    <button type="button" class="flow-exit-btn" @click="exit" aria-label="Exit">✕</button>
  </div>

  <div class="flow-page read-page">
    <div class="read-page-content">
      <div class="flow-loading" v-if="isLoading">
        <div class="flow-spinner"></div>
      </div>

      <Sentences ref="sentencesRef" />
    </div>
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
import { getLangPair } from '../shared/languagePreference'
import { getPosition, savePosition } from '../shared/positionMemory'
import { numberedPartsCount } from '../shared/topicParts'

// Saved via SettingsPage.vue (default 'pt-en'), read once per mount — same
// as ensureUserEmail's "resolve once, reuse for the session" idiom.
const LANG = getLangPair()

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const sentencesRef = ref(null)
const isLoading = ref(true)

// Static for this mount — the page fully remounts on every navigation here,
// so there's no need to track topicId changing underneath it.
const scrollKey = `read-understand:${route.params.topicId}`

function exit() {
  router.push('/home')
}

// "Read and Understand" has no numbered-part slot of its own — the next
// entry in Home's accordion is always "Listen and Identify", the fixed
// action part right after the `count` numbered ones (see topicParts/
// HomePage's partsForTopic).
function finish() {
  const topicId = route.params.topicId
  const nextPartIndex = numberedPartsCount(topic.value) + 1
  requestHomeExpansion({ topicId, partIndex: nextPartIndex })
  router.push('/home')
}

async function load() {
  isLoading.value = true
  try {
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
    if (panel) {
      panel.style.display = 'flex'
      panel.style.padding = '73px 0'
    }
    sentencesRef.value?.show(topic.value, LANG)

    // Restore only after the sentence list has actually rendered — otherwise
    // there's nothing tall enough yet for the saved offset to land on.
    await nextTick()
    window.scrollTo(0, getPosition(scrollKey))
  } finally {
    isLoading.value = false
  }
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
  min-height: 100vh;
}

/* Horizontal breathing room only — a plain "padding: 24px" here would
   override .flow-page's own padding-top/padding-bottom (56px, clearance for
   the fixed top/bottom bars) via the cascade, since both are single-class
   selectors of equal specificity and this rule comes later in the file.
   That silent override was why the first/last sentence sat partially under
   the bars even after the scroll-overflow fix. */
.read-page {
  padding: 0 24px;
}

/* Centers the content vertically only while it's shorter than the
   available space — auto margins collapse to 0 once it overflows, instead
   of justify-content:center's overflow-both-ways behavior, which trapped
   the top of a long sentence list above the reachable scroll range. */
.read-page-content {
  width: 100%;
  margin-top: auto;
  margin-bottom: auto;
}

.flow-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: flow-spin 0.8s linear infinite;
}

@keyframes flow-spin {
  to { transform: rotate(360deg); }
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
