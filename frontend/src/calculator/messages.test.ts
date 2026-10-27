import { describe, expect, it } from 'vitest'
import { ApiError, NetworkError } from '../api/errors'
import { errorMessage } from './messages'

describe('errorMessage', () => {
  it.each([
    [
      'division by zero',
      new ApiError(422, 'division_by_zero', 'x'),
      "Can't divide by zero",
    ],
    [
      'no real result',
      new ApiError(422, 'not_a_real_number', 'x'),
      'Not a real number',
    ],
    [
      'overflow',
      new ApiError(422, 'result_out_of_range', 'x'),
      'Result is too large',
    ],
    [
      'a server error',
      new ApiError(500, 'internal_error', 'x'),
      'The calculator service had a problem. Try again.',
    ],
    [
      'an unknown client error',
      new ApiError(400, 'invalid_request', 'x'),
      'Something went wrong. Try again.',
    ],
    [
      'a timeout',
      new NetworkError('timeout'),
      'The calculator service is taking too long. Try again.',
    ],
    [
      'no connection',
      new NetworkError('unreachable'),
      "Can't reach the calculator service. Check your connection.",
    ],
    ['anything else', new Error('boom'), 'Something went wrong. Try again.'],
  ])('explains %s', (_case, error, expected) => {
    expect(errorMessage(error)).toBe(expected)
  })
})
