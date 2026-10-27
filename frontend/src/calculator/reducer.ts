import type { Calculation, Operation } from '../api/types'
import {
  appendDecimalPoint,
  appendDigit,
  deleteLast,
  parsePastedNumber,
  toggleSign,
  type Digit,
} from './entry'
import type { Operator } from './operators'

// The calculator is a pure state machine. It never calls the API itself: it
// records the calculation it needs in `state.request`, and useCalculator runs
// it and reports back with a `succeeded` or `failed` event. Every rule below is
// therefore synchronous, deterministic and testable without a network.

/** The number on the display. */
export type Entry =
  | { kind: 'input'; text: string } // being typed
  | { kind: 'value'; value: number } // a result or recalled value; typing replaces it

/** What to do with a result once the API returns it. */
export type Continuation =
  | { kind: 'complete' } // "=": show the result
  | { kind: 'chain'; operator: Operator } // "2 + 3 ×": the result is ×'s left operand
  | { kind: 'replace' } // √ or %: the result replaces the entry

export interface CalculationRequest {
  id: number
  operation: Operation
  operands: number[]
  continuation: Continuation
}

export interface HistoryEntry {
  id: number
  calculation: Calculation
}

/** Keys that change the calculation, so they wait for a request in flight. */
export type InputEvent =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'operator'; operator: Operator }
  | { type: 'sqrt' }
  | { type: 'percent' }
  | { type: 'equals' }
  | { type: 'paste'; text: string }
  | { type: 'recall'; value: number }

export type CalculatorEvent =
  | InputEvent
  | { type: 'clear' }
  | { type: 'clearHistory' }
  | { type: 'succeeded'; id: number; calculation: Calculation }
  | { type: 'failed'; id: number; message: string }

export interface CalculatorState {
  /** Null right after an operator, until its right operand is started. */
  entry: Entry | null
  /** A binary operation waiting for its right operand. */
  pending: { operator: Operator; left: number } | null
  /** The calculation the API is working on. */
  request: CalculationRequest | null
  /** Keys pressed while a request was in flight, replayed once it succeeds. */
  queue: InputEvent[]
  /** Why the last action failed; cleared by the next key. */
  error: string | null
  /** The calculation behind the result on display, shown above it. */
  last: Calculation | null
  /** Completed calculations, newest first. */
  history: HistoryEntry[]
  /** Id for the next request; kept in state so that the reducer stays pure. */
  nextId: number
}

export const HISTORY_LIMIT = 20

export const PASTE_ERROR = 'Paste a plain number, like 1234.5'

export const initialState: CalculatorState = {
  entry: { kind: 'input', text: '0' },
  pending: null,
  request: null,
  queue: [],
  error: null,
  last: null,
  history: [],
  nextId: 1,
}

export function calculatorReducer(
  state: CalculatorState,
  event: CalculatorEvent,
): CalculatorState {
  switch (event.type) {
    case 'succeeded':
      return state.request?.id === event.id
        ? succeed(state, state.request, event.calculation)
        : state // a stale response, e.g. for a request AC cancelled
    case 'failed':
      // Keep everything as it was before the request, so the user can fix the
      // input or retry. Keys typed meanwhile assumed success, so drop them.
      return state.request?.id === event.id
        ? { ...state, request: null, queue: [], error: event.message }
        : state
    case 'clear':
      return { ...initialState, history: state.history, nextId: state.nextId }
    case 'clearHistory':
      return { ...state, history: [] }
    default:
      if (state.request) return { ...state, queue: [...state.queue, event] }
      return apply({ ...state, error: null }, event)
  }
}

