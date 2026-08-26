import {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  createDemoGarden,
  createFallbackGarden,
  normalizeBedHealth,
  normalizeEnergy,
  normalizeRelation,
  normalizeSeedSource,
  normalizeSeedStatus,
  normalizeTags,
} from './model'
import type {
  Bed,
  BedInput,
  FocusSession,
  FocusStatus,
  GardenMetadata,
  GardenState,
  ImportPreview,
  RelationType,
  Seed,
  SeedCaptureInput,
  SeedSource,
} from './model'

const MAX_UNDO_ENTRIES = 12

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type RepositoryListener = () => void

interface RepoOptions {
  storageKey?: string
  now?: () => number
  idFactory?: (prefix: string) => string
}

interface UndoEntry {
  id: string
  label: string
  snapshot: GardenState
  createdAt: number
}

export interface StorageIssue {
  kind: 'read' | 'write'
  detail: string
  recoveryAvailable: boolean
}

interface LegacyPayload {
  schemaVersion?: number
  version?: number
  createdAt?: number
  seeds?: unknown[]
  beds?: unknown[]
  threads?: unknown[]
  focusSessions?: unknown[]
  items?: unknown[]
  areas?: unknown[]
  relations?: unknown[]
  sessions?: unknown[]
  meta?: Partial<GardenMetadata>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  return null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asFreeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isSeedId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function cloneValue<T>(value: T): T {
  return structuredClone(value)
}

function getSchemaVersion(raw: LegacyPayload, fallback = 1): number {
  if (typeof raw.schemaVersion === 'number' && Number.isInteger(raw.schemaVersion)) {
    return raw.schemaVersion
  }

  if (typeof raw.version === 'number' && Number.isInteger(raw.version)) {
    return raw.version
  }

  return fallback
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && value > 0 && Number.isFinite(value)) {
    return value
  }

  return fallback
}

function nextId(
  raw: unknown,
  fallback: (prefix: string) => string,
  prefix: string,
): string {
  if (isSeedId(raw)) {
    return raw.trim()
  }
  return fallback(prefix)
}

function normalizeBedRaw(
  raw: unknown,
  now: () => number,
  idFactory: (prefix: string) => string,
  source: SeedSource,
): Bed {
  const data = asRecord(raw) ?? {}
  const createdAt = normalizeTimestamp(data.createdAt, now())
  const updatedAt = normalizeTimestamp(data.updatedAt, createdAt)
  return {
    id: nextId(data.id, idFactory, 'bed'),
    name: asText(data.name) || asText(data.title) || 'Untitled bed',
    intent: asText(data.intent) || asText(data.goal) || 'No intent yet',
    color: asText(data.color) || '#2f8f94',
    health: normalizeBedHealth(data.health),
    source: normalizeSeedSource(data.source ?? source),
    createdAt,
    updatedAt,
  }
}

function normalizeSeedRaw(
  raw: unknown,
  now: () => number,
  bedIds: Set<string>,
  idFactory: (prefix: string) => string,
): Seed {
  const data = asRecord(raw) ?? {}
  const createdAt = normalizeTimestamp(data.createdAt, now())
  const updatedAt = normalizeTimestamp(data.updatedAt, createdAt)
  const text = asText(data.text) || asText(data.title) || asText(data.body)
  if (text.length === 0) {
    throw new Error('Seed text must not be empty')
  }
  const status = normalizeSeedStatus(data.status)
  const bedId = isSeedId(data.bedId) && bedIds.has(data.bedId as string) ? String(data.bedId) : undefined
  const normalized: Seed = {
    id: nextId(data.id, idFactory, 'seed'),
    text,
    energy: normalizeEnergy(data.energy),
    tags: normalizeTags(data.tags ?? (typeof data.tagLine === 'string' ? data.tagLine.split(',') : data.labels)),
    status: status === 'active' && !bedId ? 'inbox' : status,
    source: normalizeSeedSource(data.source ?? normalizeSeedSource(data.origin)),
    createdAt,
    updatedAt,
  }

  const note = asText(data.note)
  if (note) {
    normalized.note = note
  }
  if (bedId) {
    normalized.bedId = bedId
  }

  return normalized
}

