import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GardenRepository } from './domain/repository'

function createRepository(): GardenRepository {
  let id = 0
  const repository = new GardenRepository(window.localStorage, {
    storageKey: 'lumen-garden:test-repository',
    now: () => 1_700_000_000_000,
    idFactory: (prefix) => `${prefix}-${++id}`,
  })
  repository.clearDemoData()
  return repository
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('Lumen Garden navigation', () => {
  it('switches from the inbox to the constellation workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /constellation/i }))

    expect(screen.getByText('Select seeds to connect ideas and keep relation context visible.')).toBeInTheDocument()
  })

  it('captures a seed and starts a focus session for the selected seed', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.type(screen.getByLabelText('Idea fragment'), 'Turn field notes into a useful outline')
    await user.click(screen.getByRole('button', { name: 'Capture' }))
    await user.click(screen.getByRole('button', { name: /^Focus3$/ }))

    const seed = repository.getState().seeds[0]
    await user.selectOptions(screen.getByLabelText('Seed'), seed.id)
    await user.click(screen.getByRole('button', { name: 'Begin' }))

    expect(screen.getByRole('heading', { name: 'Active session' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Outcome text'), 'Write the opening section')
    await user.tab()
    expect(repository.getActiveFocusSession()).toEqual(
      expect.objectContaining({
        seedId: seed.id,
        status: 'running',
        outcome: 'Write the opening section',
      }),
    )
  })

  it('opens a bed in the review filter from the garden rail', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const bed = repository.createBed({
      name: 'Release garden',
      intent: 'Finish the smallest useful release',
      color: '#2f8f94',
    })
    render(<App repository={repository} />)

    await user.click(screen.getByRole('button', { name: 'Release garden' }))

    expect(screen.getByRole('region', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bed')).toHaveValue(bed.id)
  })

  it('opens the keyboard command menu and returns focus to capture', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Command menu' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Focus capture/i }))
    expect(screen.getByLabelText('Idea fragment')).toHaveFocus()
  })

  it('labels every capture field for keyboard and assistive-technology users', () => {
    const repository = createRepository()
    render(<App repository={repository} />)

    expect(screen.getByLabelText('Idea fragment')).toBeInTheDocument()
    expect(screen.getByLabelText('Optional note')).toBeInTheDocument()
    expect(screen.getByLabelText('Tags')).toBeInTheDocument()
    expect(screen.getByLabelText('Energy')).toBeInTheDocument()
  })
})
