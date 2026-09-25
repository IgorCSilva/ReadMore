<template>
  <div id="topic-sentences-panel" style="display:none">
    <div class="empty-state" id="sentences-empty-state">No sentences for this topic yet.</div>
    <div class="sentences-list" id="sentences-list"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getWords } from '../../shared/api'
import { formatWordByParticle, getParticle } from '../../shared/koreanParticles'
import { escapeHtml } from '../../shared/text'

// Same extraction pattern as features/texts/Texts.vue: the shell toggles
// #topic-sentences-panel's visibility via document.getElementById, and this
// component only exposes show(topic, lang), called from switchTopicTab().
//
// Unlike texts, each sentence is a single short line, so there's no
// accordion — every sentence in the topic renders as its own numbered row.
// Bolded (**word**) spans render as <strong>, same convention as Texts.vue,
// but without its gender-styling lookup (that's specific to the "Gender
// style in texts" config).
//
// Korean particles get colored per particle_type, same as Texts.vue,
// unconditionally (not gated by the gender checkbox) so each kind of
// particle (topic, subject, object, addition, ...) stays visually distinct
// instead of all bolded words sharing the flat .sentence-item-content
// strong { color: var(--accent) } fallback.

let currentTopic = null;
let show;

onMounted(() => {
  const sentencesListEl = document.getElementById("sentences-list");
  const emptyStateEl = document.getElementById("sentences-empty-state");

  let wordStyleMap = new Map();
  let wordStyleMapLang = null;

  async function ensureWordStyleMap(lang) {
    if (wordStyleMapLang === lang) return;
    try {
      const data = await getWords(lang);
      wordStyleMap = new Map(
        data.words.map((w) => [w.original.toLowerCase(), { particleTypeId: w.particle_type }])
      );
      wordStyleMapLang = lang;
    } catch {
      // Decorative only — a failed fetch just means bold spans render
      // without particle styling this time, not a broken sentence view.
      wordStyleMap = new Map();
    }
  }

  function renderBoldSpan(word) {
    const particleTypeId = wordStyleMap.get(word.toLowerCase())?.particleTypeId;
    const particle = particleTypeId ? getParticle(particleTypeId) : null;
    if (!particle?.color) return `<strong>${word}</strong>`;
    return `<strong style="color:${particle.color}">${formatWordByParticle(word, particleTypeId)}</strong>`;
  }

  function renderSentenceContent(content) {
    return escapeHtml(content).replace(/\*\*(.+?)\*\*/g, (_, word) => renderBoldSpan(word));
  }

  function buildItem(sentence) {
    const item = document.createElement("div");
    item.className = "sentence-item";

    const number = document.createElement("span");
    number.className = "sentence-item-number";
    number.textContent = String(sentence.sentence_number);

    const content = document.createElement("span");
    content.className = "sentence-item-content";
    content.innerHTML = renderSentenceContent(sentence.content);

    item.append(number, content);
    return item;
  }

  function renderList() {
    sentencesListEl.innerHTML = "";
    for (const sentence of currentTopic.sentences) {
      sentencesListEl.appendChild(buildItem(sentence));
    }
    const isEmpty = currentTopic.sentences.length === 0;
    emptyStateEl.style.display = isEmpty ? "block" : "none";
    sentencesListEl.style.display = isEmpty ? "none" : "flex";
  }

  show = (topic, lang) => {
    currentTopic = topic;

    const target = typeof lang === "string" ? lang.split("-")[1] : undefined;
    if (target === "ko") {
      ensureWordStyleMap(lang).then(renderList);
    } else {
      renderList();
    }
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
