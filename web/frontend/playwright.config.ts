import { defineConfig } from '@playwright/test';

const demoUrl = 'http://127.0.0.1:4173/everyup/demo/';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // ubuntu-latest has 4 vCPUs for public repositories.
  workers: process.env.CI ? 4 : undefined,
  reporter: 'list',
  use: {
    baseURL: demoUrl,
    screenshot: 'only-on-failure',
    // Retries still record evidence; passing tests no longer pay for tracing.
    trace: 'on-first-retry',
  },
  webServer: [{
    command: 'pnpm exec vite preview --mode demo --host 127.0.0.1 --port 4173',
    url: demoUrl,
    reuseExistingServer: !process.env.CI,
  }, {
    // Exercise real HTTP failure/recovery without changing the demo fixtures.
    command: 'pnpm exec vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/',
    env: {
      VITE_USE_MOCK: 'false',
      VITE_DEMO_MODE: 'true',
      VITE_API_BASE_URL: '/api/v1',
      VITE_BASE_PATH: '/',
    },
    reuseExistingServer: !process.env.CI,
  }],
});
