import { defineConfig, devices } from '@playwright/test'

// Configuração E2E dos convites/inscrições. Arranca a app Express (staging DB +
// dist compilado) via webServer e corre os testes em série (BD partilhada).
const PORT = process.env.E2E_PORT || '4100'
const BASE = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // BD de staging partilhada → sem paralelismo para evitar interferência entre testes.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalTeardown: './e2e/global-teardown.mjs',

  use: {
    baseURL: BASE,
    locale: 'pt-PT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'e2e',
      testMatch: /tests\/.*\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'node e2e/server.mjs',
    url: `${BASE}/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
