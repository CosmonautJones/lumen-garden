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

  const designBed: Bed = {
    id: nextId('bed'),
    name: 'Design',
    intent: 'Shape ideas into prototypes and improve clarity',
    color: '#2f8f94',
    health: 'growing',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const systemsBed: Bed = {
    id: nextId('bed'),
    name: 'Systems',
    intent: 'Convert proposals into reliable workflows',
    color: '#d4ac47',
    health: 'seedling',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const firstSeed: Seed = {
    id: nextId('seed'),
    text: 'Capture one idea, then pick one concrete next action',
    note: 'This is the shortest possible way to move an idea from thought to momentum.',
    energy: 4,
    tags: ['capture', 'workflow'],
    status: 'inbox',
    source: seedSource,
    createdAt,
    updatedAt: createdAt,
  }

  const secondSeed: Seed = {
    id: nextId('seed'),
    text: 'Draft a one-week review process for what actually ships',
    note: 'Focus on outcomes, not output.',
    energy: 3,
    tags: ['review', 'execution'],
    status: 'inbox',
    source: seedSource,
    createdAt: createdAt + 3_000,
    updatedAt: createdAt + 3_000,
  }

  const thirdSeed: Seed = {
    id: nextId('seed'),
    text: 'Draft a local persistence migration test plan',
    note: 'No server means every edge case must be solved in the repository.',
    energy: 5,
    tags: ['testing', 'data'],
    status: 'active',
    bedId: systemsBed.id,
    source: seedSource,
    createdAt: createdAt + 6_000,
    updatedAt: createdAt + 6_000,
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seeds: [firstSeed, secondSeed, thirdSeed],
    beds: [designBed, systemsBed],
    threads: [
      {
        id: nextId('thread'),
        fromSeedId: firstSeed.id,
        toSeedId: thirdSeed.id,
        relation: 'extends',
        createdAt: createdAt + 9_000,
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
