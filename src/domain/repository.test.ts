import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from './model'
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
  it('provides a cached snapshot that changes after a mutation', () => {
    const repository = createRepository()
    const beforeCapture = repository.getSnapshot()

    expect(repository.getSnapshot()).toBe(beforeCapture)

    repository.captureSeed({ text: 'Capture with a stable UI snapshot' })

    expect(repository.getSnapshot()).not.toBe(beforeCapture)
  })

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

  it('rejects an import from a newer schema without changing the garden', () => {
    const repository = createRepository()
    repository.captureSeed({ text: 'Keep this local work' })
    const beforePreview = repository.getState()

    expect(() =>
      repository.previewImport(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION + 1,
          beds: [],
          seeds: [],
          threads: [],
          focusSessions: [],
          meta: {},
        }),
      ),
    ).toThrow(/newer schema/i)
    expect(repository.getState()).toEqual(beforePreview)
  })

  it('rejects an incomplete v1 import instead of silently dropping its missing collections', () => {
    const repository = createRepository()
    repository.captureSeed({ text: 'Preserve this seed' })
    const beforePreview = repository.getState()

    expect(() =>
      repository.previewImport(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          beds: [],
          seeds: [],
          threads: [],
        }),
      ),
    ).toThrow(/missing required collection/i)
    expect(repository.getState()).toEqual(beforePreview)
  })

  it('rejects imported threads that refer to seeds that do not exist', () => {
    const repository = createRepository()

    expect(() =>
      repository.previewImport(
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          beds: [],
          seeds: [],
          threads: [
            {
              id: 'thread-1',
              fromSeedId: 'missing-a',
              toSeedId: 'missing-b',
              relation: 'supports',
              createdAt: 1_700_000_000_000,
            },
          ],
          focusSessions: [],
          meta: { createdAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, demoData: false },
        }),
      ),
    ).toThrow(/thread refers to a missing seed/i)
  })

  it('rejects an import with an unsupported thread relation instead of normalizing it', () => {
    const repository = createRepository()
    const payload = JSON.parse(repository.exportData()) as {
      threads: Array<{ relation: string }>
    }
    payload.threads[0].relation = 'adjacent'

    expect(() => repository.previewImport(JSON.stringify(payload))).toThrow(/invalid thread relation/i)
  })

  it('restores an abandoned inbox seed to its original inbox status', () => {
    const repository = createRepository()
    const seed = repository.captureSeed({ text: 'Return me to the inbox' })

    repository.startFocusSession(seed.id, 15)
    const activeSession = repository.getActiveFocusSession()

    expect(activeSession).not.toBeNull()
    repository.abandonFocusSession(activeSession!.id)

    expect(repository.getSeed(seed.id)).toEqual(
      expect.objectContaining({ status: 'inbox' }),
    )
  })

  it('restores the prior focus seed before starting a different focus session', () => {
    const repository = createRepository()
    const firstSeed = repository.captureSeed({ text: 'First focus candidate' })
    const secondSeed = repository.captureSeed({ text: 'Second focus candidate' })

    repository.startFocusSession(firstSeed.id, 15)
    repository.startFocusSession(secondSeed.id, 25)

    expect(repository.getSeed(firstSeed.id)).toEqual(
      expect.objectContaining({ status: 'inbox' }),
    )
    expect(repository.getActiveFocusSession()).toEqual(
      expect.objectContaining({ seedId: secondSeed.id, status: 'running' }),
    )
  })

  it('migrates a legacy v0 payload into the current schema', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'lumen-garden:local-repository',
      JSON.stringify({
        schemaVersion: 0,
        areas: [{ id: 'legacy-bed', title: 'Legacy area', goal: 'Keep moving' }],
        items: [{ id: 'legacy-seed', title: 'A legacy thought', bedId: 'legacy-bed', status: 'active' }],
        relations: [],
        sessions: [],
      }),
    )

    const repository = createRepository(storage)

    expect(repository.getState()).toEqual(
      expect.objectContaining({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        beds: [expect.objectContaining({ id: 'legacy-bed', name: 'Legacy area' })],
        seeds: [expect.objectContaining({ id: 'legacy-seed', text: 'A legacy thought', bedId: 'legacy-bed' })],
      }),
    )
  })
})
