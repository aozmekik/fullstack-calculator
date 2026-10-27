import type { Operation } from '../api/types'

/**
 * Binary operations that have a key of their own. Percentage is reached
 * through the contextual % key instead, and √ is unary.
 */
export type Operator = Exclude<Operation, 'sqrt' | 'percentage'>

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
}
