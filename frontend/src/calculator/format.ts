import type { Calculation } from '../api/types'
import { OPERATOR_SYMBOLS } from './operators'

// Results arrive with up to 15 significant digits. The display shows one
// fewer, a guard digit like a hardware calculator's, so that rounding left
// over from earlier steps stays hidden: 1 ÷ 3 × 3 is 0.999999999999999 at 15
// digits, and reads 1.
const DISPLAY_DIGITS = 14

const integerFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})
const fractionFormat = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: DISPLAY_DIGITS,
})
const scientificFormat = new Intl.NumberFormat('en-US', {
  notation: 'scientific',
  maximumSignificantDigits: 10,
})

/**
 * Formats a value for display. Every digit is shown while every digit is
 * exact; beyond the safe-integer range, scientific notation is more honest,
 * and below 1e-6 (where JavaScript itself switches) it is shorter. Never
 * shows "-0".
 */
export function formatNumber(value: number): string {
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude > Number.MAX_SAFE_INTEGER || magnitude < 1e-6) {
    return scientificFormat.format(value)
  }
  // From 10^14 on, DISPLAY_DIGITS would cut integer digits, so that
  // 2^50 + 0.5 would look smaller than 2^50. Round to the integer instead.
  return Number.isInteger(value) || magnitude >= 10 ** DISPLAY_DIGITS
    ? integerFormat.format(value)
    : fractionFormat.format(value)
}

/** Adds thousands separators to typed text, keeping a trailing "." or zeros. */
export function formatInput(text: string): string {
  const [whole = '', fraction] = text.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/** Describes a calculation the way it was entered, such as "15% of 200". */
export function describeCalculation({
  operation,
  operands: [a = 0, b = 0],
}: Calculation): string {
  switch (operation) {
    case 'sqrt':
      return `√${operand(a)}`
    case 'percentage':
      return b === 1 ? `${operand(a)}%` : `${operand(a)}% of ${operand(b)}`
    default:
      return `${operand(a)} ${OPERATOR_SYMBOLS[operation]} ${operand(b)}`
  }
}

function operand(value: number): string {
  return value < 0 ? `(${formatNumber(value)})` : formatNumber(value)
}
