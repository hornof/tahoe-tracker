import { test, expect } from '@playwright/test';

test('the page loads with its title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Tahoe Tracker');
  await expect(page.getByRole('heading', { name: 'Tahoe Tracker' })).toBeVisible();
});

test('nothing scrolls sideways @width', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
