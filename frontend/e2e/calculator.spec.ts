import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const display = (page: Page) => page.getByRole('status')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // The page has loaded, but React may not have rendered yet. Once the
  // display shows, the keyboard listener is attached too.
  await expect(display(page)).toHaveText('0')
})

test('calculates through the real API', async ({ page }) => {
  const keypad = page.getByRole('group', { name: 'Keypad' })

  for (const name of ['1', '2', 'Add', '7', 'Equals']) {
    await keypad.getByRole('button', { name, exact: true }).click()
  }

  await expect(display(page)).toHaveText('19')
  await expect(page.getByRole('button', { name: '12 + 7 = 19' })).toBeVisible()
})

test('rounds away binary floating-point noise', async ({ page }) => {
  await page.keyboard.type('0.1+0.2=')

  await expect(display(page)).toHaveText('0.3')
})

test('keeps every key when typing faster than the API answers', async ({
  page,
}) => {
  await page.keyboard.type('2+3*4=')

  await expect(display(page)).toHaveText('20')
})

test('explains division by zero and keeps the input', async ({ page }) => {
  await page.keyboard.type('5/0=')
  await expect(page.getByRole('alert')).toHaveText("Can't divide by zero")

  await page.keyboard.type('2=')
  await expect(display(page)).toHaveText('2.5')
  await expect(page.getByRole('alert')).toBeEmpty()
})

test('fits a long result on one line', async ({ page }) => {
  await page.keyboard.type('2^50=')
  await expect(display(page)).toHaveText('1,125,899,906,842,624')

  const { height, lineHeight, overflows } = await display(page).evaluate(
    (output) => ({
      height: output.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(output).lineHeight),
      overflows: document.documentElement.scrollWidth > window.innerWidth,
    }),
  )
  expect(height).toBeLessThan(lineHeight * 1.5)
  expect(overflows).toBe(false)
})

test('has no detectable accessibility violations', async ({ page }) => {
  // Without transitions, colours are final when axe measures contrast.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.keyboard.type('12+7=')
  await expect(display(page)).toHaveText('19')

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(violations, `${colorScheme} theme`).toEqual([])
  }
})

test('serves the app and the API from one origin, locked down', async ({
  page,
  request,
}) => {
  const app = await request.get('/')
  expect(app.headers()['content-security-policy']).toContain(
    "default-src 'self'",
  )

  const failure = await request.post('/api/v1/divide', {
    data: { operands: [1, 0] },
  })
  expect(failure.status()).toBe(422)
  expect(await failure.json()).toEqual({
    error: { code: 'division_by_zero', message: 'division by zero' },
  })

  // The app itself ran under that policy without errors.
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.reload()
  await expect(display(page)).toHaveText('0')
  expect(errors).toEqual([])
})
