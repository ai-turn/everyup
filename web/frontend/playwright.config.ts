import { defineConfig } from '@playwright/test';

const demoUrl = 'http://127.0.0.1:4173/everyup/demo/';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: demoUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite preview --mode demo --host 127.0.0.1 --port 4173',
    url: demoUrl,
    reuseExistingServer: !process.env.CI,
  },
});
