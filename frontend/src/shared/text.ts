// Shared by App.vue's chapter/topic list cards (itemCard) and exercises'
// boldInline, plus features/texts/Texts.vue's renderTextBody — extracted
// here rather than duplicated across those, since it's a genuine shared
// dependency of this step (Texts.vue needs it too), not a speculative
// refactor.
export function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
