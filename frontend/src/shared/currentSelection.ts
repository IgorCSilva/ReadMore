import { reactive } from 'vue'

export interface CurrentSelection {
  lang: string
  chapterNumber: number | null
  topicNumber: number | null
}

// A plain module-level reactive object — mirrors shared/notifications.ts's
// "no store, single shared module instance" pattern. App.vue's chapter/topic
// state is plain (non-reactive) closure variables inside one big onMounted,
// so this is the bridge that lets other components (the correction FAB)
// read "what topic is the user looking at right now" reactively.
const state = reactive<CurrentSelection>({ lang: 'pt-en', chapterNumber: null, topicNumber: null })

export function setCurrentSelection(selection: CurrentSelection): void {
  Object.assign(state, selection)
}

export function getCurrentSelection(): CurrentSelection {
  return state
}
