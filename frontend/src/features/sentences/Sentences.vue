<template>
  <div id="topic-sentences-panel" style="display:none">
    <div class="empty-state" id="sentences-empty-state">No sentences for this topic yet.</div>
    <div class="sentences-list" id="sentences-list"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { getWords, ttsUrl } from '../../shared/api'
import { speechLocaleFor } from '../../shared/languages'
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
  let targetLangCode = null;

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

  // ---- Target-word popover, same two-tier TTS strategy as
  // PartFlowPage.vue's playAudio/speakLocal (backend /tts proxy, falling
  // back to the browser's speechSynthesis on error/rejected play). One
  // shared popover element is reused across every target word in the list
  // instead of one per word, so scroll/outside-click dismissal only has to
  // manage a single node.

  let popoverEl = null;
  let popoverAudioBtn = null;
  let popoverWord = "";

  function ensurePopover() {
    if (popoverEl) return;
    popoverEl = document.createElement("div");
    popoverEl.className = "target-word-balloon";
    popoverEl.style.display = "none";

    popoverAudioBtn = document.createElement("button");
    popoverAudioBtn.type = "button";
    popoverAudioBtn.className = "target-word-balloon-audio-btn";
    popoverAudioBtn.setAttribute("aria-label", "Play audio");
    popoverAudioBtn.textContent = "🔊";
    popoverAudioBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      playTargetWordAudio(popoverWord);
    });

    popoverEl.appendChild(popoverAudioBtn);
    document.body.appendChild(popoverEl);
  }

  function hidePopover() {
    if (popoverEl) popoverEl.style.display = "none";
  }

  function showPopoverFor(button) {
    ensurePopover();
    popoverWord = button.dataset.word || "";
    popoverEl.style.display = "flex";

    const rect = button.getBoundingClientRect();
    const popoverRect = popoverEl.getBoundingClientRect();
    const fitsAbove = rect.top >= popoverRect.height + 8;
    const top = fitsAbove ? rect.top - popoverRect.height - 8 : rect.bottom + 8;
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - popoverRect.width / 2, window.innerWidth - popoverRect.width - 8)
    );
    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
  }

  function speakLocal(text, langCode) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocaleFor(langCode);
    window.speechSynthesis.speak(utterance);
  }

  function playTargetWordAudio(text) {
    if (!text) return;
    const langCode = targetLangCode || "en";
    const audio = new Audio(ttsUrl(text, langCode));
    audio.addEventListener("error", () => speakLocal(text, langCode));
    audio.play().catch(() => speakLocal(text, langCode));
  }

  function handleListClick(event) {
    const button = event.target.closest(".sentence-target-word");
    if (!button) return;
    event.stopPropagation();
    showPopoverFor(button);
  }

  function handleOutsideClick(event) {
    if (!popoverEl || popoverEl.style.display === "none") return;
    if (popoverEl.contains(event.target)) return;
    hidePopover();
  }

  sentencesListEl.addEventListener("click", handleListClick);
  document.addEventListener("click", handleOutsideClick);
  window.addEventListener("scroll", hidePopover, true);

  onUnmounted(() => {
    sentencesListEl.removeEventListener("click", handleListClick);
    document.removeEventListener("click", handleOutsideClick);
    window.removeEventListener("scroll", hidePopover, true);
    popoverEl?.remove();
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
    hidePopover();
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