function normalizeThreadRaw(
  raw: unknown,
  now: () => number,
  idFactory: (prefix: string) => string,
): {
  fromSeedId: string
  toSeedId: string
  relation: RelationType
  id: string
  createdAt: number
} {
  const data = asRecord(raw) ?? {}
  const fromSeedId = asText(data.fromSeedId) || asText(data.from) || asText(data.source)
  const toSeedId = asText(data.toSeedId) || asText(data.to) || asText(data.target)
  return {
    id: nextId(data.id, idFactory, 'thread'),
    fromSeedId,
    toSeedId,
    relation: normalizeRelation(data.relation || data.kind),
    createdAt: normalizeTimestamp(data.createdAt, now()),
  }
}

function normalizeFocusSessionRaw(
  raw: unknown,
  now: () => number,
  idFactory: (prefix: string) => string,
): FocusSession {
  const data = asRecord(raw) ?? {}
  const status = data.status === 'running' || data.status === 'paused' || data.status === 'abandoned'
    ? (data.status as FocusStatus)
    : 'completed'
  const startRaw = data.startedAt
  const startedAt = normalizeTimestamp(startRaw, now())
  const endedAt = data.endedAt === undefined ? undefined : normalizeTimestamp(data.endedAt, startedAt)
  const pausedAt = data.pausedAt === undefined ? undefined : normalizeTimestamp(data.pausedAt, now())

  const normalized: FocusSession = {
    id: nextId(data.id, idFactory, 'focus'),
    seedId: asText(data.seedId) || asText(data.seed),
    durationMinutes: normalizeDurationMinutes(data.durationMinutes ?? data.duration),
    status,
    startedAt,
    accumulatedPauseMs:
      typeof data.accumulatedPauseMs === 'number' &&
      Number.isFinite(data.accumulatedPauseMs) &&
      data.accumulatedPauseMs > 0
        ? data.accumulatedPauseMs
        : 0,
    previousSeedStatus: normalizeSeedStatus(data.previousSeedStatus),
  }

  const outcome = asText(data.outcome)
  if (outcome) {
    normalized.outcome = outcome
  }
  if (pausedAt !== undefined) {
    normalized.pausedAt = pausedAt
  }
  if (endedAt !== undefined) {
    normalized.endedAt = endedAt
  }

  return normalized
}

function normalizeDurationMinutes(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const rounded = Math.round(raw)
    if (rounded >= 1 && rounded <= 240) {
      return rounded
    }
  }
  return 25
}

function requiredCollection(data: Record<string, unknown>, key: string): unknown[] {
  const value = data[key]
  if (!Array.isArray(value)) {
    throw new Error(`Import is missing required collection: ${key}`)
  }
  return value
}

function requiredRecord(raw: unknown, label: string): Record<string, unknown> {
  const value = asRecord(raw)
  if (!value) {
    throw new Error(`Imported ${label} must be an object`)
  }
  return value
}

function requiredId(data: Record<string, unknown>, label: string): string {
  if (!isSeedId(data.id)) {
    throw new Error(`Imported ${label} is missing an id`)
  }
  return data.id.trim()
}

function assertUniqueIds(items: unknown[], label: string): Set<string> {
  const ids = new Set<string>()
  for (const item of items) {
    const id = requiredId(requiredRecord(item, label), label)
    if (ids.has(id)) {
      throw new Error(`Imported ${label} ids must be unique`)
    }
    ids.add(id)
  }
  return ids
}

