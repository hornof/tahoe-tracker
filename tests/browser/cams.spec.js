import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stubBrownrice } from './stub.js';

// The oracle is site/cams.json itself: every check below is about the page matching the list.
const list = JSON.parse(readFileSync(new URL('../../site/cams.json', import.meta.url), 'utf8'));
const RESORTS = list.resorts.map((r) => ({ ...r, cams: list.cams.filter((c) => c.resort === r.id) }));
const EMBED = (id) => `https://player.brownrice.com/embed/${id}`;

async function srcs(locator) {
  return locator.evaluateAll((els) => els.map((e) => e.getAttribute('src')));
}

// The ids playing in the resort view: the big one first, then the tiles.
async function resortView(page) {
  const big = await srcs(page.locator('.big iframe'));
  const tiles = await srcs(page.locator('.tiles iframe'));
  return { big, tiles };
}

test.beforeEach(async ({ page }) => {
  await stubBrownrice(page);
});

test('home shows three live players, one per resort, each with its name', async ({ page }) => {
  await page.goto('/');
  const sections = page.locator('section.resort');
  await expect(sections).toHaveCount(3);
  for (const r of RESORTS) {
    const s = page.locator(`section.resort[data-resort="${r.id}"]`);
    await expect(s.getByRole('heading', { name: r.name })).toBeVisible();
    await expect(s.getByText(r.cams[0].name, { exact: true })).toBeVisible();
    await expect(s.locator('iframe')).toHaveCount(1);
    await expect(s.locator('iframe')).toHaveAttribute('src', EMBED(r.cams[0].id));
  }
  await expect(page.locator('iframe')).toHaveCount(3);
});

test('the players are clickable: nothing sits on top of any of them', async ({ page }) => {
  const check = async () => {
    const frames = page.locator('iframe');
    const n = await frames.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await frames.nth(i).scrollIntoViewIfNeeded();
      const onTop = await frames.nth(i).evaluate((f) => {
        const b = f.getBoundingClientRect();
        const pts = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.9], [0.9, 0.1], [0.1, 0.9]];
        return pts.every(([x, y]) => document.elementFromPoint(b.left + b.width * x, b.top + b.height * y) === f);
      });
      expect(onTop, `iframe ${i} is not covered`).toBe(true);
    }
  };
  await page.goto('/');
  await check();
  for (const r of RESORTS) {
    await page.goto(`/#${r.id}`);
    await expect(page.locator('.big iframe')).toHaveCount(1);
    await check();
  }
});

test('the link next to each home cam opens that resort, big cam first, the rest as tiles', async ({ page }) => {
  for (const r of RESORTS) {
    await page.goto('/');
    await page.locator(`section.resort[data-resort="${r.id}"]`).getByRole('link', { name: new RegExp(`See all ${r.cams.length} ${r.name} cams`) }).click();
    await expect(page).toHaveURL(new RegExp(`#${r.id}$`));
    await expect.poll(() => resortView(page)).toEqual({
      big: [EMBED(r.cams[0].id)],
      tiles: r.cams.slice(1).map((c) => EMBED(c.id)),
    });
    await expect(page.locator('.resort-info').getByRole('heading', { level: 2, name: r.name })).toBeVisible();
    await expect(page.locator('.big')).toContainText(r.cams[0].name);
  }
});

test('the button next to a tile makes it the big one, and every cam can be made big and back', async ({ page }) => {
  for (const r of RESORTS) {
    await page.goto(`/#${r.id}`);
    const all = r.cams.map((c) => EMBED(c.id)).sort();
    // Visit every cam as the big one, in an order that is not the list order, then go back to the first.
    const order = [...r.cams.slice(1).reverse(), r.cams[0]];
    for (const c of order) {
      await page.getByRole('button', { name: `Make ${c.name} the big cam` }).click();
      await expect.poll(async () => (await resortView(page)).big).toEqual([EMBED(c.id)]);
      const v = await resortView(page);
      // Invariants: the chosen cam is big, it is not also a tile, and big + tiles is the whole resort.
      expect(v.big).toEqual([EMBED(c.id)]);
      expect(v.tiles).not.toContain(EMBED(c.id));
      expect([...v.big, ...v.tiles].sort()).toEqual(all);
      await expect(page.locator('.big')).toContainText(c.name);
      await expect(page).toHaveURL(new RegExp(`#${r.id}/${c.id}$`));
    }
    // Back in history undoes the last swap.
    await page.goBack();
    await expect.poll(async () => (await resortView(page)).big).toEqual([EMBED(order[order.length - 2].id)]);
  }
});

