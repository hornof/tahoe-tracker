import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stubBrownrice } from './stub.js';
import { stubSnow } from './snow-stub.js';

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
  // Card #16: every check here, the layout ones included, runs with the snow numbers on the page.
  await stubSnow(page);
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

// Card #22, items 1 and 2: the intro as agreed, and the three home cams that autoplay.
test('home intro text and the three home cams are the agreed ones', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.intro')).toHaveText(
    "Live webcams embedded from the resorts' camera feeds, plus snow numbers and forecasts a worker pulls from each resort's report every hour.");
  const want = { northstar: 'Mid Mountain', heavenly: 'Top of Dipper', kirkwood: 'Cornice' };
  for (const [id, name] of Object.entries(want)) {
    await expect(page.locator(`section.resort[data-resort="${id}"] .cam-bar .cam-name`)).toHaveText(name);
  }
  // And Mid Mountain is the big cam when Northstar's view opens.
  await page.goto('/#northstar');
  await expect(page.locator('.big .big-name')).toHaveText('Northstar · Mid Mountain');
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
  await stubSnow(page); // so the only "not available" here is the cam's
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
    await page.locator('[data-stat]').first().waitFor();
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
      const [big] = await boxes(page.locator('.big'));
      const [spot] = await boxes(page.locator('.big .spot'));
      const [info] = await boxes(page.locator('.resort-info'));
      const [tiles] = await boxes(page.locator('.tiles'));
      const right = (b) => b.x + b.width;
      const bottom = (b) => b.y + b.height;
      // Every cam, big and tiles, keeps the 16:9 shape.
      for (const s of await boxes(page.locator('.spot'))) expect(Math.abs(s.width / s.height - 16 / 9)).toBeLessThan(0.02);
      if (narrow) {
        // Phone, unchanged by layout 2: stacked. The big cam spans the column with the tile row on the
        // same left and right edges below it (card #22, item 5), the numbers panel below the tiles.
        expect(big.width).toBeGreaterThan(page.viewportSize().width - 40);
        expect(Math.abs(spot.x - tiles.x), 'big cam left = tile row left').toBeLessThan(1);
        expect(Math.abs(right(spot) - right(tiles)), 'big cam right = tile row right').toBeLessThan(1);
        expect(tiles.y).toBeGreaterThanOrEqual(bottom(big));
        expect(info.y).toBeGreaterThanOrEqual(bottom(tiles));
      } else {
        // Laptop: layout 2 (its sizes are checked in "layout 2" below). The panel is right of the big
        // cam, the tiles a row below both.
        expect(info.x, 'panel right of the big cam').toBeGreaterThanOrEqual(right(spot));
        expect(tiles.y).toBeGreaterThanOrEqual(Math.max(bottom(big), bottom(info)));
      }
    }
  });
}

// Layout 2 (card #22, mockup "Resort view sizes"; it replaces Decision 4's 360px panel). Agreed on a
// 1440 x 785 window: big cam 720 x 405, the panel 20px to its right, 400 wide and exactly as tall as the
// cam with tops aligned, the five numbers in one row, the spare height in the forecast rows; the other
// cams 370 wide, 14px apart; both rows centered on the page. Every size scales with the window
// (Decision 5 a): s = window width / 1440.
const AGREED = { cam: 720, gap: 20, panel: 400, tile: 370, tileGap: 14 };

async function layout2(page) {
  return page.evaluate(() => {
    const box = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
    const q = (s) => box(document.querySelector(s));
    const all = (s) => [...document.querySelectorAll(s)].map(box);
    const info = document.querySelector('.resort-info');
    const style = getComputedStyle(info);
    // The lowest bottom edge of anything inside the panel, and the panel's inner bottom edge.
    const contentBottom = Math.max(...[...info.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom));
    const innerBottom = info.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      spot: q('.big .spot'),
      info: q('.resort-info'),
      tiles: all('.tile .spot'),
      stats: all('.resort-info [data-stat]'),
      statsCut: [...document.querySelectorAll('.resort-info [data-stat] dd, .resort-info dl.stats')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      rows: all('.resort-info tbody tr'),
      contentBottom,
      innerBottom,
      // The space between each part of the panel and the next, top to bottom, and the space the CSS asks
      // for there. Less space than asked means the content is taller than the panel and got squeezed.
      squeeze: (() => {
        const parts = [...info.querySelectorAll('.numbers > *'), ...info.querySelectorAll(':scope > a')]
          .filter((e) => e.getClientRects().length > 0);
        const out = [];
        for (let i = 1; i < parts.length; i++) {
          const parent = parts[i].parentElement;
          const want = parseFloat(getComputedStyle(parent).rowGap) || 0;
          const got = parts[i].getBoundingClientRect().top - parts[i - 1].getBoundingClientRect().bottom;
          if (got < want - 0.5) out.push(`${parts[i].tagName}.${parts[i].className}: ${got.toFixed(1)}px space, want ${want}px`);
        }
        return out;
      })(),
    };
  });
}