function assertUniqueIdsAcrossCollections(collections: Array<[string, Set<string>]>): void {
  const ids = new Set<string>()
  for (const [label, collectionIds] of collections) {
    for (const id of collectionIds) {
      if (ids.has(id)) {
        throw new Error(`Imported ${label} ids must be unique across collections`)
      }
      ids.add(id)
    }
  }
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateCurrentPayload(raw: LegacyPayload): void {
  const data = raw as Record<string, unknown>
  const beds = requiredCollection(data, 'beds')
  const seeds = requiredCollection(data, 'seeds')
  const threads = requiredCollection(data, 'threads')
  const focusSessions = requiredCollection(data, 'focusSessions')
  const meta = asRecord(data.meta)

  if (!meta) {
    throw new Error('Import is missing required metadata')
  }

  const bedIds = assertUniqueIds(beds, 'bed')
  const seedIds = assertUniqueIds(seeds, 'seed')
  const threadIds = assertUniqueIds(threads, 'thread')
  const focusSessionIds = assertUniqueIds(focusSessions, 'focus session')
  assertUniqueIdsAcrossCollections([
    ['bed', bedIds],
    ['seed', seedIds],
    ['thread', threadIds],
    ['focus session', focusSessionIds],
  ])

  if (!isFiniteTimestamp(meta.createdAt) || !isFiniteTimestamp(meta.updatedAt) || typeof meta.demoData !== 'boolean') {
    throw new Error('Imported metadata is invalid')
  }

  for (const rawBed of beds) {
    const bed = requiredRecord(rawBed, 'bed')
    if (asText(bed.name).length === 0 || asText(bed.intent).length === 0) {
      throw new Error('Imported bed must include a name and intent')
    }
    if (!isOneOf(bed.health, ['seedling', 'growing', 'blooming'])) {
      throw new Error('Imported bed has an invalid health')
    }
    if (!isOneOf(bed.source, ['demo', 'user'])) {
      throw new Error('Imported bed has an invalid source')
    }
    if (!isFiniteTimestamp(bed.createdAt) || !isFiniteTimestamp(bed.updatedAt)) {
      throw new Error('Imported bed has invalid timestamps')
    }
  }

  for (const rawSeed of seeds) {
    const seed = requiredRecord(rawSeed, 'seed')
    if (asText(seed.text).length === 0) {
      throw new Error('Imported seed text must not be empty')
    }
    if (!isOneOf(seed.status, ['inbox', 'active', 'focused', 'archived'])) {
      throw new Error('Imported seed has an invalid seed status')
    }
    if (!isOneOf(seed.source, ['demo', 'user'])) {
      throw new Error('Imported seed has an invalid source')
    }
    if (
      typeof seed.energy !== 'number' ||
      !Number.isInteger(seed.energy) ||
      seed.energy < 1 ||
      seed.energy > 5
    ) {
      throw new Error('Imported seed has an invalid energy')
    }
    if (!Array.isArray(seed.tags) || seed.tags.some((tag) => typeof tag !== 'string')) {
      throw new Error('Imported seed has invalid tags')
    }
    if (!isFiniteTimestamp(seed.createdAt) || !isFiniteTimestamp(seed.updatedAt)) {
      throw new Error('Imported seed has invalid timestamps')
    }
    if (seed.bedId !== undefined && (!isSeedId(seed.bedId) || !bedIds.has(seed.bedId))) {
      throw new Error('Imported seed refers to a missing bed')
    }
  }

  const threadRelationships = new Set<string>()
  for (const rawThread of threads) {
    const thread = requiredRecord(rawThread, 'thread')
    const fromSeedId = asText(thread.fromSeedId)
    const toSeedId = asText(thread.toSeedId)
    if (!seedIds.has(fromSeedId) || !seedIds.has(toSeedId)) {
      throw new Error('Imported thread refers to a missing seed')
    }
    if (fromSeedId === toSeedId) {
      throw new Error('Imported thread cannot connect a seed to itself')
    }
    if (thread.relation !== 'supports' && thread.relation !== 'extends' && thread.relation !== 'blocks') {
      throw new Error('Imported thread has an invalid thread relation')
    }
    if (!isFiniteTimestamp(thread.createdAt)) {
      throw new Error('Imported thread has invalid timestamps')
    }
    const relationshipKey = [fromSeedId, toSeedId].sort().join(':')
    if (threadRelationships.has(relationshipKey)) {
      throw new Error('Imported garden has duplicate thread relationships')
    }
    threadRelationships.add(relationshipKey)
  }

  const activeSessionIds = new Set<string>()
  for (const rawSession of focusSessions) {
    const session = requiredRecord(rawSession, 'focus session')
    const seedId = asText(session.seedId)
    if (!seedIds.has(seedId)) {
      throw new Error('Imported focus session refers to a missing seed')
    }
    if (!isOneOf(session.status, ['running', 'paused', 'completed', 'abandoned'])) {
      throw new Error('Imported focus session has an invalid status')
    }
    if (!isOneOf(session.previousSeedStatus, ['inbox', 'active', 'focused', 'archived'])) {
      throw new Error('Imported focus session has an invalid previous seed status')
    }
    if (
      typeof session.durationMinutes !== 'number' ||
      !Number.isInteger(session.durationMinutes) ||
      session.durationMinutes < 1 ||
      session.durationMinutes > 240 ||
      !isFiniteTimestamp(session.startedAt)
    ) {
      throw new Error('Imported focus session is invalid')
    }
    if (session.status === 'running' || session.status === 'paused') {
      if (activeSessionIds.size > 0) {
        throw new Error('Imported garden has more than one active focus session')
      }
      activeSessionIds.add(seedId)
    }
  }
}

function validateLegacyPayload(raw: LegacyPayload): boolean {
  return (
    Array.isArray(raw.items) ||
    Array.isArray(raw.areas) ||
    Array.isArray(raw.relations) ||
    Array.isArray(raw.sessions)
  )
}

function normalizeLegacyPayload(
  raw: LegacyPayload,
  now: () => number,
  idFactory: (prefix: string) => string,
): GardenState {
  const source: SeedSource = 'user'
  const bedMap: Bed[] = asArray(raw.areas).map((area) =>
    normalizeBedRaw(area, now, idFactory, source),
  )
  const bedIds = new Set<string>(bedMap.map((bed) => bed.id))
  const seeds = asArray(raw.items).map((seed) =>
    normalizeSeedRaw(seed, now, bedIds, idFactory),
  )
  const threadMap = asArray(raw.relations).map((thread) => normalizeThreadRaw(thread, now, idFactory))
  const validSeedIds = new Set(seeds.map((seed) => seed.id))
  const threads = threadMap.filter(
    (thread) => validSeedIds.has(thread.fromSeedId) && validSeedIds.has(thread.toSeedId),
  )
  const focusSessions = asArray(raw.sessions)
    .map((session) => normalizeFocusSessionRaw(session, now, idFactory))
    .filter((session) => validSeedIds.has(session.seedId))

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seeds,
    beds: bedMap,
    threads,
    focusSessions,
    meta: {
      createdAt: raw.createdAt ?? now(),
      updatedAt: now(),
      demoData: false,
    },
  }
}

