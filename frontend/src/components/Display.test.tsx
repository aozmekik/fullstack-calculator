import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Display } from './Display'

describe('Display', () => {
  it.each([
    ['1,024', 'large'],
    ['1,234,567', 'large'],
    ['123,456,789', 'medium'],
    ['1,234,567,890', 'medium'],
    ['12,345,678,901', 'small'],
    ['-12,345,678,901.5', 'small'],
    ['123,456,789,012,345', 'tiny'],
    ['-9,007,199,254,740,991', 'tiny'],
  ])('sizes %s as %s so that it fits', (value, size) => {
    render(<Display value={value} expression="" error={null} busy={false} />)

    expect(screen.getByRole('status')).toHaveAttribute('data-size', size)
  })

  it('announces errors and marks itself busy while calculating', () => {
    render(
      <Display value="0" expression="5 ÷" error="Can't divide by zero" busy />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent("Can't divide by zero")
    expect(screen.getByRole('status').parentElement).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })
})
