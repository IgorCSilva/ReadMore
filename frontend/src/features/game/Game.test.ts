import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../shared/api'
import { gameInstances } from '../../test-utils/phaserStub'
import Game from './Game.vue'
import { buildSceneItems } from './sceneItems'

// 'phaser' is globally mocked to test-utils/phaserStub in vitest.setup.ts
// (jsdom has no WebGL/canvas-2d context Phaser could use) — gameInstances
// records every FakeGame Game.vue's onMounted created. The stub never runs
// Phaser's own scene lifecycle, so show()'s rendering call lands harmlessly
// in the module-level pendingItems buffer rather than touching a real
// Phaser.Scene — what's tested here is the data wiring (API calls, role/word
// mapping), same split GAME_ARCHITECTURE.md's testing strategy calls for.

vi.mock('../../shared/api', () => ({
  getGameArea: vi.fn(),
  getWords: vi.fn(),
  // shared/writeQueue.ts imports all three progress functions eagerly (its
  // module-level ACTION_FNS table), so all three must exist on this mock
  // even though Game.vue's Milestone 9 wiring only ever calls increment —
  // unreachable under the phaserStub today (see the module docblock below)
  // since sceneInstance never exists, but mocked here so that stays true by
  // design rather than by accident.
  incrementShownCount: vi.fn().mockResolvedValue(new Response()),
  markWordKnown: vi.fn().mockResolvedValue(new Response()),
  showWordAgain: vi.fn().mockResolvedValue(new Response()),
}))

describe('buildSceneItems', () => {
  it('resolves each GameObject to its word text by root word_id', () => {
    const area = {
      lang: 'pt-es',
      topic_id: 'top-A0-EL-1',
      objects: [
        { word_id: 'wd-0001', role: 'dialogue', data: { line: 'greeting-formal' } },
        { word_id: 'wd-0009', role: 'noun', data: { concept: 'name' } },
      ],
    }
    const words = {
      lang: 'pt-es',
      words: [
        { word_id: 'wd-0001', original: 'hola', filename: 'hola.webp', sentence: '', cue: '', gender_id: 'not_apply' },
        { word_id: 'wd-0009', original: 'nombre', filename: 'nombre.webp', sentence: '', cue: '', gender_id: 'not_apply' },
      ],
    }

    expect(buildSceneItems(area, words)).toEqual([
      { word_id: 'wd-0001', role: 'dialogue', text: 'hola' },
      { word_id: 'wd-0009', role: 'noun', text: 'nombre' },
    ])
  })

  it('falls back to the word_id itself when no matching word is found', () => {
    const area = {
      lang: 'pt-es',
      topic_id: 'top-A0-EL-1',
      objects: [{ word_id: 'wd-9999', role: 'noun', data: {} }],
    }
    const words = { lang: 'pt-es', words: [] }

    expect(buildSceneItems(area, words)).toEqual([{ word_id: 'wd-9999', role: 'noun', text: 'wd-9999' }])
  })
})

describe('Game', () => {
  beforeEach(() => {
    gameInstances.length = 0
    vi.mocked(api.getGameArea).mockReset()
    vi.mocked(api.getWords).mockReset()
  })

  it('creates a Phaser.Game on mount and destroys it on unmount', () => {
    const wrapper = mount(Game, { attachTo: document.body })
    expect(gameInstances).toHaveLength(1)
    expect(gameInstances[0].destroyed).toBe(false)

    wrapper.unmount()
    expect(gameInstances[0].destroyed).toBe(true)
  })

  it('show() resumes and pause() pauses the underlying game', async () => {
    vi.mocked(api.getGameArea).mockResolvedValue(null)
    const wrapper = mount(Game, { attachTo: document.body })
    try {
      const instance = gameInstances[0]

      wrapper.vm.pause()
      expect(instance.paused).toBe(true)

      await wrapper.vm.show('learner@example.com', 'pt-es', { topic_id: 'top-A0-EL-1' })
      expect(instance.paused).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('show() fetches the game area and words for the given lang/topic', async () => {
    vi.mocked(api.getGameArea).mockResolvedValue({
      lang: 'pt-es',
      topic_id: 'top-A0-EL-1',
      objects: [{ word_id: 'wd-0001', role: 'dialogue', data: {} }],
    })
    vi.mocked(api.getWords).mockResolvedValue({
      lang: 'pt-es',
      words: [{ word_id: 'wd-0001', original: 'hola', filename: '', sentence: '', cue: '', gender_id: 'not_apply' }],
    })
    const wrapper = mount(Game, { attachTo: document.body })
    try {
      await wrapper.vm.show('learner@example.com', 'pt-es', { topic_id: 'top-A0-EL-1' })

      expect(api.getGameArea).toHaveBeenCalledWith('pt-es', 'top-A0-EL-1')
      expect(api.getWords).toHaveBeenCalledWith('pt-es')
    } finally {
      wrapper.unmount()
    }
  })

  it('show() skips fetching words when the topic has no game-content mapping yet', async () => {
    vi.mocked(api.getGameArea).mockResolvedValue(null)
    const wrapper = mount(Game, { attachTo: document.body })
    try {
      await wrapper.vm.show('learner@example.com', 'pt-es', { topic_id: 'top-A0-EL-9' })

      expect(api.getWords).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('command bar recognizes a SAY command against the active topic vocabulary', async () => {
    vi.mocked(api.getGameArea).mockResolvedValue({
      lang: 'pt-es',
      topic_id: 'top-A0-EL-1',
      objects: [{ word_id: 'wd-0001', role: 'dialogue', data: {} }],
    })
    vi.mocked(api.getWords).mockResolvedValue({
      lang: 'pt-es',
      words: [{ word_id: 'wd-0001', original: 'hola', filename: '', sentence: '', cue: '', gender_id: 'not_apply' }],
    })
    const wrapper = mount(Game, { attachTo: document.body })
    try {
      await wrapper.vm.show('learner@example.com', 'pt-es', { topic_id: 'top-A0-EL-1' })

      await wrapper.find('input[aria-label="Game command input"]').setValue('say hola')
      await wrapper.find('form.command-bar').trigger('submit')

      expect(wrapper.find('.command-feedback').text()).toBe('Recognized: SAY → wd-0001')
    } finally {
      wrapper.unmount()
    }
  })

  it('command bar reports an unrecognized target', async () => {
    vi.mocked(api.getGameArea).mockResolvedValue(null)
    const wrapper = mount(Game, { attachTo: document.body })
    try {
      await wrapper.vm.show('learner@example.com', 'pt-es', { topic_id: 'top-A0-EL-9' })

      await wrapper.find('input[aria-label="Game command input"]').setValue('say hola')
      await wrapper.find('form.command-bar').trigger('submit')

      expect(wrapper.find('.command-feedback').text()).toBe("That word isn't recognized yet.")
      // Milestone 9: an unrecognized command never reaches the point where a
      // learning event could fire — guards against that check moving outside
      // the `result.ok` branch in submitCommand.
      expect(api.incrementShownCount).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
})
