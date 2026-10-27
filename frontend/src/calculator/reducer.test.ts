import { describe, expect, it } from 'vitest'
import { compute } from '../test/fakeClient'
import { keyForShortcut } from './keys'
import { errorMessage } from './messages'
import {
  calculatorReducer,
  HISTORY_LIMIT,
  initialState,
  PASTE_ERROR,
  type CalculatorEvent,
  type CalculatorState,
} from './reducer'
import { displayExpression, displayValue } from './selectors'

// Keys are written as KeyboardEvent.key values and mapped through the app's
// own shortcut table, so "2+3*4=" means exactly what typing it would. A string
// is one key per character; an array allows named keys such as "Backspace".

function eventsFor(keys: string | string[]): CalculatorEvent[] {
  const list = typeof keys === 'string' ? keys.split('') : keys
  return list.map((key) => {
    const spec = keyForShortcut(key)
    if (!spec) throw new Error(`no calculator key for ${JSON.stringify(key)}`)
    return spec.event
  })
}

/** Presses keys without answering requests, as if the API were slow. */
function press(state: CalculatorState, keys: string | string[]) {
  return eventsFor(keys).reduce(calculatorReducer, state)
}

/** Presses keys, answering every calculation the way the API would. */
function run(keys: string | string[], state = initialState) {
  return eventsFor(keys).reduce(
    (current, event) => settle(calculatorReducer(current, event)),
    state,
  )
}

/** Answers the request in flight, then any request its replayed keys start. */
function settle(state: CalculatorState): CalculatorState {
  let current = state
  while (current.request) current = answer(current)
  return current
}

/** Answers only the request in flight. */
function answer(state: CalculatorState): CalculatorState {
  const { id, operation, operands } = requestOf(state)
  try {
    const calculation = compute(operation, operands)
    return calculatorReducer(state, { type: 'succeeded', id, calculation })
  } catch (error) {
    const message = errorMessage(error)
    return calculatorReducer(state, { type: 'failed', id, message })
  }
}

function fail(state: CalculatorState, message: string) {
  return calculatorReducer(state, {
    type: 'failed',
    id: requestOf(state).id,
    message,
  })
}

function paste(state: CalculatorState, text: string) {
  return calculatorReducer(state, { type: 'paste', text })
}

function requestOf(state: CalculatorState) {
  if (!state.request) throw new Error('no request in flight')
  return state.request
}

/** What the user sees. */
function screenOf(state: CalculatorState) {
  return {
    value: displayValue(state),
    expression: displayExpression(state),
    error: state.error,
  }
}

describe('entering numbers', () => {
  it('starts at zero', () => {
    expect(screenOf(initialState)).toEqual({
      value: '0',
      expression: '',
      error: null,
    })
  })

  it.each([
    ['007', '7'],
    ['1.2.3', '1.23'],
    ['.5', '0.5'],
    ['1234567', '1,234,567'],
    ['1234567890123456', '123,456,789,012,345'],
    ['5n', '-5'],
    ['5nn', '5'],
    ['n5', '-5'],
  ])('typing %s shows %s', (keys, value) => {
    expect(displayValue(run(keys))).toBe(value)
  })

  it.each([
    [['1', '2', '3', 'Backspace'], '12'],
    [['5', 'Backspace'], '0'],
    [['5', 'n', 'Backspace'], '0'],
    [['0', '.', 'Backspace'], '0'],
  ])('backspace: %j shows %s', (keys, value) => {
    expect(displayValue(run(keys))).toBe(value)
  })
})

