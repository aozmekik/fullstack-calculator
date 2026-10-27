import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CalculatorClient } from '../api/client'
import { NetworkError } from '../api/errors'
import { fakeClient, heldClient } from '../test/fakeClient'
import { Calculator } from './Calculator'

function setup(client: CalculatorClient = fakeClient()) {
  const user = userEvent.setup()
  render(<Calculator client={client} />)
  const calculator = within(screen.getByRole('region', { name: 'Calculator' }))
  return {
    user,
    calculator,
    display: () => screen.getByRole('status'),
    alert: () => screen.getByRole('alert'),
    click: async (...names: string[]) => {
      for (const name of names) {
        await user.click(screen.getByRole('button', { name }))
      }
    },
  }
}

describe('Calculator', () => {
  it('calculates with the on-screen keys, through the API', async () => {
    const client = fakeClient()
    const { click, display, calculator } = setup(client)

    await click('1', '2', 'Add', '7', 'Equals')

    expect(display()).toHaveTextContent('19')
    expect(calculator.getByText('12 + 7 =')).toBeInTheDocument()
    expect(client.calculate).toHaveBeenCalledExactlyOnceWith(
      'add',
      [12, 7],
      expect.anything(),
    )
  })

  it('calculates from the keyboard', async () => {
    const { user, display } = setup()

    await user.keyboard('2^10{Enter}')

    expect(display()).toHaveTextContent('1,024')
  })

  it('treats Enter as = after clicking keys, without repeating the last one', async () => {
    const client = fakeClient()
    const { user, click, display } = setup(client)

    await click('2', 'Add', '3') // a click does not move focus to "3"
    await user.keyboard('{Enter}')

    expect(display()).toHaveTextContent('5')
    expect(client.calculate).toHaveBeenCalledExactlyOnceWith(
      'add',
      [2, 3],
      expect.anything(),
    )
  })

  it('lets Enter press the button a keyboard user focused', async () => {
    const { user, display } = setup()

    await user.keyboard('2+3=9')
    screen.getByRole('button', { name: '2 + 3 = 5' }).focus()
    await user.keyboard('{Enter}')
    expect(display()).toHaveTextContent('5')

    await user.keyboard('+1')
    screen.getByRole('button', { name: 'AC' }).focus()
    await user.keyboard('{Enter}')
    expect(display()).toHaveTextContent('0')
    expect(screen.queryByText('5 +')).not.toBeInTheDocument()
  })

  it('leaves other keys alone, so Tab still moves focus', async () => {
    const { user, display } = setup()

    await user.keyboard('a')
    await user.tab()

    expect(display()).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'AC' })).toHaveFocus()
  })

  it('leaves Ctrl, Cmd and Alt shortcuts to the browser', async () => {
    const { user, display } = setup()

    await user.keyboard('{Control>}7{/Control}{Meta>}8{/Meta}{Alt>}9{/Alt}')

    expect(display()).toHaveTextContent('0')
  })

  it('explains a failed calculation and keeps the input', async () => {
    const { user, display, calculator, alert } = setup()

    await user.keyboard('5/0{Enter}')

    expect(alert()).toHaveTextContent("Can't divide by zero")
    expect(display()).toHaveTextContent('0')
    expect(calculator.getByText('5 ÷')).toBeInTheDocument()
  })

  it('recovers from a network failure when retried', async () => {
    const client = fakeClient()
    client.calculate.mockRejectedValueOnce(new NetworkError('unreachable'))
    const { user, display, alert } = setup(client)

    await user.keyboard('6*7{Enter}')
    expect(alert()).toHaveTextContent("Can't reach the calculator service")

    await user.keyboard('{Enter}')
    expect(display()).toHaveTextContent('42')
    expect(alert()).toBeEmptyDOMElement()
  })

  it('keeps every key typed while an answer is on its way', async () => {
    const { client, release } = heldClient()
    const { user, display } = setup(client)

    await user.keyboard('2+3*4=')
    expect(display().closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    )

    await act(async () => release()) // 2 + 3; the replayed keys ask for 5 × 4
    await act(async () => release()) // 5 × 4

    expect(display()).toHaveTextContent('20')
    expect(display().closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
  })

  it('cancels a calculation in flight on AC', async () => {
    const { client, release } = heldClient()
    const { user, click, display } = setup(client)

    await user.keyboard('8*8=')
    await click('AC')
    await act(async () => release())

    expect(display()).toHaveTextContent('0')
    expect(screen.getByText(/your calculations appear here/i)).toBeVisible()
  })

  it('reuses a result from the history', async () => {
    const { user, display } = setup()

    await user.keyboard('2+3=9')
    await user.click(screen.getByRole('button', { name: '2 + 3 = 5' }))

    expect(display()).toHaveTextContent('5')
  })

  it('clears the history', async () => {
    const { user, click } = setup()

    await user.keyboard('2+3=')
    await click('Clear')

    expect(
      screen.queryByRole('button', { name: '2 + 3 = 5' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it('accepts a pasted number and rejects anything else', async () => {
    const { user, display, alert } = setup()

    await user.paste('1234.5')
    expect(display()).toHaveTextContent('1,234.5')

    await user.paste('12abc')
    expect(alert()).toHaveTextContent('Paste a plain number')
    expect(display()).toHaveTextContent('1,234.5')
  })

  it('ignores a paste without text', () => {
    const { display } = setup()

    fireEvent.paste(window)

    expect(display()).toHaveTextContent('0')
  })

  it('shows the operation in progress', async () => {
    const { user, calculator, display } = setup()

    await user.keyboard('12+')

    expect(display()).toHaveTextContent('12')
    await waitFor(() => expect(calculator.getByText('12 +')).toBeVisible())
  })
})
