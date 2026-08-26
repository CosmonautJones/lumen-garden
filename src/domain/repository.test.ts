import { describe, expect, it } from 'vitest'
import { GardenRepository } from './repository'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function createRepository(storage = new MemoryStorage()): GardenRepository {
  let id = 0
  return new GardenRepository(storage, {
    now: () => 1_700_000_000_000,
    idFactory: (prefix) => `${prefix}-${++id}`,
  })
}

describe('GardenRepository', () => {
  it('persists a captured seed across repository reloads', () => {
    const storage = new MemoryStorage()
    const first = createRepository(storage)

    first.captureSeed({
      text: 'Map the first field note',
      note: 'Keep the capture fast.',
      energy: 4,
      tags: ['Garden', 'capture', 'garden'],
    })

    const reloaded = createRepository(storage)
    expect(reloaded.getState().seeds).toContainEqual(
      expect.objectContaining({
        text: 'Map the first field note',
        note: 'Keep the capture fast.',
        energy: 4,
        tags: ['garden', 'capture'],
        status: 'inbox',
        source: 'user',
      }),
    )
  })

  it('leaves existing data untouched when import preview is invalid', () => {
    const repository = createRepository()
    repository.captureSeed({ text: 'Keep this seed' })
    const beforePreview = repository.getState()

    expect(() => repository.previewImport('{not JSON}')).toThrow()
    expect(repository.getState()).toEqual(beforePreview)
  })
})
