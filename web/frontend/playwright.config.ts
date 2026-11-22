import { defineConfig } from '@playwright/test';

import { API_PORT, API_URL, DEMO_PORT } from './e2e/fixtures/ports';

const demoUrl = `http://127.0.0.1:${DEMO_PORT}/everyup/demo/`;

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
    // Keep the trace of every failure, including local runs without retries, so a one-off
    // failure under load can be explained instead of rerun away. Passing tests keep nothing.
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: `pnpm exec vite preview --mode demo --host 127.0.0.1 --port ${DEMO_PORT}`,
    url: demoUrl,
    reuseExistingServer: !process.env.CI,
  }, {
    // Exercise real HTTP failure/recovery without changing the demo fixtures.
    command: `pnpm exec vite --host 127.0.0.1 --port ${API_PORT} --strictPort`,
    url: API_URL,
    env: {
      VITE_USE_MOCK: 'false',
      VITE_DEMO_MODE: 'true',
      VITE_API_BASE_URL: '/api/v1',
      VITE_BASE_PATH: '/',
    },
    reuseExistingServer: !process.env.CI,
  }],
});
