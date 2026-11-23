import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stubBrownrice } from './stub.js';
import { stubSnow, snowBody, PARSED, REPORT_URL } from './snow-stub.js';

// Card #16: the snow numbers, update text and forecast on the page. The oracle is PARSED: what the
// Worker's own parser reads from the saved resort pages (tests/fixtures/), sent through the real
// Pages Function by snow-stub.js.
const IDS = ['northstar', 'heavenly', 'kirkwood'];
const NAMES = { northstar: 'Northstar', heavenly: 'Heavenly', kirkwood: 'Kirkwood' };
const KEYS = ['twentyFourHourInches', 'fortyEightHourInches', 'sevenDayInches', 'baseDepthInches', 'seasonTotalInches'];
const LABELS = ['24 h', '48 h', '7 days', 'Base', 'Season'];
const CAMS_PAGE = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../../site/cams.json', import.meta.url), 'utf8')).resorts.map((r) => [r.id, r.camsPage]));
const dash = (v) => (v === null || v === undefined ? '–' : String(v));

// Where a resort's numbers are in each view.
const panel = (page, view, id) => (view === 'home'
  ? page.locator(`section.resort[data-resort="${id}"] .numbers`)
  : page.locator('.resort-info .numbers'));
const goto = (page, view) => page.goto(view === 'home' ? '/' : `/#${view}`);

// Everything a resort's panel must show when its numbers are there.
async function expectNumbers(p, id) {
  const { report, forecast } = PARSED[id];
  await expect(p.locator('[data-stat]')).toHaveCount(5);
  for (let i = 0; i < KEYS.length; i++) {
    const stat = p.locator(`[data-stat="${KEYS[i]}"]`);
    await expect(stat).toBeVisible();
    await expect(stat.locator('dt')).toHaveText(LABELS[i]);
    await expect(stat.locator('dd')).toHaveText(`${dash(report[KEYS[i]])} in`);
  }
  await expect(p.getByText(report.lastUpdatedText, { exact: true })).toBeVisible();
  const rows = p.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  expect(await rows.evaluateAll((trs) => trs.map((tr) => tr.dataset.date))).toEqual(forecast.map((d) => d.date));
  for (const d of forecast) {
    const cells = p.locator(`tr[data-date="${d.date}"] > *`);
    // Day name, high, low, day snow, night snow; snow text as the resort gives it ("0-1").
    const want = [null, `${dash(d.highF)}°`, `${dash(d.lowF)}°`, dash(d.snowDayInches), dash(d.snowNightInches)];
    const got = await cells.allInnerTexts();
    expect(got).toHaveLength(5);
    expect(got.slice(1)).toEqual(want.slice(1));
    expect(got[0]).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  }
  await expect(p.locator('thead')).toContainText('High');
  await expect(p.locator('thead')).toContainText('Low');
}

test.beforeEach(async ({ page }) => {
  await stubBrownrice(page);
});

for (const view of ['home', ...IDS]) {
  test(`${view === 'home' ? 'home' : `the ${view} view`} shows the five numbers, update text and forecast`, async ({ page }) => {
    await stubSnow(page);
    await goto(page, view);
    for (const id of view === 'home' ? IDS : [view]) await expectNumbers(panel(page, view, id), id);
    // The resort view shows only that resort's numbers.
    if (view !== 'home') await expect(page.locator('.numbers')).toHaveCount(1);
  });
}

