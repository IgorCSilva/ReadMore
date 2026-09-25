<template>
  <div id="topic-texts-panel" style="display:none">
    <div class="texts-list" id="texts-list"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { getWords } from '../../shared/api'
import { formatWordByGender, getGender } from '../../shared/genders'
import { formatWordByParticle, getParticle } from '../../shared/koreanParticles'
import { escapeHtml } from '../../shared/text'

// Extracted from App.vue's monolithic script (Step 2.5 of RESTRUCTURE_PLAN.md
// Phase 2), same pattern as features/catalog/Flashcards.vue (Step 2.4): the
// shell keeps toggling #topic-texts-panel's visibility via
// document.getElementById, unaffected by this extraction; the only new
// coordination is the exposed show(topic) method, called from the same
// single call site the original script had inside switchTopicTab().
//
// Renders every text in the topic as a collapsed title/number row; clicking
// one expands it in place and collapses whichever other one was open (at
// most one open at a time), rather than the old single-text-with-prev/next-
// buttons reader.
//
// Bolded (**word**) spans normally just become <strong>; when the user has
// turned on "Gender style in texts" (App.vue's config checkbox), a bolded
// span whose text matches a word in the current language's catalog also
// gets the same color/masculine-feminine-symbol treatment Flashcards.vue
// always applies. Matching is by exact (case-insensitive) word text since
// texts don't carry word_ids inline — multi-word bold phrases like "Thank
// you" simply won't match anything and render as plain <strong>, same as
// before this feature existed.
//
// Korean particles get the same color treatment, but unconditionally (not
// gated by the gender checkbox, which is an unrelated concept Korean
// doesn't have) — a mixed pt-ko sentence should never drop a taught
// particle's color just because "Gender style in texts" happens to be off.

let currentTopic = null;
let expandedTextId = null;
let genderStyleEnabled = false;
let wordStyleMap = new Map();
let wordStyleMapLang = null;

let show;

onMounted(() => {
  const textsListEl = document.getElementById("texts-list");

  async function ensureWordStyleMap(lang) {
    if (wordStyleMapLang === lang) return;
    try {
      const data = await getWords(lang);
      wordStyleMap = new Map(
        data.words.map((w) => [w.original.toLowerCase(), { genderId: w.gender_id, particleTypeId: w.particle_type }])
      );
      wordStyleMapLang = lang;
    } catch {
      // Decorative only — a failed fetch just means bold spans render
      // without gender/particle styling this time, not a broken text view.
      wordStyleMap = new Map();
    }
  }

  function renderBoldSpan(word) {
    const entry = wordStyleMap.get(word.toLowerCase());
    const genderId = genderStyleEnabled ? entry?.genderId : null;
    const particleTypeId = entry?.particleTypeId;
    const gender = genderId ? getGender(genderId) : null;
    const particle = particleTypeId ? getParticle(particleTypeId) : null;
    const color = gender?.color || particle?.color;
    if (!color) return `<strong>${word}</strong>`;
    const styled = gender?.color ? formatWordByGender(word, genderId) : formatWordByParticle(word, particleTypeId);
    return `<strong style="color:${color}">${styled}</strong>`;
  }

  function renderTextBody(body) {
    return body
      .split("\n")
      .map((line) => `<p>${escapeHtml(line).replace(/\*\*(.+?)\*\*/g, (_, word) => renderBoldSpan(word))}</p>`)
      .join("");
  }

  function toggleText(textId) {
    expandedTextId = expandedTextId === textId ? null : textId;
    renderList();
  }

  function buildItem(text) {
    const isExpanded = text.text_id === expandedTextId;

    const item = document.createElement("div");
    item.className = "text-accordion-item" + (isExpanded ? " expanded" : "");
    item.dataset.textId = text.text_id;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "text-accordion-header";
    header.setAttribute("aria-expanded", String(isExpanded));
    header.addEventListener("click", () => toggleText(text.text_id));

    const number = document.createElement("span");
    number.className = "text-accordion-number";
    number.textContent = String(text.number);

    const title = document.createElement("span");
    title.className = "text-accordion-title";
    title.textContent = text.title;

    const chevron = document.createElement("span");
    chevron.className = "text-accordion-chevron";
    chevron.textContent = "▾";
    chevron.setAttribute("aria-hidden", "true");

    header.append(number, title, chevron);
    item.appendChild(header);

    if (isExpanded) {
      const body = document.createElement("div");
      body.className = "text-accordion-body";
      body.innerHTML = renderTextBody(text.body);
      item.appendChild(body);
    }

    return item;
  }

  function renderList() {
    textsListEl.innerHTML = "";
    for (const text of currentTopic.texts) {
      textsListEl.appendChild(buildItem(text));
    }
  }

  show = (topic, lang, genderStyleTextsEnabled = false) => {
    currentTopic = topic;
    expandedTextId = null;
    genderStyleEnabled = genderStyleTextsEnabled;

    const target = typeof lang === "string" ? lang.split("-")[1] : undefined;
    if (genderStyleEnabled || target === "ko") {
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
