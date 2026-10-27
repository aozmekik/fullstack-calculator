import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Generates the images in docs/images for the README: `npm run screenshots`.

const imagePath = (name: string) =>
  path.join(import.meta.dirname, '..', '..', 'docs', 'images', name)

async function useTheCalculator(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('0')
  for (const keys of ['1250*8%=', '200+15%=', '2^10=', '0.1+0.2=']) {
    await page.keyboard.type(keys)
  }
  await expect(page.getByRole('status')).toHaveText('0.3')
}

const shots = [
  {
    name: 'calculator-light.png',
    colorScheme: 'light',
    width: 1000,
    height: 820,
  },
  {
    name: 'calculator-dark.png',
    colorScheme: 'dark',
    width: 1000,
    height: 820,
  },
  {
    name: 'calculator-mobile.png',
    colorScheme: 'light',
    width: 390,
    height: 844,
  },
] as const

for (const { name, colorScheme, width, height } of shots) {
  test.describe(name, () => {
    test.use({
      colorScheme,
      reducedMotion: 'reduce',
      viewport: { width, height },
      deviceScaleFactor: 2,
    })

    test('capture', async ({ page }) => {
      await useTheCalculator(page)
      await page.screenshot({ path: imagePath(name) })
    })
  })
}
