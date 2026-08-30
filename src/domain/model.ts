export const CURRENT_SCHEMA_VERSION = 1
export const STORAGE_KEY = 'lumen-garden:local-repository'

export const MIN_ENERGY = 1
export const MAX_ENERGY = 5

export type SeedSource = 'demo' | 'user'
export type SeedStatus = 'inbox' | 'active' | 'focused' | 'archived'
export type BedHealth = 'seedling' | 'growing' | 'blooming'
export type RelationType = 'supports' | 'extends' | 'blocks'
export type FocusStatus = 'running' | 'paused' | 'completed' | 'abandoned'

export interface Seed {
  id: string
  text: string
  note?: string
  energy: number
  tags: string[]
  status: SeedStatus
  bedId?: string
  source: SeedSource
  createdAt: number
  updatedAt: number
}

export interface Bed {
  id: string
  name: string
  intent: string
  color: string
  health: BedHealth
  source: SeedSource
  createdAt: number
  updatedAt: number
}

export interface Thread {
  id: string
  fromSeedId: string
  toSeedId: string
  relation: RelationType
  createdAt: number
}

export interface FocusSession {
  id: string
  seedId: string
  durationMinutes: number
  status: FocusStatus
  startedAt: number
  pausedAt?: number
  accumulatedPauseMs: number
  outcome?: string
  previousSeedStatus: SeedStatus
  endedAt?: number
}

export interface GardenMetadata {
  createdAt: number
  updatedAt: number
  demoData: boolean
}

export interface GardenState {
  schemaVersion: number
  seeds: Seed[]
  beds: Bed[]
  threads: Thread[]
  focusSessions: FocusSession[]
  meta: GardenMetadata
}

export interface SeedCaptureInput {
  text: string
  note?: string
  energy?: number
  tags?: string[]
}

export interface BedInput {
  name: string
  intent: string
  color: string
  health?: BedHealth
}

export interface ImportPreview {
  schemaVersion: number
  seeds: number
  beds: number
  threads: number
  focusSessions: number
}

const RELATION_LABELS: Record<RelationType, string> = {
  supports: 'supports',
  extends: 'extends',
  blocks: 'blocks',
}

export function normalizeEnergy(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 3
  }

  const rounded = Math.round(value)
  if (rounded < MIN_ENERGY) {
    return MIN_ENERGY
  }

  if (rounded > MAX_ENERGY) {
    return MAX_ENERGY
  }

  return rounded
}

export function normalizeTags(rawTags: unknown): string[] {
  const tags = Array.isArray(rawTags) ? rawTags : []
  const values = tags
    .map((value) => {
      if (typeof value !== 'string') {
        return ''
      }

      return value.trim().toLowerCase()
    })
    .filter((value) => value.length > 0)
  const deduplicated = Array.from(new Set(values))
  return deduplicated.slice(0, 12)
}

export function normalizeBedHealth(raw: unknown): BedHealth {
  if (raw === 'seedling' || raw === 'growing' || raw === 'blooming') {
    return raw
  }
  return 'seedling'
}

export function normalizeSeedStatus(raw: unknown): SeedStatus {
  if (raw === 'inbox' || raw === 'active' || raw === 'focused' || raw === 'archived') {
    return raw
  }
  return 'inbox'
}

export function normalizeRelation(raw: unknown): RelationType {
  if (raw === 'supports' || raw === 'extends' || raw === 'blocks') {
    return raw
  }
  return 'supports'
}

export function normalizeSeedSource(raw: unknown): SeedSource {
  if (raw === 'user' || raw === 'demo') {
    return raw
  }
  return 'user'
}

export function relationLabel(relation: RelationType): string {
  return RELATION_LABELS[relation]
}

/**
 * Chooses one concrete seed to tend without hiding the rest of the garden.
 * Active work takes precedence; within the same state, energy breaks ties
 * before the least-recently-touched seed keeps long-lived work visible.
 */
export function selectNextSeed(seeds: readonly Seed[]): Seed | null {
  const candidates = seeds.filter((seed) => seed.status === 'active' || seed.status === 'inbox')
  if (candidates.length === 0) {
    return null
  }

  return candidates.slice().sort((left, right) => {
    const statusPriority = Number(right.status === 'active') - Number(left.status === 'active')
    if (statusPriority !== 0) {
      return statusPriority
    }

    const energyPriority = right.energy - left.energy
    if (energyPriority !== 0) {
      return energyPriority
    }

    return left.updatedAt - right.updatedAt
  })[0]
}

