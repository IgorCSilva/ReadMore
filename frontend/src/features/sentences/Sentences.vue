<template>
  <div id="topic-sentences-panel" style="display:none">
    <div class="empty-state" id="sentences-empty-state">No sentences for this topic yet.</div>
    <div class="sentences-list" id="sentences-list"></div>
    <TargetWordBalloon ref="balloonRef" />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { getWords } from '../../shared/api'
import { formatWordByParticle, getParticle } from '../../shared/koreanParticles'
import { escapeHtml } from '../../shared/text'
import TargetWordBalloon from '../../components/TargetWordBalloon.vue'

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
const balloonRef = ref(null);

onMounted(() => {
  const sentencesListEl = document.getElementById("sentences-list");
  const emptyStateEl = document.getElementById("sentences-empty-state");

  let wordStyleMap = new Map();
  let wordStyleMapLang = null;
  let targetLangCode = null;

  async function ensureWordStyleMap(lang) {
    if (wordStyleMapLang === lang) return;
    try {
      const data = await getWords(lang);
      wordStyleMap = new Map(
        data.words.map((w) => [
          w.original.toLowerCase(),
          { particleTypeId: w.particle_type, cue: w.cue, auxiliarSentence: w.auxiliar_sentence },
        ])
      );
      wordStyleMapLang = lang;
    } catch {
      // Decorative only — a failed fetch just means bold spans render
      // without particle styling (and the balloon without cue/auxiliar
      // sentence data) this time, not a broken sentence view.
      wordStyleMap = new Map();
    }
  }

  function handleListClick(event) {
    const button = event.target.closest(".sentence-target-word");
    if (!button) return;
    event.stopPropagation();
    const word = button.dataset.word || "";
    const info = wordStyleMap.get(word.toLowerCase()) || {};
    balloonRef.value?.showFor(button, {
      word,
      lang: targetLangCode || "en",
      cue: info.cue || "",
      auxiliarSentence: info.auxiliarSentence || "",
    });
  }

  sentencesListEl.addEventListener("click", handleListClick);

  onUnmounted(() => {
    sentencesListEl.removeEventListener("click", handleListClick);
  });

  function renderBoldSpan(word) {
    const particleTypeId = wordStyleMap.get(word.toLowerCase())?.particleTypeId;
    const particle = particleTypeId ? getParticle(particleTypeId) : null;
    const style = particle?.color ? ` style="color:${particle.color}"` : "";
    const displayText = escapeHtml(formatWordByParticle(word, particleTypeId));
    const attrWord = escapeHtml(word).replace(/"/g, "&quot;");
    return (
      `<button type="button" class="sentence-target-word" data-word="${attrWord}">` +
      `<strong${style}>${displayText}</strong></button>`
    );
  }

  function renderSentenceContent(content) {
    return content
      .split(/\*\*(.+?)\*\*/g)
      .map((part, i) => (i % 2 === 1 ? renderBoldSpan(part) : escapeHtml(part)))
      .join("");
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
    targetLangCode = target;
    balloonRef.value?.hide();
    // Always fetched (not just for Korean) so the balloon's cue/auxiliar
    // sentence data is available for every language pair — only Korean's
    // renderList() needs to wait on it, for particle coloring.
    const wordDataPromise = typeof lang === "string" ? ensureWordStyleMap(lang) : Promise.resolve();
    if (target === "ko") {
      wordDataPromise.then(renderList);
    } else {
      renderList();
    }
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