test('the forecast days are named in order from the first date', async ({ page }) => {
  await stubSnow(page);
  await page.goto('/');
  // The saved pages start on Monday 2026-11-23.
  const days = await panel(page, 'home', 'northstar').locator('tbody tr > :first-child').allInnerTexts();
  expect(days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
});

test('every resort says when we fetched its numbers, in Pacific time', async ({ page }) => {
  await stubSnow(page);
  for (const view of ['home', ...IDS]) {
    await goto(page, view);
    for (const id of view === 'home' ? IDS : [view]) {
      // snow-stub's "ok" copy was fetched 30 minutes before 10:00 UTC on Monday 2026-11-23.
      await expect(panel(page, view, id).locator('.fetched')).toHaveText('Fetched Mon Nov 23, 1:30 AM PST');
    }
  }
});

test('old numbers the Worker is refreshing show their fetch time and "refreshing"', async ({ page }) => {
  await stubSnow(page, { body: await snowBody({ heavenly: 'refreshing' }) });
  for (const view of ['home', 'heavenly', 'northstar']) {
    await goto(page, view);
    if (view !== 'northstar') {
      const p = panel(page, view, 'heavenly');
      await expect(p.locator('.fetched')).toContainText('Fetched Sun Nov 22, 11:00 PM PST');
      await expect(p.locator('.fetched')).toContainText('refreshing');
      await expectNumbers(p, 'heavenly');
    }
    if (view !== 'heavenly') await expect(panel(page, view, 'northstar').locator('.fetched')).not.toContainText('refreshing');
  }
});

test('a stale resort says "stale" in words and keeps its numbers; the others don\'t', async ({ page }) => {
  await stubSnow(page, { body: await snowBody({ kirkwood: 'stale' }) });
  await page.goto('/');
  const k = panel(page, 'home', 'kirkwood');
  await expect(k.locator('.flag')).toBeVisible();
  await expect(k.locator('.flag')).toContainText(/stale/i);
  // The stale copy was fetched 7 hours before 10:00 UTC on Monday: 7:00 PM Sunday, Pacific.
  await expect(k.locator('.flag')).toContainText('Sun Nov 22, 7:00 PM PST');
  await expectNumbers(k, 'kirkwood');
  for (const id of ['northstar', 'heavenly']) {
    await expect(panel(page, 'home', id)).not.toContainText(/stale/i);
    await expectNumbers(panel(page, 'home', id), id);
  }
  await page.goto('/#kirkwood');
  await expect(panel(page, 'kirkwood', 'kirkwood').locator('.flag')).toContainText(/stale/i);
});

test('a resort with no numbers says "not available" and links to its snow report; the others are unaffected', async ({ page }) => {
  await stubSnow(page, { body: await snowBody({ northstar: 'not-available' }) });
  for (const view of ['home', 'northstar']) {
    await goto(page, view);
    const p = panel(page, view, 'northstar');
    await expect(p.getByText(/not available/i)).toBeVisible();
    await expect(p.getByRole('link', { name: /Northstar's snow report/ })).toHaveAttribute('href', REPORT_URL.northstar);
    await expect(p.locator('[data-stat]')).toHaveCount(0);
    await expect(p.locator('table')).toHaveCount(0);
  }
  await page.goto('/');
  for (const id of ['heavenly', 'kirkwood']) {
    await expect(panel(page, 'home', id)).not.toContainText(/not available/i);
    await expectNumbers(panel(page, 'home', id), id);
  }
});

test('if /api/snow fails, every resort says "not available", links to its own page, and the cams still play', async ({ page }) => {
  await stubSnow(page, { status: 500 });
  await page.goto('/');
  for (const id of IDS) {
    const p = panel(page, 'home', id);
    await expect(p.getByText(/not available/i)).toBeVisible();
    await expect(p.locator('[data-stat]')).toHaveCount(0);
    // With no /api/snow answer there is no reportUrl, so the link is the resort's page from cams.json.
    await expect(p.getByRole('link', { name: `See ${NAMES[id]}'s own page` })).toHaveAttribute('href', CAMS_PAGE[id]);
  }
  await expect(page.locator('iframe')).toHaveCount(3);
  await page.goto('/#heavenly');
  const h = panel(page, 'heavenly', 'heavenly');
  await expect(h.getByText(/not available/i)).toBeVisible();
  await expect(h.getByRole('link', { name: "See Heavenly's own page" })).toHaveAttribute('href', CAMS_PAGE.heavenly);
});

test('the numbers stay right when switching views back and forth', async ({ page }) => {
  await stubSnow(page, { body: await snowBody({ kirkwood: 'not-available' }) });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Resorts' });
  for (const id of ['northstar', 'kirkwood', 'heavenly', 'northstar']) {
    await nav.getByRole('link', { name: NAMES[id], exact: true }).click();
    const p = panel(page, id, id);
    if (id === 'kirkwood') await expect(p.getByText(/not available/i)).toBeVisible();
    else await expectNumbers(p, id);
    await nav.getByRole('link', { name: 'All resorts', exact: true }).click();
    await expectNumbers(panel(page, 'home', 'heavenly'), 'heavenly');
  }
});

test('the numbers fit their panel: nothing is cut off or scrolls sideways @width', async ({ page }) => {
  await stubSnow(page, { body: await snowBody({ heavenly: 'stale', kirkwood: 'refreshing' }) });
  for (const view of ['home', ...IDS]) {
    await goto(page, view);
    await expect(page.locator('[data-stat]').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${view}: page scrolls sideways`).toBeLessThanOrEqual(0);
    // Every numbers panel, and each table in it, is no wider than its box.
    const cut = await page.locator('.numbers, .numbers table, .numbers dl').evaluateAll((els) => els
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${e.tagName}.${e.className}`));
    expect(cut, `${view}: cut off`).toEqual([]);
  }
});
