import { describe, expect, it } from 'vitest'
import { createConstellationLayout } from './constellation'
import type { Seed } from './model'

function seed(id: string): Seed {
  return {
    id,
    text: `Seed ${id}`,
    energy: 3,
    tags: [],
    status: 'inbox',
    source: 'user',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

describe('createConstellationLayout', () => {
  it('centers a single seed in the constellation', () => {
    expect(createConstellationLayout([seed('one')])).toEqual([
      { seedId: 'one', x: 50, y: 50 },
    ])
  })

  it('keeps every node inside the safe canvas bounds', () => {
    const layout = createConstellationLayout(['one', 'two', 'three', 'four', 'five', 'six'].map(seed))

    expect(layout).toHaveLength(6)
    expect(layout.every((node) => node.x >= 12 && node.x <= 88 && node.y >= 12 && node.y <= 88)).toBe(true)
  })

  it('assigns stable positions regardless of source seed order', () => {
    const seeds = ['seed-c', 'seed-a', 'seed-b'].map(seed)

    expect(createConstellationLayout(seeds)).toEqual(createConstellationLayout([...seeds].reverse()))
  })
})
