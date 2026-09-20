<template>
  <div id="topic-sentences-panel" style="display:none">
    <div class="sentences-list" id="sentences-list"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { escapeHtml } from '../../shared/text'

// Same extraction pattern as features/texts/Texts.vue: the shell toggles
// #topic-sentences-panel's visibility via document.getElementById, and this
// component only exposes show(topic), called from switchTopicTab().
//
// Unlike texts, each sentence is a single short line, so there's no
// accordion — every sentence in the topic renders as its own numbered row.
// Bolded (**word**) spans render as <strong>, same convention as Texts.vue,
// but without its gender-styling lookup (that's specific to the "Gender
// style in texts" config).

let currentTopic = null;
let show;

onMounted(() => {
  const sentencesListEl = document.getElementById("sentences-list");

  function renderSentenceContent(content) {
    return escapeHtml(content).replace(/\*\*(.+?)\*\*/g, (_, word) => `<strong>${word}</strong>`);
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
  }

  show = (topic) => {
    currentTopic = topic;
    renderList();
  };
});

defineExpose({
  show: (...args) => show(...args),
});
</script>
