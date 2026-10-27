import { describe, expect, it } from 'vitest'
import type { Calculation } from '../api/types'
import { describeCalculation, formatInput, formatNumber } from './format'

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [-0, '0'],
    [42, '42'],
    [-2.5, '-2.5'],
    [0.3, '0.3'],
    [0.333333333333333, '0.333333333333333'],
    [1234567.891, '1,234,567.891'],
    [2 ** 50, '1,125,899,906,842,624'],
    [2 ** 50 + 0.5, '1,125,899,906,842,625'],
    [999_999_999_999_999.4, '999,999,999,999,999'],
    [Number.MAX_SAFE_INTEGER, '9,007,199,254,740,991'],
    [2 ** 53, '9.007199255E15'],
    [1e21, '1E21'],
    [-1e21, '-1E21'],
    [0.000001, '0.000001'],
    [1.5e-7, '1.5E-7'],
    [-1e-9, '-1E-9'],
  ])('%d → %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })
})

describe('formatInput', () => {
  it.each([
    ['0', '0'],
    ['-0', '-0'],
    ['1234', '1,234'],
    ['-1234567.50', '-1,234,567.50'],
    ['12.', '12.'],
    ['0.000', '0.000'],
  ])('%s → %s', (text, expected) => {
    expect(formatInput(text)).toBe(expected)
  })
})

describe('describeCalculation', () => {
  it.each<[Calculation, string]>([
    [{ operation: 'add', operands: [12, 7], result: 19 }, '12 + 7'],
    [{ operation: 'subtract', operands: [5, -3], result: 8 }, '5 − (-3)'],
    [{ operation: 'multiply', operands: [1234, 2], result: 2468 }, '1,234 × 2'],
    [{ operation: 'divide', operands: [1, 3], result: 0.333 }, '1 ÷ 3'],
    [{ operation: 'power', operands: [2, 10], result: 1024 }, '2 ^ 10'],
    [{ operation: 'sqrt', operands: [81], result: 9 }, '√81'],
    [
      { operation: 'percentage', operands: [15, 200], result: 30 },
      '15% of 200',
    ],
    [{ operation: 'percentage', operands: [15, 1], result: 0.15 }, '15%'],
  ])('%j → %s', (calculation, expected) => {
    expect(describeCalculation(calculation)).toBe(expected)
  })
})
