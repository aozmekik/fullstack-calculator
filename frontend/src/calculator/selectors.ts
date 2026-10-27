import { describeCalculation, formatInput, formatNumber } from './format'
import { OPERATOR_SYMBOLS } from './operators'
import type { CalculatorState } from './reducer'

/** The number on the display. */
export function displayValue({ entry, pending }: CalculatorState): string {
  if (entry === null) return formatNumber(pending?.left ?? 0)
  return entry.kind === 'input'
    ? formatInput(entry.text)
    : formatNumber(entry.value)
}

/** The line above the number: the pending operation, or how the result came about. */
export function displayExpression({ pending, last }: CalculatorState): string {
  if (pending) {
    return `${formatNumber(pending.left)} ${OPERATOR_SYMBOLS[pending.operator]}`
  }
  return last ? `${describeCalculation(last)} =` : ''
}