export function nowDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function createDemoGarden(
  now: () => number,
  nextId: (prefix: string) => string,
): GardenState {
  const seedSource: SeedSource = 'demo'
  const createdAt = now()

  const productBed: Bed = {
    id: nextId('bed'),
    name: 'Product',
    intent: 'Turn the idea greenhouse into a useful local tool',
    color: '#2f8f94',
    health: 'growing',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const researchBed: Bed = {
    id: nextId('bed'),
    name: 'Research',
    intent: 'Learn what makes a fragment worth returning to',
    color: '#d4ac47',
    health: 'seedling',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const practiceBed: Bed = {
    id: nextId('bed'),
    name: 'Practice',
    intent: 'Build a calmer rhythm for capture, focus, and review',
    color: '#ce6f67',
    health: 'growing',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const researchSeed: Seed = {
    id: nextId('seed'),
    text: 'Ask five people why useful notes go stale',
    note: 'Look for the moment a promising fragment loses its context or its next action.',
    energy: 4,
    tags: ['research', 'interviews'],
    status: 'inbox',
    bedId: researchBed.id,
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const constellationSeed: Seed = {
    id: nextId('seed'),
    text: 'Connect fragments through explicit relationships',
    note: 'The constellation should reveal a useful trail without hiding the original notes.',
    energy: 5,
    tags: ['constellation', 'product'],
    status: 'active',
    bedId: productBed.id,
    source: seedSource,
    createdAt: createdAt + 3_000,
    updatedAt: createdAt + 3_000,
  }

  const releaseSeed: Seed = {
    id: nextId('seed'),
    text: 'Define the smallest useful Lumen Garden release',
    note: 'Capture quickly, connect deliberately, focus once, and review without a server.',
    energy: 5,
    tags: ['release', 'scope'],
    status: 'active',
    bedId: productBed.id,
    source: seedSource,
    createdAt: createdAt + 6_000,
    updatedAt: createdAt + 6_000,
  }

  const localDataSeed: Seed = {
    id: nextId('seed'),
    text: 'Keep every garden local, exportable, and recoverable',
    note: 'Local-first only works when the data controls earn trust.',
    energy: 4,
    tags: ['data', 'trust'],
    status: 'active',
    bedId: productBed.id,
    source: seedSource,
    createdAt: createdAt + 9_000,
    updatedAt: createdAt + 9_000,
  }

  const reviewSeed: Seed = {
    id: nextId('seed'),
    text: 'Run a weekly review that ends with one next action',
    note: 'The review should make neglected work visible without turning into a reporting ritual.',
    energy: 3,
    tags: ['review', 'practice'],
    status: 'active',
    bedId: practiceBed.id,
    source: seedSource,
    createdAt: createdAt + 12_000,
    updatedAt: createdAt + 12_000,
  }

  const onboardingSeed: Seed = {
    id: nextId('seed'),
    text: 'Write the first-use walkthrough in the empty states',
    note: 'The interface should teach capture, connection, and focus at the moment each becomes possible.',
    energy: 2,
    tags: ['onboarding', 'writing'],
    status: 'inbox',
    bedId: practiceBed.id,
    source: seedSource,
    createdAt: createdAt + 15_000,
    updatedAt: createdAt + 15_000,
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seeds: [researchSeed, constellationSeed, releaseSeed, localDataSeed, reviewSeed, onboardingSeed],
    beds: [productBed, researchBed, practiceBed],
    threads: [
      {
        id: nextId('thread'),
        fromSeedId: researchSeed.id,
        toSeedId: constellationSeed.id,
        relation: 'supports',
        createdAt: createdAt + 18_000,
      },
      {
        id: nextId('thread'),
        fromSeedId: constellationSeed.id,
        toSeedId: releaseSeed.id,
        relation: 'supports',
        createdAt: createdAt + 21_000,
      },
      {
        id: nextId('thread'),
        fromSeedId: releaseSeed.id,
        toSeedId: localDataSeed.id,
        relation: 'extends',
        createdAt: createdAt + 24_000,
      },
      {
        id: nextId('thread'),
        fromSeedId: reviewSeed.id,
        toSeedId: releaseSeed.id,
        relation: 'supports',
        createdAt: createdAt + 27_000,
      },
      {
        id: nextId('thread'),
        fromSeedId: onboardingSeed.id,
        toSeedId: releaseSeed.id,
        relation: 'supports',
        createdAt: createdAt + 30_000,
      },
    ],
    focusSessions: [],
    meta: {
      createdAt,
      updatedAt: createdAt,
      demoData: true,
    },
  }
}

export function createFallbackGarden(now: () => number): GardenState {
  const createdAt = now()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seeds: [],
    beds: [],
    threads: [],
    focusSessions: [],
    meta: {
      createdAt,
      updatedAt: createdAt,
      demoData: false,
    },
  }
}
