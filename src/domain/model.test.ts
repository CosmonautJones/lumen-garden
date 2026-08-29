import { describe, expect, it } from 'vitest'
import { selectNextSeed } from './model'
import type { Seed } from './model'

function seed(overrides: Partial<Seed>): Seed {
  return {
    id: 'seed-1',
    text: 'Tend the garden',
    energy: 3,
    tags: [],
    status: 'inbox',
    source: 'user',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('selectNextSeed', () => {
  it('prefers the highest-energy active seed that has waited longest', () => {
    const next = selectNextSeed([
      seed({ id: 'inbox-high', status: 'inbox', energy: 5, updatedAt: 100 }),
      seed({ id: 'active-recent', status: 'active', energy: 4, updatedAt: 300 }),
      seed({ id: 'active-stale', status: 'active', energy: 4, updatedAt: 100 }),
      seed({ id: 'active-low', status: 'active', energy: 2, updatedAt: 50 }),
    ])

    expect(next?.id).toBe('active-stale')
  })

  it('uses inbox seeds when no active work is available and excludes archived or focused work', () => {
    const next = selectNextSeed([
      seed({ id: 'archived', status: 'archived', energy: 5 }),
      seed({ id: 'focused', status: 'focused', energy: 5 }),
      seed({ id: 'inbox-low', status: 'inbox', energy: 2, updatedAt: 20 }),
      seed({ id: 'inbox-high', status: 'inbox', energy: 4, updatedAt: 40 }),
    ])

    expect(next?.id).toBe('inbox-high')
  })

  it('returns null when every seed is archived or already in focus', () => {
    expect(selectNextSeed([
      seed({ status: 'archived' }),
      seed({ id: 'focused', status: 'focused' }),
    ])).toBeNull()
  })
})
