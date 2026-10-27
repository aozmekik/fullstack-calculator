/** Operations the calculator API exposes, one endpoint each. */
export type Operation =
  'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage'

/** A completed calculation, as returned by `POST /api/v1/{operation}`. */
export interface Calculation {
  operation: Operation
  operands: number[]
  result: number
}

/** The body of every API error response. */
export interface ErrorResponse {
  error: { code: string; message: string }
}
