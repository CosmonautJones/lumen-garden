import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => {
  window.localStorage.clear()
})

describe('Lumen Garden navigation', () => {
  it('switches from the inbox to the constellation workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /constellation/i }))

    expect(screen.getByText('Select seeds to connect ideas and keep relation context visible.')).toBeInTheDocument()
  })
})