test('after "Make big" the new big cam is in view and has keyboard focus', async ({ page }) => {
  for (const r of RESORTS) {
    await page.goto(`/#${r.id}`);
    for (const c of r.cams.slice(1)) {
      const button = page.getByRole('button', { name: `Make ${c.name} the big cam` });
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(page.locator('.big')).toContainText(c.name);
      await expect(page.locator('.big .big-name')).toBeFocused();
      const top = await page.locator('.big').evaluate((e) => e.getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(page.viewportSize().height / 2);
    }
  }
});

test('if the cam list fails to load, a message says so and the header and tabs stay visible', async ({ page }) => {
  await page.route('**/cams.json', (route) => route.fulfill({ status: 500, body: 'oops' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText("cam list didn't load");
  const nav = page.getByRole('navigation', { name: 'Resorts' });
  for (const name of ['All resorts', ...RESORTS.map((r) => r.name)]) {
    const tab = nav.getByRole('link', { name, exact: true });
    await expect(tab).toBeVisible();
    // Nothing covers the tab: the element at its centre is the tab itself.
    const onTop = await tab.evaluate((t) => {
      const b = t.getBoundingClientRect();
      return t.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2));
    });
    expect(onTop, `${name} tab is not covered`).toBe(true);
  }
  const h1 = page.getByRole('heading', { level: 1, name: 'Tahoe Tracker' });
  expect(await h1.evaluate((h) => {
    const b = h.getBoundingClientRect();
    return h.contains(document.elementFromPoint(b.left + 5, b.top + b.height / 2));
  })).toBe(true);
});

test('tabs switch resorts and go home, and mark the current one', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Resorts' });
  await expect(nav.getByRole('link', { name: 'All resorts' })).toHaveAttribute('aria-current', 'page');
  // Every tab from every view, so both directions (resort to resort, resort to home, home to resort) are covered.
  const tabs = [{ id: 'home', name: 'All resorts' }, ...RESORTS.map((r) => ({ id: r.id, name: r.name }))];
  for (const from of tabs) {
    for (const to of tabs) {
      await nav.getByRole('link', { name: from.name, exact: true }).click();
      await nav.getByRole('link', { name: to.name, exact: true }).click();
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: to.name, exact: true })).toHaveAttribute('aria-current', 'page');
      if (to.id === 'home') {
        await expect(page.locator('section.resort')).toHaveCount(3);
        await expect(page.locator('.big')).toHaveCount(0);
      } else {
        const r = RESORTS.find((x) => x.id === to.id);
        await expect(page.locator('section.resort')).toHaveCount(0);
        await expect.poll(async () => (await resortView(page)).big).toEqual([EMBED(r.cams[0].id)]);
      }
    }
  }
});