function expectLayout2(m, label) {
  const s = m.width / 1440;
  const near = (got, want, what) => expect(Math.abs(got - want), `${label}: ${what} (got ${got}, want ${want})`).toBeLessThan(1);
  const right = (b) => b.x + b.width;
  const mid = (a, b) => (a + b) / 2;
  expect(m.scrollWidth, `${label}: no sideways scroll`).toBeLessThanOrEqual(m.width);
  // Top row: big cam, gap, panel.
  near(m.spot.width, AGREED.cam * s, 'big cam width');
  near(m.spot.height, m.spot.width * 9 / 16, 'big cam 16:9');
  near(m.info.x - right(m.spot), AGREED.gap * s, 'gap between cam and panel');
  near(m.info.width, AGREED.panel * s, 'panel width');
  near(m.info.height, m.spot.height, 'panel as tall as the big cam');
  near(m.info.y, m.spot.y, 'panel top = big cam top');
  near(mid(m.spot.x, right(m.info)), m.width / 2, 'top row centered');
  // The five numbers in one row, none cut off.
  expect(m.stats, `${label}: five numbers`).toHaveLength(5);
  for (const st of m.stats) near(st.y, m.stats[0].y, 'numbers in one row');
  for (let i = 1; i < m.stats.length; i++) expect(m.stats[i].x, `${label}: numbers left to right`).toBeGreaterThan(m.stats[i - 1].x);
  expect(m.statsCut, `${label}: numbers cut off`).toBe(0);
  // The spare height is in the forecast rows: they are all the same height, and the panel's content
  // reaches its bottom edge, with no gap below and nothing spilling out.
  expect(m.rows).toHaveLength(5);
  for (const r of m.rows) near(r.height, m.rows[0].height, 'forecast rows the same height');
  near(m.contentBottom, m.innerBottom, 'panel content ends at the panel bottom');
  expect(m.squeeze, `${label}: panel content fits without squeezing`).toEqual([]);
  // Tile row: below the top row, each 370 wide (16:9), 14 apart, centered.
  const t = m.tiles;
  expect(t.length).toBeGreaterThan(0);
  for (const x of t) {
    near(x.width, AGREED.tile * s, 'tile width');
    near(x.height, x.width * 9 / 16, 'tile 16:9');
    near(x.y, t[0].y, 'tiles in one row');
    expect(x.y, `${label}: tiles below the top row`).toBeGreaterThan(m.spot.y + m.spot.height);
  }
  for (let i = 1; i < t.length; i++) near(t[i].x - right(t[i - 1]), AGREED.tileGap * s, 'gap between tiles');
  near(mid(t[0].x, right(t[t.length - 1])), m.width / 2, 'tile row centered');
}

test('layout 2: the agreed sizes at 1440, scaled at 1280 and 1920', async ({ page }) => {
  for (const id of RESORTS.map((r) => r.id)) {
    const seen = {};
    for (const [w, h] of [[1440, 785], [1280, 800], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/#${id}`);
      await page.locator('[data-stat]').first().waitFor();
      const m = await layout2(page);
      expectLayout2(m, `${id} @${w}`);
      seen[w] = m;
    }
    // At exactly 1440 the sizes are the agreed ones, to the pixel.
    expect(seen[1440].spot.width).toBeCloseTo(720, 0);
    expect(seen[1440].spot.height).toBeCloseTo(405, 0);
    expect(seen[1440].info.width).toBeCloseTo(400, 0);
    expect(seen[1440].info.height).toBeCloseTo(405, 0);
    // Same proportions at every width: each size at 1280 and 1920 is the 1440 size times the width ratio.
    for (const w of [1280, 1920]) {
      const k = seen[w].width / seen[1440].width;
      for (const part of ['spot', 'info']) {
        for (const dim of ['width', 'height']) {
          expect(Math.abs(seen[w][part][dim] - seen[1440][part][dim] * k), `${id}: ${part} ${dim} @${w} scales`).toBeLessThan(1);
        }
      }
      expect(Math.abs(seen[w].tiles[0].width - seen[1440].tiles[0].width * k), `${id}: tile @${w} scales`).toBeLessThan(1);
    }
  }
});
