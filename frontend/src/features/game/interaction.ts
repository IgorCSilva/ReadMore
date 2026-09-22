// Pure and Phaser-free on purpose, same reasoning as sceneItems.ts's
// buildSceneItems: proximity math doesn't need a canvas to be correct, so it
// stays testable without mounting the component or booting Phaser.

export interface Point {
  x: number
  y: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function isWithinInteractRange(player: Point, target: Point, radius: number): boolean {
  return distance(player, target) <= radius
}
