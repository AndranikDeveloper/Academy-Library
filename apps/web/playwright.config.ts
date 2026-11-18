import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright is configured here but intentionally not wired into CI yet.
 * It targets the Vite preview server for end-to-end coverage of real
 * user flows once there are business screens worth testing.
 */
export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
