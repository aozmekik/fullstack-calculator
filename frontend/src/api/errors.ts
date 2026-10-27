/**
 * The API answered with an error. `code` is the stable, machine-readable code
 * from the error body, such as `division_by_zero`, or `unexpected_response`
 * when the body was not the documented shape.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type NetworkFailure = 'timeout' | 'unreachable'

/** The API did not answer: it was unreachable, or too slow. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError'
  readonly reason: NetworkFailure

  constructor(reason: NetworkFailure, options?: ErrorOptions) {
    super(
      reason === 'timeout'
        ? 'The calculator service did not respond in time'
        : 'The calculator service is unreachable',
      options,
    )
    this.reason = reason
  }
}