describe('binary operations', () => {
  it('asks the API for the operation', () => {
    expect(press(initialState, '12+7=').request).toMatchObject({
      operation: 'add',
      operands: [12, 7],
    })
  })

  it('shows the result and how it came about', () => {
    expect(screenOf(run('12+7='))).toEqual({
      value: '19',
      expression: '12 + 7 =',
      error: null,
    })
  })

  it('shows the pending operation while the right operand is typed', () => {
    expect(screenOf(run('12+'))).toMatchObject({
      value: '12',
      expression: '12 +',
    })
    expect(screenOf(run('12+7'))).toMatchObject({
      value: '7',
      expression: '12 +',
    })
  })

  it.each([
    ['2+3*4=', '20'], // left to right, like a basic calculator
    ['2+*3=', '6'], // a second operator replaces the first
    ['2+=', '4'], // = reuses the displayed value
    ['2+3=*4=', '20'], // a result starts the next operation
    ['5*n3=', '-15'], // ± after an operator starts a negative operand
    ['2^10=', '1,024'],
    ['10/4=', '2.5'],
    ['9-12=', '-3'],
  ])('%s → %s', (keys, value) => {
    expect(displayValue(run(keys))).toBe(value)
  })

  it('ignores = when nothing is pending', () => {
    expect(run('5=')).toEqual(run('5'))
    const result = run('2+3=')
    expect(run('=', result)).toEqual(result)
  })

  it('starts over when a digit follows a result', () => {
    expect(screenOf(run('2+3=7'))).toMatchObject({ value: '7', expression: '' })
  })

  it('negates a result with ±', () => {
    expect(screenOf(run('2+3=n'))).toMatchObject({
      value: '-5',
      expression: '',
    })
    expect(displayValue(run('2-2=n'))).toBe('0')
  })

  it('leaves a result alone on backspace', () => {
    expect(displayValue(run(['2', '+', '3', '=', 'Backspace']))).toBe('5')
  })
})

describe('square root and percent', () => {
  it('replaces the entry with its square root', () => {
    expect(screenOf(run('81r'))).toMatchObject({
      value: '9',
      expression: '√81 =',
    })
  })

  it.each([
    ['2+9r=', '5'], // √ keeps the pending addition
    ['9+r=', '12'], // right after an operator, √ applies to the shown value
    ['200+15%=', '230'], // + and − take a percentage of the left operand
    ['200-15%=', '170'],
    ['200*15%=', '30'], // anything else divides by 100
    ['200/50%=', '400'],
    ['50%', '0.5'],
    ['200+%=', '600'], // % right after + takes 200% of 200
  ])('%s → %s', (keys, value) => {
    expect(displayValue(run(keys))).toBe(value)
  })

  it('describes a percentage of 1 as a plain percentage', () => {
    expect(displayExpression(run('50%'))).toBe('50% =')
  })
})

describe('talking to the API', () => {
  it('queues keys pressed while waiting and replays them in order', () => {
    let state = press(initialState, '2+3*4=')
    expect(state.request).toMatchObject({ operation: 'add', operands: [2, 3] })
    expect(state.queue).toHaveLength(2) // "4" and "="

    state = answer(state)
    expect(state.request).toMatchObject({
      operation: 'multiply',
      operands: [5, 4],
    })
    expect(displayValue(answer(state))).toBe('20')
  })

  it('cancels the request and the queue on AC', () => {
    const waiting = press(initialState, '2+3*4')
    const cleared = calculatorReducer(waiting, { type: 'clear' })

    expect(cleared).toMatchObject({
      entry: initialState.entry,
      pending: null,
      request: null,
      queue: [],
    })
    const late: CalculatorEvent = {
      type: 'succeeded',
      id: requestOf(waiting).id,
      calculation: compute('add', [2, 3]),
    }
    expect(calculatorReducer(cleared, late)).toBe(cleared)
  })

  it('ignores answers to other requests', () => {
    const waiting = press(initialState, '2+3=')
    const otherId = requestOf(waiting).id + 1

    expect(
      calculatorReducer(waiting, {
        type: 'succeeded',
        id: otherId,
        calculation: compute('add', [9, 9]),
      }),
    ).toBe(waiting)
    expect(
      calculatorReducer(waiting, { type: 'failed', id: otherId, message: 'x' }),
    ).toBe(waiting)
  })

  it('keeps the input after a failure, so that it can be fixed', () => {
    const failed = run('5/0=')
    expect(screenOf(failed)).toEqual({
      value: '0',
      expression: '5 ÷',
      error: "Can't divide by zero",
    })

    expect(screenOf(run(['Backspace', '2', '='], failed))).toEqual({
      value: '2.5',
      expression: '5 ÷ 2 =',
      error: null,
    })
  })

  it('drops keys queued behind a failed request', () => {
    const waiting = press(initialState, '5/0=+1')
    expect(waiting.queue).toHaveLength(2)

    const failed = fail(waiting, "Can't divide by zero")

    expect(failed).toMatchObject({ request: null, queue: [] })
    expect(screenOf(failed)).toEqual({
      value: '0',
      expression: '5 ÷',
      error: "Can't divide by zero",
    })
  })

  // A failure leaves the state as it was, so pressing the same key again sends
  // the same request.
  it.each([
    ['6*7=', '=', 'multiply', [6, 7]],
    ['9+16r', 'r', 'sqrt', [16]],
    ['2+3*', '*', 'add', [2, 3]],
  ])('retries %s by pressing %s again', (keys, again, operation, operands) => {
    const failed = fail(press(initialState, keys), 'Offline')

    expect(press(failed, again).request).toMatchObject({
      operation,
      operands,
    })
  })

  it('finishes the calculation once the retry succeeds', () => {
    const failed = fail(press(initialState, '9+16r'), 'Offline')

    expect(screenOf(run(['r', '='], failed))).toEqual({
      value: '13',
      expression: '9 + 4 =',
      error: null,
    })
  })

  it('clears the error on the next key and applies that key', () => {
    expect(screenOf(run('5/0=3'))).toEqual({
      value: '3',
      expression: '5 ÷',
      error: null,
    })
  })

  it('gives every request a fresh id', () => {
    const first = press(initialState, '1+1=')
    const second = press(settle(first), '+1=')

    expect(requestOf(second).id).toBe(requestOf(first).id + 1)
  })
})

