import { vi } from 'vitest'
import type { CalculatorClient } from '../api/client'
import { ApiError } from '../api/errors'
import type { Calculation, Operation } from '../api/types'

/**
 * Answers a calculation the way the Go API would (minus its rounding), so
 * that tests read like real use. Throws ApiError where the API returns 422.
 */
export function compute(
  operation: Operation,
  operands: readonly number[],
): Calculation {
  const [a = 0, b = 0] = operands
  if (operation === 'divide' && b === 0) {
    throw new ApiError(422, 'division_by_zero', 'division by zero')
  }
  if (operation === 'sqrt' && a < 0) {
    throw new ApiError(422, 'not_a_real_number', 'result is not a real number')
  }
  const results: Record<Operation, number> = {
    add: a + b,
    subtract: a - b,
    multiply: a * b,
    divide: a / b,
    power: a ** b,
    sqrt: Math.sqrt(a),
    percentage: (a / 100) * b,
  }
  return { operation, operands: [...operands], result: results[operation] }
}

/** A client that answers right away. */
export function fakeClient() {
  return {
    calculate: vi.fn<CalculatorClient['calculate']>(
      async (operation, operands) => compute(operation, operands),
    ),
  }
}

/**
 * A client that holds every answer until `release` is called, and rejects
 * with the abort reason when a request is canceled, like fetch does.
 */
export function heldClient() {
  const held: Array<() => void> = []
  const client = {
    calculate: vi.fn<CalculatorClient['calculate']>(
      (operation, operands, options) =>
        new Promise<Calculation>((resolve, reject) => {
          const signal = options?.signal
          signal?.addEventListener('abort', () => reject(signal.reason))
          held.push(() => {
            try {
              resolve(compute(operation, operands))
            } catch (error) {
              reject(error)
            }
          })
        }),
    ),
  }
  return {
    client,
    release: () => {
      for (const answer of held.splice(0)) answer()
    },
  }
}
