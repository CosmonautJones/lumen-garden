import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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

    await user.click(within(screen.getByRole('navigation', { name: 'Explore' })).getByRole('button', { name: 'Constellation' }))

    expect(screen.getByText('Select seeds to connect ideas and keep relation context visible.')).toBeInTheDocument()
  })

  it('captures a seed and starts a focus session for the selected seed', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.type(screen.getByLabelText('Idea fragment'), 'Turn field notes into a useful outline')
    await user.click(screen.getByRole('button', { name: 'Capture' }))
    await user.click(within(screen.getByRole('navigation', { name: 'Operate' })).getByRole('button', { name: 'Focus' }))

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

  it('separates operating views from exploration and announces the active workspace', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    expect(screen.getByRole('navigation', { name: 'Operate' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Explore' })).toBeInTheDocument()
    const operateNavigation = screen.getByRole('navigation', { name: 'Operate' })
    const exploreNavigation = screen.getByRole('navigation', { name: 'Explore' })
    expect(within(operateNavigation).getByRole('button', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(exploreNavigation).getByRole('button', { name: 'Constellation' }))

    expect(within(exploreNavigation).getByRole('button', { name: 'Constellation' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('status')).toHaveTextContent('Explore: Constellation')
  })

  it('moves focus into the command menu, keeps keyboard navigation inside it, and restores focus on close', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    const trigger = screen.getByRole('button', { name: /Commands/ })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Command menu' })
    expect(screen.getByRole('button', { name: 'Close command menu' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /Open review/ })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Close command menu' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Close command menu' }))
    expect(dialog).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('offers a direct capture path when exploration and focus have no available seeds', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.click(within(screen.getByRole('navigation', { name: 'Explore' })).getByRole('button', { name: 'Constellation' }))
    expect(screen.getByText('Nothing is in this constellation yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capture a seed' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Operate' })).getByRole('button', { name: 'Focus' }))
    expect(screen.getByText('Capture a seed to begin a focus session.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Begin' })).toBeDisabled()
  })

  it('announces import validation errors', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.type(screen.getByLabelText('Import JSON'), 'not json')
    await user.click(screen.getByRole('button', { name: 'Preview import' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Unexpected token')
  })
})
