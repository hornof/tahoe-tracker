import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { stubBrownrice } from './stub.js';
import { stubSnow, snowBody } from './snow-stub.js';

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
// cams 370 wide, 14px apart; both rows centered on the page. PR #23 decisions:
// - 5 a: every size scales with the window, s = window width / 1440;
// - 6: the panel stays the cam's height; content that doesn't fit scrolls inside it, and a Stale warning
//   sits at the top, under the name and "i" row, so it is never the part scrolled off;
// - 7: layout 2 from 1000px wide; below that the phone's stacked layout;
// - 8: it stops growing once the top row is as wide as the title bar (the page's content width), so
//   s = min(window width / 1440, title bar width / 1140).
const AGREED = { cam: 720, gap: 20, panel: 400, tile: 370, tileGap: 14 };
const ROW = AGREED.cam + AGREED.gap + AGREED.panel; // 1140

async function layout2(page) {
  return page.evaluate(() => {
    const box = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
    const q = (s) => (document.querySelector(s) ? box(document.querySelector(s)) : null);
    const all = (s) => [...document.querySelectorAll(s)].map(box);
    const info = document.querySelector('.resort-info');
    const style = getComputedStyle(info);
    info.scrollTop = 0;
    // The lowest bottom edge of anything inside the panel, and the panel's inner bottom edge.
    const contentBottom = Math.max(...[...info.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom));
    const innerBottom = info.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
    return {
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      header: q('header'),
      spot: q('.big .spot'),
      info: q('.resort-info'),
      head: q('.resort-info .panel-head'),
      flag: q('.resort-info .flag'),
      overflowY: style.overflowY,
      scrollHeight: info.scrollHeight,
      clientHeight: info.clientHeight,
      // Where the panel's visible area ends: its bottom edge less its bottom border.
      visibleBottom: info.getBoundingClientRect().bottom - parseFloat(style.borderBottomWidth),
      tiles: all('.tile .spot'),
      stats: all('.resort-info [data-stat]'),
      statsCut: [...document.querySelectorAll('.resort-info [data-stat] dd, .resort-info dl.stats')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      rows: all('.resort-info tbody tr'),
      contentBottom,
      innerBottom,
    };
  });
}

const scaleOf = (m) => Math.min(m.width / 1440, m.header.width / ROW);

function expectLayout2(m, label) {
  const s = scaleOf(m);
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
  near(mid(m.header.x, right(m.header)), m.width / 2, 'title bar centered (the oracle for the page centre)');
  expect(right(m.info) - m.spot.x, `${label}: top row no wider than the title bar`).toBeLessThanOrEqual(m.header.width + 0.5);
  // The five numbers in one row, none cut off.
  expect(m.stats, `${label}: five numbers`).toHaveLength(5);
  for (const st of m.stats) near(st.y, m.stats[0].y, 'numbers in one row');
  for (let i = 1; i < m.stats.length; i++) expect(m.stats[i].x, `${label}: numbers left to right`).toBeGreaterThan(m.stats[i - 1].x);
  expect(m.statsCut, `${label}: numbers cut off`).toBe(0);
  // The forecast rows are all the same height. When the content fits, the spare height is in them: the
  // content reaches the panel's bottom edge, with no gap below. When it doesn't fit, the panel scrolls.
  expect(m.rows).toHaveLength(5);
  for (const r of m.rows) near(r.height, m.rows[0].height, 'forecast rows the same height');
  if (m.scrollHeight <= m.clientHeight + 1) near(m.contentBottom, m.innerBottom, 'panel content ends at the panel bottom');
  else expect(m.overflowY, `${label}: panel scrolls`).toBe('auto');
  // Tile row: below the top row, each 370 wide (16:9), 14 apart, centered, no wider than the title bar.
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
  expect(right(t[t.length - 1]) - t[0].x, `${label}: tile row no wider than the title bar`).toBeLessThanOrEqual(m.header.width + 0.5);
}

// A fresh load at each size. Going to the same "/#id" again is only a hash change, so the page would just
// be resized; the numbers' fit (Decision 9 b) then runs at the browser's next frame, and measuring before
// it caught them mid-resize (CI, PR #23). Two frames after the load, as a user would see it.
async function viewAt(page, id, [w, h]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('about:blank');
  await page.goto(`/#${id}`);
  await page.locator('[data-stat]').first().waitFor();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('layout 2: the agreed sizes at 1440, scaled at 1000 and 1280, capped at the title bar at 1920', async ({ page }) => {
  for (const id of RESORTS.map((r) => r.id)) {
    const seen = {};
    for (const size of [[1440, 785], [1280, 800], [1000, 700], [1920, 1080]]) {
      await viewAt(page, id, size);
      const m = await layout2(page);
      expectLayout2(m, `${id} @${size[0]}`);
      seen[size[0]] = m;
    }
    // At exactly 1440 the sizes are the agreed ones, to the pixel.
    expect(seen[1440].spot.width).toBeCloseTo(720, 0);
    expect(seen[1440].spot.height).toBeCloseTo(405, 0);
    expect(seen[1440].info.width).toBeCloseTo(400, 0);
    expect(seen[1440].info.height).toBeCloseTo(405, 0);
    // Below the cap, the same proportions: each size is the 1440 size times the window-width ratio.
    for (const w of [1000, 1280]) {
      const k = seen[w].width / seen[1440].width;
      for (const part of ['spot', 'info']) {
        for (const dim of ['width', 'height']) {
          expect(Math.abs(seen[w][part][dim] - seen[1440][part][dim] * k), `${id}: ${part} ${dim} @${w} scales`).toBeLessThan(1);
        }
      }
      expect(Math.abs(seen[w].tiles[0].width - seen[1440].tiles[0].width * k), `${id}: tile @${w} scales`).toBeLessThan(1);
    }
    // At 1920 it has stopped growing: the top row is exactly as wide as the title bar.
    const m = seen[1920];
    expect(Math.abs(m.info.x + m.info.width - m.spot.x - m.header.width), `${id}: top row = title bar width @1920`).toBeLessThan(1);
    expect(m.width / 1440, 'the cap is reached before 1920').toBeGreaterThan(m.header.width / ROW);
  }
});

test('layout 2: the panel keeps the cam\'s height and scrolls when its content is taller; Stale stays on top', async ({ page }) => {
  await page.unrouteAll();
  await stubBrownrice(page);
  await stubSnow(page, { body: await snowBody({ heavenly: 'stale' }) });
  const cases = [['heavenly', [1280, 800], false], ['heavenly', [1000, 700], false], ['northstar', [1280, 800], true], ['heavenly', [1440, 785], true]];
  for (const [id, size, openTimes] of cases) {
    const label = `${id}${openTimes ? ' with the times open' : ''} @${size[0]}`;
    await viewAt(page, id, size);
    if (openTimes) await page.locator('.resort-info .info').click();
    const m = await layout2(page);
    expectLayout2(m, label);
    // Content taller than the panel: the panel stays the cam's height and scrolls up and down.
    expect(m.scrollHeight, `${label}: content taller than the panel`).toBeGreaterThan(m.clientHeight + 1);
    expect(Math.abs(m.info.height - m.spot.height), `${label}: panel = cam height`).toBeLessThan(1);
    const info = page.locator('.resort-info');
    const scrolled = await info.evaluate((e) => { e.scrollTop = e.scrollHeight; const t = e.scrollTop; e.scrollTop = 0; return t; });
    expect(scrolled, `${label}: the panel scrolls`).toBeGreaterThan(0);
    // The bottom of the content can be scrolled into view: the cams-page link becomes visible.
    const link = info.getByRole('link', { name: /own cams page/ });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeInViewport();
    if (id === 'heavenly') {
      // The Stale warning sits right under the name and "i" row, fully visible without scrolling.
      const top = await layout2(page);
      expect(top.flag, `${label}: a Stale warning`).not.toBeNull();
      expect(top.flag.y, `${label}: Stale under the name row`).toBeGreaterThanOrEqual(top.head.y + top.head.height);
      expect(top.flag.y, `${label}: Stale above the numbers`).toBeLessThan(top.stats[0].y);
      expect(top.flag.y + top.flag.height, `${label}: Stale visible without scrolling`).toBeLessThanOrEqual(top.visibleBottom);
    }
  }
});

test('below 1000px wide the resort view is the phone\'s stacked layout; from 1000 it is layout 2', async ({ page }) => {
  const right = (b) => b.x + b.width;
  for (const id of RESORTS.map((r) => r.id)) {
    // Just below: stacked as on a phone, the big cam across the column, tiles below it on the same edges,
    // two to a row as on a phone, the numbers panel below the tiles at its natural height.
    await viewAt(page, id, [999, 700]);
    const n = await layout2(page);
    expect(n.scrollWidth, `${id} @999: no sideways scroll`).toBeLessThanOrEqual(n.width);
    const [tilesBox] = await boxes(page.locator('.tiles'));
    expect(Math.abs(n.spot.x - tilesBox.x), `${id} @999: big cam left = tile row left`).toBeLessThan(1);
    expect(Math.abs(right(n.spot) - right(tilesBox)), `${id} @999: big cam right = tile row right`).toBeLessThan(1);
    expect(Math.abs(n.info.width - n.spot.width), `${id} @999: panel as wide as the big cam`).toBeLessThan(1);
    for (const x of n.tiles) expect(x.y, `${id} @999: tiles below the big cam`).toBeGreaterThan(n.spot.y + n.spot.height);
    expect(n.info.y, `${id} @999: panel below the tiles`).toBeGreaterThan(Math.max(...n.tiles.map((x) => x.y + x.height)));
    expect(new Set(n.tiles.map((x) => Math.round(x.x))).size, `${id} @999: tiles two to a row`).toBe(Math.min(2, n.tiles.length));
    expect(n.scrollHeight, `${id} @999: panel at its natural height, no scrolling`).toBeLessThanOrEqual(n.clientHeight + 1);
    // Just above: layout 2.
    await viewAt(page, id, [1000, 700]);
    expectLayout2(await layout2(page), `${id} @1000`);
  }
});

// Decision 9 (b): layout 2 stays side by side from 1000px. Where five three-digit numbers would not fit
// across the panel, only the numbers' text gets smaller, just enough; the labels and the "in" stay as
// they are, and where the numbers fit (1440) nothing changes. Checked with the fonts of whatever machine
// runs the test (CI's Linux fonts, a Mac's), since the oracle is the page's own measurements.
const BIG = {
  'Base 120, Season 288': { baseDepthInches: 120, seasonTotalInches: 288 },
  'all five three-digit': { twentyFourHourInches: 108, fortyEightHourInches: 148, sevenDayInches: 188, baseDepthInches: 120, seasonTotalInches: 288 },
};

async function stubBig(page, values) {
  const body = await snowBody();
  for (const r of body.resorts) if (r.report) Object.assign(r.report, values);
  await page.unrouteAll();
  await stubBrownrice(page);
  await stubSnow(page, { body });
}

// Each number in the resort panel: where its text (digits and "in") starts and ends, the column it
// sits in, and the type sizes.
async function panelNumbers(page) {
  return page.locator('.resort-info [data-stat]').evaluateAll((els) => els.map((e) => {
    const dd = e.querySelector('dd');
    const range = document.createRange();
    range.selectNodeContents(dd);
    const text = range.getBoundingClientRect();
    const cell = dd.getBoundingClientRect();
    return {
      label: e.querySelector('dt').textContent,
      value: dd.textContent,
      left: text.left, right: text.right, cellLeft: cell.left, cellRight: cell.right,
      cut: dd.scrollWidth > dd.clientWidth,
      dd: parseFloat(getComputedStyle(dd).fontSize),
      dt: parseFloat(getComputedStyle(e.querySelector('dt')).fontSize),
      unit: parseFloat(getComputedStyle(dd.querySelector('.unit')).fontSize),
    };
  }));
}

function expectFit(ns, label) {
  expect(ns, label).toHaveLength(5);
  for (const n of ns) {
    expect(n.cut, `${label}: ${n.label} ${n.value} cut off`).toBe(false);
    expect(n.right, `${label}: ${n.label} ${n.value} inside its column`).toBeLessThanOrEqual(n.cellRight + 0.5);
  }
  for (let i = 1; i < ns.length; i++) {
    expect(ns[i].left, `${label}: ${ns[i - 1].value} does not touch ${ns[i].value}`).toBeGreaterThan(ns[i - 1].right);
  }
}

test('layout 2: five three-digit numbers fit side by side from 1000 to 1440; only their text shrinks, and only where needed', async ({ page }) => {
  // The oracle for "as now": the home page's numbers, which this change leaves alone.
  await stubBig(page, BIG['all five three-digit']);
  await page.setViewportSize({ width: 1440, height: 785 });
  await page.goto('/');
  await page.locator('[data-stat]').first().waitFor();
  const home = await page.locator('section.resort [data-stat]').first().evaluate((e) => ({
    dd: parseFloat(getComputedStyle(e.querySelector('dd')).fontSize),
    dt: parseFloat(getComputedStyle(e.querySelector('dt')).fontSize),
    unit: parseFloat(getComputedStyle(e.querySelector('.unit')).fontSize),
  }));
  for (const [name, values] of Object.entries(BIG)) {
    await stubBig(page, values);
    for (const w of [1000, 1100, 1280, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('about:blank'); // a real load each time, not just a hash change
      await page.goto('/#northstar');
      await page.locator('.resort-info [data-stat]').first().waitFor();
      const label = `${name} @${w}`;
      const ns = await panelNumbers(page);
      expect(ns.map((n) => n.value).filter((v) => /^\d{3} in$/.test(v)).length, `${label}: the three-digit values are on the page`)
        .toBe(Object.keys(values).length);
      expectFit(ns, label);
      // The labels and the "in" never change; the five numbers share one size, never bigger than now.
      for (const n of ns) {
        expect(n.dt, `${label}: label size`).toBe(home.dt);
        expect(n.unit, `${label}: "in" size`).toBe(home.unit);
        expect(n.dd, `${label}: the five numbers the same size`).toBe(ns[0].dd);
      }
      expect(ns[0].dd, `${label}: never bigger than now`).toBeLessThanOrEqual(home.dd);
      if (w === 1440) expect(ns[0].dd, `${label}: unchanged at 1440`).toBe(home.dd);
      // Just enough: when the text is smaller, the widest number nearly fills its column.
      if (ns[0].dd < home.dd) {
        const room = Math.min(...ns.map((n) => (n.cellRight - n.cellLeft) - (n.right - n.left)));
        expect(room, `${label}: shrunk no more than needed`).toBeLessThan(3);
      }
    }
  }
});

test('layout 2: resizing the window shrinks the numbers and grows them back', async ({ page }) => {
  await stubBig(page, BIG['all five three-digit']);
  await page.setViewportSize({ width: 1440, height: 785 });
  await page.goto('/#heavenly');
  await page.locator('.resort-info [data-stat]').first().waitFor();
  const before = (await panelNumbers(page))[0].dd;
  // Narrower, then wider again, in the same page: no reload.
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect.poll(async () => (await panelNumbers(page))[0].dd).toBeLessThan(before);
  expectFit(await panelNumbers(page), 'shrunk @1000');
  await page.setViewportSize({ width: 1440, height: 785 });
  await expect.poll(async () => (await panelNumbers(page))[0].dd).toBe(before);
  expectFit(await panelNumbers(page), 'back @1440');
});