function apply(state: CalculatorState, event: InputEvent): CalculatorState {
  switch (event.type) {
    case 'digit':
      return edit(state, (text) => appendDigit(text, event.digit), event.digit)
    case 'decimal':
      return edit(state, appendDecimalPoint, '0.')
    case 'toggleSign':
      return negate(state)
    case 'backspace':
      return state.entry?.kind === 'input'
        ? { ...state, entry: input(deleteLast(state.entry.text)) }
        : state
    case 'operator':
      return pressOperator(state, event.operator)
    case 'equals':
      return state.pending
        ? calculate(
            state,
            state.pending.operator,
            [state.pending.left, currentValue(state)],
            { kind: 'complete' },
          )
        : state
    case 'sqrt':
      return calculate(state, 'sqrt', [currentValue(state)], {
        kind: 'replace',
      })
    case 'percent':
      return calculate(
        state,
        'percentage',
        [currentValue(state), percentBase(state)],
        { kind: 'replace' },
      )
    case 'paste': {
      const text = parsePastedNumber(event.text)
      return text === null
        ? { ...state, error: PASTE_ERROR }
        : { ...state, entry: input(text), last: null }
    }
    case 'recall':
      return {
        ...state,
        entry: { kind: 'value', value: event.value },
        last: null,
      }
  }
}

/** Applies a typing key: edits the number being typed, or starts a new one. */
function edit(
  state: CalculatorState,
  change: (text: string) => string,
  start: string,
): CalculatorState {
  const entry =
    state.entry?.kind === 'input'
      ? input(change(state.entry.text))
      : input(start)
  return { ...state, entry, last: null }
}

function negate(state: CalculatorState): CalculatorState {
  const { entry } = state
  if (entry === null) return { ...state, entry: input('-0') } // start a negative operand
  if (entry.kind === 'input') {
    return { ...state, entry: input(toggleSign(entry.text)) }
  }
  // A negated result no longer matches the expression shown above it.
  const value = entry.value === 0 ? 0 : -entry.value
  return { ...state, entry: { kind: 'value', value }, last: null }
}

function pressOperator(
  state: CalculatorState,
  operator: Operator,
): CalculatorState {
  const { pending, entry } = state
  if (pending && entry) {
    return calculate(
      state,
      pending.operator,
      [pending.left, entryValue(entry)],
      { kind: 'chain', operator },
    )
  }
  if (pending) return { ...state, pending: { operator, left: pending.left } }
  return {
    ...state,
    pending: { operator, left: currentValue(state) },
    entry: null,
    last: null,
  }
}

/**
 * The % key works like a phone calculator's: with + or − pending it takes a
 * percentage of the left operand (200 + 15% → 200 + 30); otherwise it divides
 * by 100 (200 × 15% → 200 × 0.15).
 */
function percentBase({ pending }: CalculatorState): number {
  return pending?.operator === 'add' || pending?.operator === 'subtract'
    ? pending.left
    : 1
}

function calculate(
  state: CalculatorState,
  operation: Operation,
  operands: number[],
  continuation: Continuation,
): CalculatorState {
  return {
    ...state,
    request: { id: state.nextId, operation, operands, continuation },
    nextId: state.nextId + 1,
  }
}

function succeed(
  state: CalculatorState,
  request: CalculationRequest,
  calculation: Calculation,
): CalculatorState {
  const settled: CalculatorState = {
    ...continueWith(state, request.continuation, calculation),
    request: null,
    queue: [],
    history: [{ id: request.id, calculation }, ...state.history].slice(
      0,
      HISTORY_LIMIT,
    ),
  }
  // Replay keys pressed while waiting; one of them may start the next request.
  return state.queue.reduce(calculatorReducer, settled)
}

function continueWith(
  state: CalculatorState,
  continuation: Continuation,
  calculation: Calculation,
): CalculatorState {
  const result: Entry = { kind: 'value', value: calculation.result }
  switch (continuation.kind) {
    case 'complete':
      return { ...state, entry: result, pending: null, last: calculation }
    case 'chain':
      return {
        ...state,
        entry: null,
        pending: { operator: continuation.operator, left: calculation.result },
      }
    case 'replace':
      return { ...state, entry: result, last: calculation }
  }
}

function input(text: string): Entry {
  return { kind: 'input', text }
}

function entryValue(entry: Entry): number {
  return entry.kind === 'input' ? Number(entry.text) : entry.value
}

/** The value on display, which is the left operand right after an operator. */
function currentValue({ entry, pending }: CalculatorState): number {
  return entry ? entryValue(entry) : (pending?.left ?? 0)
}
