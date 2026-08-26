import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, STORAGE_KEY } from './model'
import { GardenRepository } from './repository'

class MemoryStorage {
  private readonly values = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    }
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

  it('rejects imported thread relationships that duplicate an existing connection', () => {
    const repository = createRepository()
    const payload = JSON.parse(repository.exportData()) as {
      threads: Array<{
        id: string
        fromSeedId: string
        toSeedId: string
        relation: string
        createdAt: number
      }>
    }
    const [existingThread] = payload.threads
    payload.threads.push({
      ...existingThread,
      id: 'thread-duplicate',
      fromSeedId: existingThread.toSeedId,
      toSeedId: existingThread.fromSeedId,
    })

    expect(() => repository.previewImport(JSON.stringify(payload))).toThrow(/duplicate thread relationships/i)
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

    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toEqual(
      expect.objectContaining({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        beds: [expect.objectContaining({ id: 'legacy-bed', name: 'Legacy area' })],
        seeds: [expect.objectContaining({ id: 'legacy-seed', text: 'A legacy thought' })],
      }),
    )
  })

  it('preserves a recovery copy before replacing malformed local storage', () => {
    const storage = new MemoryStorage()
    const malformedPayload = '{this is not valid JSON'
    storage.setItem(STORAGE_KEY, malformedPayload)
    const repository = createRepository(storage)

    repository.captureSeed({ text: 'Start fresh without discarding recoverable bytes' })

    expect(storage.getItem(`${STORAGE_KEY}:recovery`)).toBe(malformedPayload)
  })

  it('keeps the accepted garden and undo stack unchanged when a destructive write fails', () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)
    const beforeArchive = repository.getState()
    const seedId = beforeArchive.seeds[0].id
    storage.failWrites = true

    expect(() => repository.archiveSeed(seedId)).toThrow(/quota exceeded/i)
    expect(repository.getState()).toEqual(beforeArchive)
    expect(repository.getUndoState()).toBeNull()
  })

  it('keeps an undo checkpoint available when restoring it cannot be persisted', () => {
    const storage = new MemoryStorage()
    const repository = createRepository(storage)
    const seedId = repository.getState().seeds[0].id
    repository.archiveSeed(seedId)
    const archivedState = repository.getState()
    storage.failWrites = true

    expect(() => repository.undoLast()).toThrow(/quota exceeded/i)
    expect(repository.getState()).toEqual(archivedState)
    expect(repository.getUndoState()).toEqual(expect.objectContaining({ label: 'Archive seed' }))
  })

  it('round-trips exported gardens without changing accepted data', () => {
    const source = createRepository()
    const restored = createRepository(new MemoryStorage())

    restored.importData(source.exportData())

    expect(restored.getState()).toEqual(source.getState())
  })

  it('rejects current-schema imports with duplicate ids across entity collections', () => {
    const repository = createRepository()
    const payload = JSON.parse(repository.exportData()) as {
      beds: Array<{ id: string }>
      seeds: Array<{ id: string }>
    }
    payload.beds[0].id = payload.seeds[0].id

    expect(() => repository.previewImport(JSON.stringify(payload))).toThrow(/ids must be unique across collections/i)
  })

  it('rejects invalid current-schema seed statuses instead of silently normalizing them', () => {
    const repository = createRepository()
    const payload = JSON.parse(repository.exportData()) as {
      seeds: Array<{ status: string }>
    }
    payload.seeds[0].status = 'parked'

    expect(() => repository.previewImport(JSON.stringify(payload))).toThrow(/invalid seed status/i)
  })
})