test('a cam whose still fails shows "not available" and the resort link', async ({ page }) => {
  await page.unrouteAll();
  await stubBrownrice(page, { down: ['heavenlydipper', 'northstarsnowstake'] });
  await page.goto('/');
  const heavenly = page.locator('section.resort[data-resort="heavenly"]');
  const r = RESORTS.find((x) => x.id === 'heavenly');
  await expect(heavenly.getByText('not available')).toBeVisible();
  await expect(heavenly.locator('iframe')).toHaveCount(0);
  await expect(heavenly.getByRole('link', { name: /Heavenly's cams/ })).toHaveAttribute('href', r.camsPage);
  // The other two resorts still play.
  await expect(page.locator('iframe')).toHaveCount(2);

  // In Northstar's view the failed tile shows the placeholder; the others play.
  await page.goto('/#northstar');
  const tile = page.locator('.tile', { hasText: 'Snow Stake' });
  await expect(tile.getByText('not available')).toBeVisible();
  await expect(tile.getByRole('link', { name: /Northstar's cams/ })).toHaveAttribute('href', RESORTS[0].camsPage);
  await expect(page.locator('iframe')).toHaveCount(3);
  // Made big, it still shows the placeholder, not a player.
  await page.getByRole('button', { name: 'Make Snow Stake the big cam' }).click();
  await expect(page.locator('.big').getByText('not available')).toBeVisible();
  await expect(page.locator('.big iframe')).toHaveCount(0);
});

// Layout (PRD requirement 6): runs at 1280, 1920 and 390 px.
function overlaps(a, b) {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
}

async function boxes(locator) {
  return locator.evaluateAll((els) => els.map((e) => {
    const b = e.getBoundingClientRect();
    return { x: b.left, y: b.top + window.scrollY, width: b.width, height: b.height };
  }));
}

function expectNoOverlap(bs) {
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) expect(overlaps(bs[i], bs[j]), `boxes ${i} and ${j} overlap`).toBe(false);
  }
}

for (const view of ['', ...['northstar', 'heavenly', 'kirkwood']]) {
  test(`no sideways scroll and no overlap on ${view || 'home'} @width`, async ({ page }) => {
    await page.goto(`/#${view}`);
    await page.locator('iframe').first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const narrow = page.viewportSize().width < 600;
    if (!view) {
      const bs = await boxes(page.locator('section.resort'));
      expect(bs).toHaveLength(3);
      expectNoOverlap(bs);
      if (narrow) {
        // Stacked: one above the other, each the full width of the column.
        for (let i = 1; i < bs.length; i++) expect(bs[i].y).toBeGreaterThanOrEqual(bs[i - 1].y + bs[i - 1].height);
      } else {
        // Side by side on a laptop.
        for (let i = 1; i < bs.length; i++) expect(Math.abs(bs[i].y - bs[0].y)).toBeLessThan(1);
      }
    } else {
      const parts = await boxes(page.locator('.big, .tile, .resort-info'));
      expectNoOverlap(parts);
      const frames = await boxes(page.locator('iframe'));
      expectNoOverlap(frames);
      for (const f of frames) expect(f.width).toBeGreaterThan(narrow ? 120 : 200);
      const [cams] = await boxes(page.locator('.cams'));
      const [info] = await boxes(page.locator('.resort-info'));
      if (narrow) {
        // Stacked: the big cam spans the column, and the numbers panel sits below the cams.
        const [big] = await boxes(page.locator('.big'));
        expect(big.width).toBeGreaterThan(page.viewportSize().width - 40);
        expect(info.y).toBeGreaterThanOrEqual(cams.y + cams.height);
      } else {
        // Side by side on a laptop: the numbers panel is to the right of the cams.
        expect(info.x).toBeGreaterThanOrEqual(cams.x + cams.width);
        // Luke, Decision 8 (b): the big cam is capped by height, so the whole tile row (tiles, names
        // and "Make big" buttons) fits in the window without scrolling.
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        const [tiles] = await boxes(page.locator('.tiles'));
        const h = page.viewportSize().height;
        expect(tiles.y + tiles.height, 'tile row bottom inside the window').toBeLessThanOrEqual(h);
        for (const b of await boxes(page.locator('.tile button'))) expect(b.y + b.height).toBeLessThanOrEqual(h);
        // The big cam keeps its 16:9 shape and is centred over the tiles.
        const [spot] = await boxes(page.locator('.big .spot'));
        expect(Math.abs(spot.width / spot.height - 16 / 9)).toBeLessThan(0.02);
        expect(Math.abs((spot.x + spot.width / 2) - (cams.x + cams.width / 2))).toBeLessThan(2);
      }
    }
  });
}
