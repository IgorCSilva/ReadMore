// jsdom has no WebGL/canvas-2d context — Phaser runs real feature-detection
// at module-import time (unconditionally, before any Game is constructed),
// which throws under jsdom. vitest.setup.ts globally mocks 'phaser' to this
// stub for every test, the same way it already stubs window.prompt/
// matchMedia for jsdom gaps. Game.test.ts imports gameInstances directly
// from here (not from 'phaser') to inspect what Game.vue created.

export const gameInstances: FakeGame[] = []

export class FakeScene {
  key: string
  constructor(key: string) {
    this.key = key
  }
}

export class FakeGame {
  config: unknown
  destroyed = false
  paused = false
  constructor(config: unknown) {
    this.config = config
    gameInstances.push(this)
  }
  pause() {
    this.paused = true
  }
  resume() {
    this.paused = false
  }
  destroy(_removeCanvas?: boolean) {
    this.destroyed = true
  }
}
