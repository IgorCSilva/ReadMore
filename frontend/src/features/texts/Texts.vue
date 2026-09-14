<template>
  <div id="topic-texts-panel" style="display:none">
    <div class="text-reader" id="text-reader">
      <div>
        <div class="text-reader-number" id="text-reader-number"></div>
        <h2 class="text-reader-title" id="text-reader-title"></h2>
      </div>
      <div class="text-reader-body" id="text-reader-body"></div>
      <div class="action-bar">
        <button type="button" class="action-btn action-btn-icon" id="text-prev-btn" title="Previous text" aria-label="Previous text">←</button>
        <button type="button" class="action-btn action-btn-icon" id="text-next-btn" title="Next text" aria-label="Next text">→</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { escapeHtml } from '../../shared/text'

// Extracted from App.vue's monolithic script (Step 2.5 of RESTRUCTURE_PLAN.md
// Phase 2), same pattern as features/catalog/Flashcards.vue (Step 2.4): the
// shell keeps toggling #topic-texts-panel's visibility via
// document.getElementById, unaffected by this extraction; the only new
// coordination is the exposed show(topic) method, called from the same
// single call site the original script had inside switchTopicTab().

let currentTopic = null;
let currentTextIndex = 0;

let show;

onMounted(() => {
  const textReaderNumberEl = document.getElementById("text-reader-number");
  const textReaderTitleEl = document.getElementById("text-reader-title");
  const textReaderBodyEl = document.getElementById("text-reader-body");
  const textPrevBtn = document.getElementById("text-prev-btn");
  const textNextBtn = document.getElementById("text-next-btn");

  function renderTextBody(body) {
    return body
      .split("\n")
      .map((line) => `<p>${escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`)
      .join("");
  }

  function renderCurrentText() {
    const text = currentTopic.texts[currentTextIndex];
    textReaderNumberEl.textContent = `Text ${text.number}`;
    textReaderTitleEl.textContent = text.title;
    textReaderBodyEl.innerHTML = renderTextBody(text.body);

    textPrevBtn.disabled = currentTextIndex === 0;
    textNextBtn.disabled = currentTextIndex === currentTopic.texts.length - 1;
  }

  textPrevBtn.addEventListener("click", () => {
    if (currentTextIndex > 0) {
      currentTextIndex--;
      renderCurrentText();
    }
  });
  textNextBtn.addEventListener("click", () => {
    if (currentTextIndex < currentTopic.texts.length - 1) {
      currentTextIndex++;
      renderCurrentText();
    }
  });

  show = (topic) => {
    currentTopic = topic;
    currentTextIndex = 0;
    renderCurrentText();
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