function normalizeCurrentPayload(
  raw: LegacyPayload,
  now: () => number,
  idFactory: (prefix: string) => string,
): GardenState {
  const beds = asArray(raw.beds).map((bed) => normalizeBedRaw(bed, now, idFactory, 'user'))
  const bedIds = new Set<string>(beds.map((bed) => bed.id))
  const seeds = asArray(raw.seeds)
    .map((seed) => normalizeSeedRaw(seed, now, bedIds, idFactory))
    .filter((seed) => seed.text.length > 0)
  const validSeedIds = new Set(seeds.map((seed) => seed.id))
  const threads = asArray(raw.threads)
    .map((thread) => normalizeThreadRaw(thread, now, idFactory))
    .filter((thread) => validSeedIds.has(thread.fromSeedId) && validSeedIds.has(thread.toSeedId))
  const focusSessions = asArray(raw.focusSessions)
    .map((session) => normalizeFocusSessionRaw(session, now, idFactory))
    .filter((session) => validSeedIds.has(session.seedId))

  const metaSource = asRecord(raw.meta) ?? {}
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    beds,
    seeds,
    threads,
    focusSessions,
    meta: {

      createdAt: normalizeTimestamp(metaSource.createdAt, now()),
      updatedAt: normalizeTimestamp(metaSource.updatedAt, now()),
      demoData: Boolean(metaSource.demoData),
    },
  }
}

