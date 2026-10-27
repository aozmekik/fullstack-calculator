import { describe, expect, it } from 'vitest'
import {
  appendDecimalPoint,
  appendDigit,
  deleteLast,
  parsePastedNumber,
  toggleSign,
  type Digit,
} from './entry'

describe('appendDigit', () => {
  it.each<[string, Digit, string]>([
    ['0', '5', '5'],
    ['0', '0', '0'],
    ['-0', '7', '-7'],
    ['12', '3', '123'],
    ['0.', '0', '0.0'],
    ['123456789012345', '6', '123456789012345'],
    ['-12345678901234.5', '6', '-12345678901234.5'],
  ])('%s + %s → %s', (text, digit, expected) => {
    expect(appendDigit(text, digit)).toBe(expected)
  })
})

describe('appendDecimalPoint', () => {
  it.each([
    ['0', '0.'],
    ['12', '12.'],
    ['1.5', '1.5'],
  ])('%s → %s', (text, expected) => {
    expect(appendDecimalPoint(text)).toBe(expected)
  })
})

describe('toggleSign', () => {
  it.each([
    ['5', '-5'],
    ['-5', '5'],
    ['0', '-0'],
    ['0.5', '-0.5'],
  ])('%s → %s', (text, expected) => {
    expect(toggleSign(text)).toBe(expected)
  })
})

describe('deleteLast', () => {
  it.each([
    ['123', '12'],
    ['5', '0'],
    ['-5', '0'],
    ['0.', '0'],
    ['-1.5', '-1.'],
  ])('%s → %s', (text, expected) => {
    expect(deleteLast(text)).toBe(expected)
  })
})

describe('parsePastedNumber', () => {
  it.each([
    [' 42 ', '42'],
    ['-3.5', '-3.5'],
    ['+7', '7'],
    ['.5', '0.5'],
    ['-.5', '-0.5'],
    ['007', '7'],
    ['12.', '12.'],
    ['123456789012345', '123456789012345'],
  ])('accepts %j as %s', (raw, expected) => {
    expect(parsePastedNumber(raw)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    '.',
    '-',
    '--1',
    '1e3',
    '0x10',
    'Infinity',
    'NaN',
    '1,234',
    '1.2.3',
    '12 34',
    'twelve',
    '1234567890123456',
  ])('rejects %j', (raw) => {
    expect(parsePastedNumber(raw)).toBeNull()
  })
})
