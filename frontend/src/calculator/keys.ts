import type { Digit } from './entry'
import type { CalculatorEvent } from './reducer'

export interface KeySpec {
  /** Text on the key. */
  label: string
  /** Accessible name, for keys whose label is a symbol. */
  name: string
  event: CalculatorEvent
  variant: 'digit' | 'function' | 'operator' | 'equals'
  /** `KeyboardEvent.key` values that press this key. */
  shortcuts: readonly string[]
  /** Keys bigger than one grid cell. */
  span?: 'wide' | 'tall'
}

function digit(value: Digit, span?: 'wide'): KeySpec {
  return {
    label: value,
    name: value,
    event: { type: 'digit', digit: value },
    variant: 'digit',
    shortcuts: [value],
    span,
  }
}

/**
 * The keypad, row by row on a four-column grid. Keyboard shortcuts are read
 * from the same list, so the screen and the keyboard cannot drift apart.
 */
// prettier-ignore
export const KEYPAD: readonly KeySpec[] = [
  { label: 'AC', name: 'All clear', event: { type: 'clear' }, variant: 'function', shortcuts: ['Escape', 'Delete'] },
  { label: '⌫', name: 'Backspace', event: { type: 'backspace' }, variant: 'function', shortcuts: ['Backspace'] },
  { label: '%', name: 'Percent', event: { type: 'percent' }, variant: 'function', shortcuts: ['%'] },
  { label: '÷', name: 'Divide', event: { type: 'operator', operator: 'divide' }, variant: 'operator', shortcuts: ['/'] },

  { label: 'xʸ', name: 'Power', event: { type: 'operator', operator: 'power' }, variant: 'function', shortcuts: ['^'] },
  { label: '√', name: 'Square root', event: { type: 'sqrt' }, variant: 'function', shortcuts: ['r'] },
  { label: '±', name: 'Toggle sign', event: { type: 'toggleSign' }, variant: 'function', shortcuts: ['n'] },
  { label: '×', name: 'Multiply', event: { type: 'operator', operator: 'multiply' }, variant: 'operator', shortcuts: ['*', 'x'] },

  digit('7'),
  digit('8'),
  digit('9'),
  { label: '−', name: 'Subtract', event: { type: 'operator', operator: 'subtract' }, variant: 'operator', shortcuts: ['-'] },

  digit('4'),
  digit('5'),
  digit('6'),
  { label: '+', name: 'Add', event: { type: 'operator', operator: 'add' }, variant: 'operator', shortcuts: ['+'] },

  digit('1'),
  digit('2'),
  digit('3'),
  { label: '=', name: 'Equals', event: { type: 'equals' }, variant: 'equals', shortcuts: ['Enter', '='], span: 'tall' },

  digit('0', 'wide'),
  { label: '.', name: 'Decimal point', event: { type: 'decimal' }, variant: 'digit', shortcuts: ['.', ','] },
]

const byShortcut = new Map(
  KEYPAD.flatMap((key) =>
    key.shortcuts.map((shortcut) => [shortcut, key] as const),
  ),
)

/** The key a keyboard key presses, if any. */
export function keyForShortcut(key: string): KeySpec | undefined {
  return byShortcut.get(key)
}
