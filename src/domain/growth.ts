import type { GardenState, Seed } from './model'

export function describeGrowth(seed: Seed, state: GardenState) {
  const outcomes = state.focusSessions.filter(item => item.seedId === seed.id && item.status === 'completed' && item.outcome?.trim())
    .slice().sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
  const session = state.focusSessions.find(item => item.seedId === seed.id && (item.status === 'running' || item.status === 'paused'))
  const stage = outcomes.length ? 'bloom' : seed.nextAction?.trim() || seed.status === 'active' || session ? 'leaf' : 'sprout'
  const label = session?.status === 'paused' ? 'Paused' : session ? 'In focus' : outcomes.length ? 'Progress recorded' : stage === 'leaf' ? 'Growing' : 'Seed'
  return { stage, label, outcomes }
}
