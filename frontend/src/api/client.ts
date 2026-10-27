import { ApiError, NetworkError } from './errors'
import type { Calculation, ErrorResponse, Operation } from './types'

export interface CalculatorClient {
  /**
   * Asks the API to apply `operation` to `operands`. Rejects with an
   * `ApiError` or a `NetworkError`, or with the abort reason if `signal`
   * is aborted.
   */
  calculate: (
    operation: Operation,
    operands: readonly number[],
    options?: { signal?: AbortSignal },
  ) => Promise<Calculation>
}

export interface ClientOptions {
  /** Base URL of the versioned API; same-origin by default. */
  baseUrl?: string
  /** The fetch implementation, injectable for tests. */
  fetch?: typeof fetch
  /** How long to wait for an answer before giving up. */
  timeoutMs?: number
}

export function createCalculatorClient({
  baseUrl = '/api/v1',
  fetch: fetchImpl = (input, init) => fetch(input, init),
  timeoutMs = 5000,
}: ClientOptions = {}): CalculatorClient {
  return {
    async calculate(operation, operands, { signal } = {}) {
      const timeout = AbortSignal.timeout(timeoutMs)
      let response: Response
      let text: string
      try {
        response = await fetchImpl(`${baseUrl}/${operation}`, {
          method: 'POST',
          // Without an explicit type, fetch labels a string body text/plain,
          // which the API rejects with 415.
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operands }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        text = await response.text()
      } catch (error) {
        if (signal?.aborted) throw error // canceled by the caller: not a failure
        throw new NetworkError(timeout.aborted ? 'timeout' : 'unreachable', {
          cause: error,
        })
      }

      const body = parseJson(text)
      if (!response.ok) throw toApiError(response.status, body)
      if (!isCalculation(body)) {
        throw new ApiError(
          response.status,
          'unexpected_response',
          'The calculator service sent an unexpected response',
        )
      }
      return body
    },
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (isErrorResponse(body)) {
    return new ApiError(status, body.error.code, body.error.message)
  }
  return new ApiError(
    status,
    'unexpected_response',
    `The calculator service failed with HTTP ${status}`,
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCalculation(value: unknown): value is Calculation {
  return (
    isRecord(value) &&
    typeof value.operation === 'string' &&
    Array.isArray(value.operands) &&
    value.operands.every((operand) => typeof operand === 'number') &&
    typeof value.result === 'number'
  )
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}
