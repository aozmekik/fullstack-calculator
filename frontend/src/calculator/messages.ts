import { ApiError, NetworkError } from '../api/errors'

/**
 * Turns a failed calculation into short copy for the display. Known API codes
 * get their own wording; the API's messages are written for developers.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'division_by_zero':
        return "Can't divide by zero"
      case 'not_a_real_number':
        return 'Not a real number'
      case 'result_out_of_range':
        return 'Result is too large'
    }
    return error.status >= 500
      ? 'The calculator service had a problem. Try again.'
      : 'Something went wrong. Try again.'
  }
  if (error instanceof NetworkError) {
    return error.reason === 'timeout'
      ? 'The calculator service is taking too long. Try again.'
      : "Can't reach the calculator service. Check your connection."
  }
  return 'Something went wrong. Try again.'
}