describe('paste', () => {
  it.each([
    [' 42 ', '42'],
    ['-3.5', '-3.5'],
    ['+7', '7'],
    ['.5', '0.5'],
  ])('accepts %j as %s', (text, value) => {
    expect(screenOf(paste(initialState, text))).toMatchObject({
      value,
      error: null,
    })
  })

  it('keeps a pending operation', () => {
    expect(displayValue(run('=', paste(run('5+'), '10')))).toBe('15')
  })

  it.each([
    '',
    '1e3',
    '0x10',
    'Infinity',
    '1,234',
    '1.2.3',
    '1234567890123456',
  ])('rejects %j and keeps the entry', (text) => {
    const state = run('12')
    expect(paste(state, text)).toEqual({ ...state, error: PASTE_ERROR })
  })
})

describe('history', () => {
  it('records every calculation, newest first, chained steps included', () => {
    const { history } = run('2+3*4=')

    expect(history.map(({ calculation }) => calculation)).toEqual([
      { operation: 'multiply', operands: [5, 4], result: 20 },
      { operation: 'add', operands: [2, 3], result: 5 },
    ])
  })

  it(`keeps the latest ${HISTORY_LIMIT}`, () => {
    // 1 + 1, then "+ 1" twenty more times: 21 calculations, results 2 to 22.
    const { history } = run(`1+1=${'+1='.repeat(HISTORY_LIMIT)}`)

    expect(history).toHaveLength(HISTORY_LIMIT)
    expect(history[0]?.calculation.result).toBe(22)
    expect(history.at(-1)?.calculation.result).toBe(3)
  })

  it('recalls a result onto the display, even mid-operation', () => {
    const recalled = calculatorReducer(run('5+'), { type: 'recall', value: 19 })

    expect(screenOf(recalled)).toMatchObject({
      value: '19',
      expression: '5 +',
    })
    expect(displayValue(run('=', recalled))).toBe('24')
  })

  it('survives AC and empties on Clear', () => {
    const state = run('2+3=')

    expect(calculatorReducer(state, { type: 'clear' }).history).toHaveLength(1)
    expect(calculatorReducer(state, { type: 'clearHistory' }).history).toEqual(
      [],
    )
  })
})

describe('purity', () => {
  it('gives the same output for the same input and never mutates it', () => {
    const state = press(initialState, '2+3*')
    const snapshot = structuredClone(state)
    const event: CalculatorEvent = {
      type: 'succeeded',
      id: requestOf(state).id,
      calculation: compute('add', [2, 3]),
    }

    expect(calculatorReducer(state, event)).toEqual(
      calculatorReducer(state, event),
    )
    expect(state).toEqual(snapshot)
  })
})
