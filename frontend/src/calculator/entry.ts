// Editing rules for the number being typed. Entries are kept as text, so that
// "0.", "-0" and trailing zeros survive until the user finishes typing.

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/** The most digits a number may have: float64 represents 15 exactly. */
export const MAX_DIGITS = 15

export function appendDigit(text: string, digit: Digit): string {
  if (countDigits(text) >= MAX_DIGITS) return text
  if (text === '0') return digit
  if (text === '-0') return `-${digit}`
  return text + digit
}

export function appendDecimalPoint(text: string): string {
  return text.includes('.') ? text : `${text}.`
}

export function toggleSign(text: string): string {
  return text.startsWith('-') ? text.slice(1) : `-${text}`
}

export function deleteLast(text: string): string {
  const rest = text.slice(0, -1)
  return rest === '' || rest === '-' ? '0' : rest
}

// An optional sign, then digits with an optional fraction, or just a fraction.
// Exponents, hex, Infinity and thousands separators are rejected: "1,234"
// means different numbers in different locales.
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/

/**
 * Turns pasted text into entry text, or returns null if it is not a plain
 * number of at most MAX_DIGITS digits.
 */
export function parsePastedNumber(raw: string): string | null {
  const text = raw.trim()
  if (!PLAIN_NUMBER.test(text) || countDigits(text) > MAX_DIGITS) return null
  return text
    .replace(/^\+/, '')
    .replace(/^(-?)\./, '$10.') // ".5" → "0.5"
    .replace(/^(-?)0+(?=\d)/, '$1') // "007" → "7"
}

function countDigits(text: string): number {
  return text.replace(/\D/g, '').length
}
