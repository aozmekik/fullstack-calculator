import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { fakeClient } from './test/fakeClient'

describe('App', () => {
  it('renders the calculator with its history and keyboard help', () => {
    render(<App client={fakeClient()} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Calculator' }),
    ).toBeVisible()
    expect(screen.getByRole('group', { name: 'Keypad' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'History' })).toBeVisible()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Keyboard:')
  })
})
