import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the real Go server serving the production
// build, which is exactly what the Docker image ships.
const port = 8090
const baseURL = `http://127.0.0.1:${port}`
const inCI = Boolean(process.env.CI)

// The three browser engines, plus a phone of each mobile platform.
const browsers = {
  chromium: devices['Desktop Chrome'],
  webkit: devices['Desktop Safari'],
  'mobile-chrome': devices['Pixel 7'],
  'mobile-safari': devices['iPhone 15'],
  // Playwright's Firefox build does not start on macOS 27 ("Could not find
  // profile folder"), so it runs in CI, on Linux, where it is preinstalled.
  ...(inCI ? { firefox: devices['Desktop Firefox'] } : {}),
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  reporter: inCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    ...Object.entries(browsers).map(([name, device]) => ({
      name,
      use: device,
      testIgnore: /screenshots/,
    })),
    // Regenerates the README images; run with `npm run screenshots`.
    ...(process.env.SCREENSHOTS
      ? [{ name: 'screenshots', testMatch: /screenshots\.spec\.ts/ }]
      : []),
  ],
  webServer: {
    command: 'go build -o bin/server ./cmd/server && ./bin/server',
    cwd: '../backend',
    url: `${baseURL}/healthz`,
    env: {
      PORT: String(port),
      STATIC_DIR: '../frontend/dist',
      LOG_FORMAT: 'text',
    },
    reuseExistingServer: !inCI,
    // Exercises the server's graceful shutdown on every run.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
})