function parsePayload(
  raw: unknown,
  now: () => number,
  idFactory: (prefix: string) => string,
): GardenState {
  const data = asRecord(raw)
  if (!data) {
    throw new Error('Invalid storage payload')
  }

  const schemaVersion = getSchemaVersion(data, CURRENT_SCHEMA_VERSION)
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Cannot import newer schema version ${schemaVersion}`)
  }

  if (schemaVersion === CURRENT_SCHEMA_VERSION && Array.isArray((data as LegacyPayload).beds)) {
    validateCurrentPayload(data as LegacyPayload)
    return normalizeCurrentPayload(data as LegacyPayload, now, idFactory)
  }

  if (schemaVersion === 0 || validateLegacyPayload(data as LegacyPayload)) {
    return normalizeLegacyPayload(data as LegacyPayload, now, idFactory)
  }

  throw new Error(`Unsupported schema version ${schemaVersion}`)
}

export class GardenRepository {
  private readonly storage: StorageLike
  private readonly storageKey: string
  private readonly now: () => number
  private readonly idFactory: (prefix: string) => string
  private state: GardenState
  private listeners = new Set<RepositoryListener>()
  private undoStack: UndoEntry[] = []
  private malformedPayload: string | null = null
  private storageIssue: StorageIssue | null = null

  constructor(storage: StorageLike, options: RepoOptions = {}) {
    this.storage = storage
    this.storageKey = options.storageKey ?? STORAGE_KEY
    this.now = options.now ?? (() => Date.now())
    this.idFactory =
      options.idFactory ??
      ((prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`)

    this.state = this.load()
  }

  subscribe(listener: RepositoryListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): GardenState {
    return cloneValue(this.state)
  }

  getSnapshot(): GardenState {
    return this.state
  }

  getUndoState(): { id: string; label: string; createdAt: number } | null {
    const undo = this.undoStack[0]
    if (!undo) {
      return null
    }
    return {
      id: undo.id,
      label: undo.label,
      createdAt: undo.createdAt,
    }
  }

  getStorageIssue(): StorageIssue | null {
    return this.storageIssue ? { ...this.storageIssue } : null
  }

  getRecoveryData(): string | null {
    return this.malformedPayload ?? this.storage.getItem(`${this.storageKey}:recovery`)
  }

  getAllBeds(): Bed[] {
    return cloneValue(this.state.beds)
  }

  getSeed(seedId: string): Seed | null {
    const found = this.state.seeds.find((seed) => seed.id === seedId)
    return found ?? null
  }

  getFocusSession(sessionId: string): FocusSession | null {
    const found = this.state.focusSessions.find((session) => session.id === sessionId)
    return found ?? null
  }

  getActiveFocusSession(): FocusSession | null {
    return this.state.focusSessions.find(
      (session) => session.status === 'running' || session.status === 'paused',
    ) ?? null
  }

  previewImport(raw: string): ImportPreview {
    const next = parsePayload(JSON.parse(raw), this.now, this.idFactory)
    return {
      schemaVersion: next.schemaVersion,
      seeds: next.seeds.length,
      beds: next.beds.length,
      threads: next.threads.length,
      focusSessions: next.focusSessions.length,

    }
  }

  importData(raw: string): void {
    const next = parsePayload(JSON.parse(raw), this.now, this.idFactory)
    this.commit(
      (state) => {
        state.seeds = next.seeds
        state.beds = next.beds
        state.threads = next.threads
        state.focusSessions = next.focusSessions
        state.schemaVersion = next.schemaVersion
        state.meta = cloneValue(next.meta)
      },
      { label: 'Import replace', recordUndo: true, touch: false },
    )
  }

  exportData(): string {
    return JSON.stringify(this.state, null, 2)
  }

  undoLast(): boolean {
    const latest = this.undoStack[0]
    if (!latest) {
      return false
    }

    const restored = cloneValue(latest.snapshot)
    this.persist(restored)
    this.state = restored
    this.undoStack.shift()
    this.emit()
    return true
  }

  captureSeed(input: SeedCaptureInput): Seed {
    const text = asText(input.text)
    if (text.length === 0) {
      throw new Error('Seed text is required')
    }
    const now = this.now()
    const seed: Seed = {
      id: this.idFactory('seed'),
      text,
      note: asText(input.note),
      energy: normalizeEnergy(input.energy),
      tags: normalizeTags(input.tags ?? []),
      status: 'inbox',
      source: 'user',
      createdAt: now,
      updatedAt: now,
    }
    this.commit((state) => {
      state.seeds.unshift(seed)
      state.meta.demoData = false
    })
    return seed
  }

  moveSeedToBed(seedId: string, bedId: string): void {
    const bed = this.state.beds.find((current) => current.id === bedId)
    if (!bed) {
      throw new Error(`Bed not found: ${bedId}`)
    }

    this.commit((state) => {
      const seed = state.seeds.find((current) => current.id === seedId)
      if (!seed) {
        throw new Error(`Seed not found: ${seedId}`)
      }
      if (seed.status === 'archived') {
        throw new Error('Archived seed cannot be assigned to a bed')
      }
      seed.bedId = bed.id
      seed.status = 'active'
      seed.updatedAt = this.now()
    })
  }

  archiveSeed(seedId: string): void {
    this.commit(
      (state) => {
        const seed = state.seeds.find((current) => current.id === seedId)
        if (!seed) {
          throw new Error(`Seed not found: ${seedId}`)
        }
        if (seed.status === 'archived') {
          return
        }
        seed.status = 'archived'
        seed.bedId = undefined
        seed.updatedAt = this.now()
      },
      { label: 'Archive seed', recordUndo: true },
    )
  }


  restoreSeed(seedId: string): void {
    this.commit((state) => {
      const seed = state.seeds.find((current) => current.id === seedId)
      if (!seed) {
        throw new Error(`Seed not found: ${seedId}`)
      }
      if (seed.status !== 'archived') {
        return
      }
      seed.status = 'inbox'
      seed.updatedAt = this.now()
    })
  }

  removeThread(threadId: string): void {
    this.commit(
      (state) => {
        const lengthBefore = state.threads.length
        state.threads = state.threads.filter((thread) => thread.id !== threadId)
        if (state.threads.length === lengthBefore) {
          throw new Error(`Thread not found: ${threadId}`)
        }
      },
      { label: 'Remove thread', recordUndo: true },
    )
  }

  addThread(seedFromId: string, seedToId: string, relation: RelationType): void {
    if (seedFromId === seedToId) {
      throw new Error('Cannot connect a seed to itself')
    }
    const now = this.now()
    this.commit((state) => {
      const fromSeed = state.seeds.find((seed) => seed.id === seedFromId)
      const toSeed = state.seeds.find((seed) => seed.id === seedToId)
      if (!fromSeed || !toSeed) {
        throw new Error('Both seeds must exist before connecting')
      }

      const exists = state.threads.some(
        (thread) =>
          (thread.fromSeedId === fromSeed.id && thread.toSeedId === toSeed.id) ||
          (thread.fromSeedId === toSeed.id && thread.toSeedId === fromSeed.id),
      )
      if (exists) {
        throw new Error('This relationship already exists')
      }

      state.threads.push({
        id: this.idFactory('thread'),
        fromSeedId: fromSeed.id,
        toSeedId: toSeed.id,
        relation,
        createdAt: now,
      })
    })
  }

  createBed(input: BedInput): Bed {
    const name = asText(input.name)
    if (name.length === 0) {
      throw new Error('Bed name is required')
    }

    const now = this.now()
    const bed: Bed = {
      id: this.idFactory('bed'),
      name,
      intent: asText(input.intent) || 'No intent yet',
      color: asText(input.color),
      health: normalizeBedHealth(input.health),
      source: 'user',
      createdAt: now,
      updatedAt: now,
    }
    this.commit((state) => {
      state.beds.unshift(bed)
      state.meta.demoData = false
    })
    return bed
  }

  startFocusSession(seedId: string, durationMinutes = 25): void {
    const seed = this.state.seeds.find((item) => item.id === seedId)
    if (!seed) {
      throw new Error(`Seed not found: ${seedId}`)
    }
    if (seed.status === 'archived') {
      throw new Error('Archived seed cannot be focused')
    }
    const duration = normalizeDurationMinutes(durationMinutes)
    const previousSeedStatus = seed.status

    this.commit((state) => {
      const existing = state.focusSessions.find(
        (session) => session.status === 'running' || session.status === 'paused',
      )
      if (existing && existing.seedId !== seedId) {
        existing.status = 'abandoned'
        existing.endedAt = this.now()
        const seedInFocus = state.seeds.find((item) => item.id === existing.seedId)
        if (seedInFocus) {
          seedInFocus.status = seedInFocus.status === 'archived' ? 'archived' : existing.previousSeedStatus
          seedInFocus.updatedAt = this.now()

        }
      }

      const activeSeed = state.seeds.find((item) => item.id === seedId)
      if (!activeSeed) {
        throw new Error(`Seed not found: ${seedId}`)
      }

      activeSeed.status = 'focused'
      const session: FocusSession = {
        id: this.idFactory('focus'),
        seedId,
        durationMinutes: duration,
        status: 'running',
        startedAt: this.now(),
        accumulatedPauseMs: 0,
        previousSeedStatus,
      }
      state.focusSessions.unshift(session)

    })
  }

  pauseFocusSession(sessionId: string): void {
    this.commit((state) => {
      const session = state.focusSessions.find((item) => item.id === sessionId)
      if (!session) {
        throw new Error(`Focus session not found: ${sessionId}`)
      }
      if (session.status !== 'running') {
        throw new Error('Only a running session can be paused')
      }
      session.status = 'paused'
      session.pausedAt = this.now()
    })
  }

  resumeFocusSession(sessionId: string): void {
    this.commit((state) => {
      const session = state.focusSessions.find((item) => item.id === sessionId)
      if (!session) {
        throw new Error(`Focus session not found: ${sessionId}`)
      }
      if (session.status !== 'paused') {
        throw new Error('Only a paused session can be resumed')
      }
      if (typeof session.pausedAt === 'number') {
        session.accumulatedPauseMs += this.now() - session.pausedAt
      }
      session.pausedAt = undefined
      session.status = 'running'
    })
  }

  setFocusOutcome(sessionId: string, outcome: string): void {
    this.commit((state) => {
      const session = state.focusSessions.find((item) => item.id === sessionId)
      if (!session) {
        throw new Error(`Focus session not found: ${sessionId}`)
      }
      session.outcome = asFreeText(outcome)
    })
  }

  completeFocusSession(sessionId: string, outcome?: string): void {
    const now = this.now()
    this.commit((state) => {
      const session = state.focusSessions.find((item) => item.id === sessionId)
      if (!session) {
        throw new Error(`Focus session not found: ${sessionId}`)
      }
      if (session.status === 'completed' || session.status === 'abandoned') {
        return
      }
      if (session.status === 'paused' && typeof session.pausedAt === 'number') {
        session.accumulatedPauseMs += now - session.pausedAt
        session.pausedAt = undefined
      }
      const seed = state.seeds.find((item) => item.id === session.seedId)
      if (seed && seed.status !== 'archived') {
        seed.status = 'active'
        seed.updatedAt = now
      }
      if (outcome !== undefined) {
        session.outcome = asText(outcome)
      }
      session.status = 'completed'
      session.endedAt = now
    })
  }

  abandonFocusSession(sessionId: string): void {
    const now = this.now()
    this.commit((state) => {
      const session = state.focusSessions.find((item) => item.id === sessionId)
      if (!session) {
        throw new Error(`Focus session not found: ${sessionId}`)
      }
      if (session.status === 'completed' || session.status === 'abandoned') {
        return

      }
      if (session.status === 'paused' && typeof session.pausedAt === 'number') {
        session.accumulatedPauseMs += now - session.pausedAt
        session.pausedAt = undefined
      }
      const seed = state.seeds.find((item) => item.id === session.seedId)
      if (seed && seed.status !== 'archived') {
        seed.status = session.previousSeedStatus === 'focused' ? 'inbox' : session.previousSeedStatus
        seed.updatedAt = now
      }
      session.status = 'abandoned'
      session.endedAt = now
    })
  }

  clearDemoData(): void {
    this.commit(
      (state) => {
        const hadDemoSeeds = state.seeds.some((seed) => seed.source === 'demo')
        if (!hadDemoSeeds) {
          return
        }
        const userSeeds = state.seeds.filter((seed) => seed.source !== 'demo')
        const userSeedIds = new Set(userSeeds.map((seed) => seed.id))
        state.beds = state.beds.filter((bed) => bed.source !== 'demo')
        state.seeds = userSeeds
        state.threads = state.threads.filter(
          (thread) => userSeedIds.has(thread.fromSeedId) && userSeedIds.has(thread.toSeedId),
        )
        state.focusSessions = state.focusSessions.filter((session) => userSeedIds.has(session.seedId))
        state.meta.demoData = false
      },
      { label: 'Clear demo data', recordUndo: true },
    )
  }

  private commit(
    action: (state: GardenState) => void,
    options: { label?: string; recordUndo?: boolean; touch?: boolean } = {},
  ): void {
    const before = cloneValue(this.state)
    const next = cloneValue(this.state)
    action(next)
    if (options.touch !== false) {
      this.touch(next)
    }
    this.persist(next)
    this.state = next
    if (options.recordUndo && options.label) {
      this.undoStack.unshift({
        id: this.idFactory('undo'),
        label: options.label,
        snapshot: before,
        createdAt: this.now(),
      })
      if (this.undoStack.length > MAX_UNDO_ENTRIES) {
        this.undoStack.splice(MAX_UNDO_ENTRIES)
      }
    }
    this.emit()
  }

  private touch(state: GardenState): void {
    state.meta.updatedAt = this.now()
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  private load(): GardenState {
    const rawValue = this.storage.getItem(this.storageKey)
    if (!rawValue) {
      return createDemoGarden(this.now, this.idFactory)
    }
    try {
      const parsed = JSON.parse(rawValue)
      const state = parsePayload(parsed, this.now, this.idFactory)
      const payload = asRecord(parsed)
      if (payload && this.requiresMigration(payload as LegacyPayload)) {
        try {
          this.persist(state)
        } catch (error) {
          this.storageIssue = {
            kind: 'write',
            detail: error instanceof Error ? error.message : 'Unknown storage error',
            recoveryAvailable: false,
          }
        }
      }
      return state
    } catch (error) {
      this.malformedPayload = rawValue
      this.storageIssue = {
        kind: 'read',
        detail: error instanceof Error ? error.message : 'Unknown storage error',
        recoveryAvailable: true,
      }
      return createFallbackGarden(this.now)
    }
  }

  private requiresMigration(payload: LegacyPayload): boolean {
    return getSchemaVersion(payload, CURRENT_SCHEMA_VERSION) !== CURRENT_SCHEMA_VERSION || !Array.isArray(payload.beds)
  }

  private persist(state: GardenState): void {
    if (this.malformedPayload !== null) {
      this.storage.setItem(`${this.storageKey}:recovery`, this.malformedPayload)
    }
    this.storage.setItem(this.storageKey, JSON.stringify(state, null, 2))
    this.malformedPayload = null
  }
}
