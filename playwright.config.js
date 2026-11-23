import { defineConfig, devices } from '@playwright/test';

// Laptop first (PRD requirement 6). Tests whose name contains "@width" run at all three widths;
// everything else runs at 1280 px only (TDD, test plan).
const width = (name, w, h) => ({ name, use: { ...devices['Desktop Chrome'], viewport: { width: w, height: h } } });

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:8788' },
  webServer: {
    command: 'python3 -m http.server 8788 --bind 127.0.0.1 --directory site',
    url: 'http://127.0.0.1:8788',
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    width('chromium-1280', 1280, 800),
    { ...width('chromium-1920', 1920, 1080), grep: /@width/ },
    { ...width('chromium-390', 390, 844), grep: /@width/ },
  ],
});
