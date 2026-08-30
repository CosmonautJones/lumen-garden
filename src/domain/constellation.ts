import type { Seed } from './model'

export interface ConstellationNode {
  seedId: string
  x: number
  y: number
}

const CANVAS_CENTER = 50
const CANVAS_RADIUS = 38

/**
 * Places seeds in a stable, bounded radial arrangement for the Explore view.
 * The layout intentionally favors scanability over simulated physics.
 */
export function createConstellationLayout(seeds: readonly Seed[]): ConstellationNode[] {
  const sortedSeeds = [...seeds].sort((left, right) => left.id.localeCompare(right.id))
  if (sortedSeeds.length === 1) {
    return [{ seedId: sortedSeeds[0].id, x: CANVAS_CENTER, y: CANVAS_CENTER }]
  }

  return sortedSeeds.map((seed, index) => {
    const angle = -Math.PI / 2 + (index / sortedSeeds.length) * Math.PI * 2
    return {
      seedId: seed.id,
      x: Number((CANVAS_CENTER + Math.cos(angle) * CANVAS_RADIUS).toFixed(2)),
      y: Number((CANVAS_CENTER + Math.sin(angle) * CANVAS_RADIUS).toFixed(2)),
    }
  })
}
