import { expect, it } from 'vitest'
import { GardenRepository } from './repository'
import { describeGrowth } from './growth'

function idea() {
  localStorage.clear()
  const repository = new GardenRepository(localStorage)
  repository.clearDemoData()
  const seed = repository.captureSeed({ text: 'A goal' })
  return { repository, seed }
}
it('does not treat planning or elapsed time as recorded accomplishment', () => {
  const { repository, seed } = idea()
  expect(describeGrowth(seed, repository.getState()).label).toBe('Seed')
  repository.editSeed(seed.id, { text: seed.text, note: '', nextAction: 'Take a step' })
  expect(describeGrowth(repository.getState().seeds[0], repository.getState()).label).toBe('Growing')
  repository.startFocusSession(seed.id, 5)
  expect(describeGrowth(repository.getState().seeds[0], repository.getState()).label).toBe('In focus')
  repository.pauseFocusSession(repository.getActiveFocusSession()!.id)
  expect(describeGrowth(repository.getState().seeds[0], repository.getState()).label).toBe('Paused')
})
it('blooms for recorded outcomes, not a completed timer with no result', () => {
  const { repository, seed } = idea()
  repository.startFocusSession(seed.id, 5)
  repository.completeFocusSession(repository.getActiveFocusSession()!.id, '')
  expect(describeGrowth(repository.getState().seeds[0], repository.getState()).stage).not.toBe('bloom')
  repository.startFocusSession(seed.id, 5)
  repository.completeFocusSession(repository.getActiveFocusSession()!.id, 'Made a first draft')
  expect(describeGrowth(repository.getState().seeds[0], repository.getState())).toMatchObject({ stage: 'bloom', label: 'Progress recorded' })
})
