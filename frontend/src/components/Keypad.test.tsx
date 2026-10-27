import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { KEYPAD } from '../calculator/keys'
import type { CalculatorEvent } from '../calculator/reducer'
import { Keypad } from './Keypad'

describe('Keypad', () => {
  it('renders every key with an accessible name', () => {
    render(<Keypad onPress={() => {}} />)

    const keys = screen.getAllByRole('button')
    expect(keys.map((key) => key.textContent)).toEqual(
      KEYPAD.map((key) => key.label),
    )
    expect(
      screen.getByRole('button', { name: 'Square root' }),
    ).toHaveTextContent('√')
  })

  it('reports the event of the key pressed', async () => {
    const onPress = vi.fn<(event: CalculatorEvent) => void>()
    render(<Keypad onPress={onPress} />)

    await userEvent.click(screen.getByRole('button', { name: 'Divide' }))

    expect(onPress).toHaveBeenCalledExactlyOnceWith({
      type: 'operator',
      operator: 'divide',
    })
  })

  it('advertises keyboard shortcuts', () => {
    render(<Keypad onPress={() => {}} />)

    expect(screen.getByRole('button', { name: 'Multiply' })).toHaveAttribute(
      'aria-keyshortcuts',
      '* x',
    )
    // "+" separates modifiers in aria-keyshortcuts, so it cannot be listed.
    expect(screen.getByRole('button', { name: 'Add' })).not.toHaveAttribute(
      'aria-keyshortcuts',
    )
  })
})
