import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GardenRepository } from './domain/repository'

class QuotaStorage {
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

function createRepository(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.localStorage,
  clearDemoData = true,
): GardenRepository {
  let id = 0
  const repository = new GardenRepository(storage, {
    storageKey: 'lumen-garden:test-repository',
    now: () => 1_700_000_000_000,
    idFactory: (prefix) => `${prefix}-${++id}`,
  })
  if (clearDemoData) {
    repository.clearDemoData()
  }
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

  it('renders connected seeds as keyboard-accessible constellation nodes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(within(screen.getByRole('navigation', { name: 'Explore' })).getByRole('button', { name: 'Constellation' }))

    const constellation = screen.getByRole('group', { name: 'Visual constellation' })
    const seedNode = within(constellation).getByRole('button', { name: /Capture one idea/i })
    expect(seedNode).toBeInTheDocument()
    expect(within(constellation).getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(within(constellation).getAllByRole('button')).toHaveLength(3)
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

  it('recommends one actionable seed in review and starts focus from that recommendation', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    const bed = repository.createBed({
      name: 'Portfolio',
      intent: 'Ship the strongest proof of work',
      color: '#2f8f94',
    })
    const inboxSeed = repository.captureSeed({ text: 'Collect screenshots', energy: 5 })
    const activeSeed = repository.captureSeed({ text: 'Write a credible case study', energy: 4 })
    repository.moveSeedToBed(activeSeed.id, bed.id)
    expect(repository.getSeed(inboxSeed.id)).toEqual(expect.objectContaining({ status: 'inbox' }))

    render(<App repository={repository} />)
    await user.click(within(screen.getByRole('navigation', { name: 'Operate' })).getByRole('button', { name: 'Review' }))

    const recommendation = screen.getByRole('heading', { name: 'Next to tend' }).closest('section')
    expect(recommendation).not.toBeNull()
    expect(within(recommendation!).getByText('Write a credible case study')).toBeInTheDocument()
    await user.click(within(recommendation!).getByRole('button', { name: 'Start a focus block' }))

    expect(screen.getByRole('heading', { name: 'Active session' })).toBeInTheDocument()
    expect(repository.getActiveFocusSession()).toEqual(expect.objectContaining({ seedId: activeSeed.id }))
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

  it('withdraws a stale import preview when its source JSON changes', async () => {
    const user = userEvent.setup()
    const repository = createRepository()
    render(<App repository={repository} />)

    await user.click(screen.getByLabelText('Import JSON'))
    await user.paste(repository.exportData())
    await user.click(screen.getByRole('button', { name: 'Preview import' }))
    expect(screen.getByRole('button', { name: 'Replace current garden' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Import JSON'), ' ')

    expect(screen.queryByRole('button', { name: 'Replace current garden' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Preview cleared because the import JSON changed.')
  })

  it('keeps a failed capture visible and explains when local storage cannot save it', async () => {
    const user = userEvent.setup()
    const storage = new QuotaStorage()
    const repository = createRepository(storage)
    storage.failWrites = true
    render(<App repository={repository} />)

    await user.type(screen.getByLabelText('Idea fragment'), 'Do not lose this failed capture')
    await user.click(screen.getByRole('button', { name: 'Capture' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i)
    expect(screen.getByLabelText('Idea fragment')).toHaveValue('Do not lose this failed capture')
    expect(repository.getState().seeds).toEqual([])
  })

  it('explains how to preserve a recovery copy when existing local storage is malformed', () => {
    const storage = new QuotaStorage()
    storage.setItem('lumen-garden:test-repository', '{not valid JSON')
    const repository = createRepository(storage, false)

    render(<App repository={repository} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not read your previous local garden/i)
    expect(screen.getByRole('button', { name: 'Export recovery copy' })).toBeInTheDocument()
  })
})
