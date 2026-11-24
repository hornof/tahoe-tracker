// The cams page: home (one live cam per resort) and a view per resort (one big cam plus tiles).
// The live players stay clickable everywhere (play, pause); the label or button next to each cam
// navigates (Luke, Decision 12). Nothing is laid over a player.
import { embedUrl, snapshotUrl, resorts, parseHash, hashFor } from './cams.js';
import { STATS, shown, weekday, pacific, fetchedLine } from './snow.js';

const main = document.getElementById('main');
const nav = document.getElementById('tabs');

// A cam is "down" when its still fails to load (TDD, The cams). Checked once per page load.
const status = new Map(); // id -> 'checking' | 'up' | 'down'
let showBig = false; // set by "Make big", used by the next render

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

function placeholder(cam, resort) {
  return el('div', { class: 'down' },
    el('p', { text: `${cam.name}: not available` }),
    el('a', { href: resort.camsPage, target: '_blank', rel: 'noopener', text: `See ${resort.name}'s cams` }));
}

function player(cam, resort) {
  return el('iframe', {
    src: embedUrl(cam.id),
    title: `${resort.name} ${cam.name} live cam`,
    allow: 'autoplay; fullscreen; picture-in-picture',
    allowfullscreen: true,
    referrerpolicy: 'origin',
  });
}

// The 16:9 spot a cam plays in, or its placeholder when the cam is down.
function spot(cam, resort) {
  const box = el('div', { class: 'spot', 'data-cam': cam.id });
  box.append(status.get(cam.id) === 'down' ? placeholder(cam, resort) : player(cam, resort));
  check(cam, resort);
  return box;
}

function check(cam, resort) {
  if (status.has(cam.id)) return;
  status.set(cam.id, 'checking');
  const img = new Image();
  img.onload = () => status.set(cam.id, 'up');
  img.onerror = () => {
    status.set(cam.id, 'down');
    for (const box of document.querySelectorAll(`.spot[data-cam="${cam.id}"]`)) box.replaceChildren(placeholder(cam, resort));
  };
  img.src = snapshotUrl(cam.id);
}

// The snow numbers from /api/snow, fetched once per page load (card #16). Until they arrive each
// resort says "Loading"; if the request fails, each says "Not available".
let snow = { state: 'loading' }; // { state: 'loading' } | { state: 'ok', byId } | { state: 'failed' }

// `panel`: the resort view's numbers panel (mockup "Resort view, tightened"), which starts with the
// resort's name and puts the "i" button beside it. On the home page the button sits beside the numbers.
function numbers(resort, { panel = false } = {}) {
  return el('div', { class: 'numbers', 'data-numbers': resort.id, 'data-panel': panel ? '' : null },
    numbersContent(resort, panel));
}

function panelHead(resort, button) {
  return el('div', { class: 'panel-head' }, el('h2', { text: resort.name }), button);
}

function notAvailable(why, link) {
  return [
    el('p', { class: 'flag' }, el('strong', { text: 'Not available' }), `: ${why}`),
    link ? el('a', { href: link.href, target: '_blank', rel: 'noopener', text: link.text }) : null,
  ];
}

function numbersContent(resort, panel = false) {
  const head = panel ? panelHead(resort, null) : null;
  if (snow.state === 'loading') return [head, el('p', { class: 'muted', text: 'Loading snow numbers…' })];
  // With no /api/snow answer there is no report link, so link to the resort's page from cams.json.
  if (snow.state === 'failed') {
    return [head, ...notAvailable("the snow numbers didn't load. Try reloading.",
      { href: resort.camsPage, text: `See ${resort.name}'s own page` })];
  }
  const r = snow.byId.get(resort.id);
  if (!r || r.status === 'not-available' || !r.report) {
    return [head, ...notAvailable("we haven't been able to read this resort's snow report yet.",
      r?.reportUrl ? { href: r.reportUrl, text: `See ${resort.name}'s snow report` } : null)];
  }
  const { report } = r;
  const times = timesBox(resort, r);
  const button = infoButton(resort, times);
  return [
    panel ? panelHead(resort, button) : null,
    r.status === 'stale'
      ? el('p', { class: 'flag' }, el('strong', { text: 'Stale' }),
        `: our last fetch failed, so these numbers are from ${pacific(r.fetchedAt) || 'an earlier fetch'}.`)
      : null,
    el('div', { class: 'stats-row' },
      el('dl', { class: 'stats' }, STATS.map((s) => el('div', { class: 'stat', 'data-stat': s.key },
        el('dt', { text: s.label }),
        el('dd', {}, shown(report[s.key]), el('span', { class: 'unit', text: ' in' }))))),
      panel ? null : button),
    times,
    forecast(r.forecast),
  ];
}

// The report's update time and our fetch time, for troubleshooting: hidden behind the "i" button
// beside the numbers while the data is fine (card #22, item 4). "Stale" and "Not available" still
// show as words above.
function timesBox(resort, r) {
  return el('div', { class: 'times', id: `times-${resort.id}`, hidden: true },
    el('p', { class: 'muted updated', text: r.report.lastUpdatedText || 'The report gives no update time.' }),
    el('p', { class: 'muted fetched', text: fetchedLine(r) }));
}

function infoButton(resort, times) {
  const b = el('button', {
    type: 'button',
    class: 'info',
    'aria-label': `${resort.name}: update and fetch times`,
    'aria-expanded': 'false',
    'aria-controls': times.id,
    text: 'i',
  });
  b.addEventListener('click', () => {
    times.hidden = !times.hidden;
    b.setAttribute('aria-expanded', String(!times.hidden));
  });
  return b;
}

function forecast(days) {
  if (!Array.isArray(days) || days.length === 0) return el('p', { class: 'muted', text: 'No forecast in the report.' });
  return el('table', { class: 'forecast' },
    el('caption', { text: '5-day forecast' }),
    el('thead', {},
      el('tr', {},
        el('td', {}),
        el('th', { scope: 'colgroup', colspan: '2', text: '°F' }),
        el('th', { scope: 'colgroup', colspan: '2', text: 'Snow, in' })),
      el('tr', {},
        el('td', {}),
        ...['High', 'Low', 'Day', 'Night'].map((t) => el('th', { scope: 'col', text: t })))),
    el('tbody', {}, days.map((d) => el('tr', { 'data-date': d.date },
      el('th', { scope: 'row', title: d.date, text: weekday(d.date) }),
      el('td', { text: `${shown(d.highF)}°` }),
      el('td', { text: `${shown(d.lowF)}°` }),
      el('td', { text: shown(d.snowDayInches) }),
      el('td', { text: shown(d.snowNightInches) })))));
}

async function loadSnow() {
  try {
    const res = await fetch('/api/snow', { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`/api/snow: ${res.status}`);
    const body = await res.json();
    snow = { state: 'ok', byId: new Map(body.resorts.map((r) => [r.id, r])) };
  } catch {
    snow = { state: 'failed' };
  }
}

// Fill in the panels already on the page once the numbers arrive; later renders read `snow` directly.
function fillNumbers(list) {
  const byId = new Map(resorts(list).map((r) => [r.id, r]));
  for (const box of document.querySelectorAll('.numbers[data-numbers]')) {
    const r = byId.get(box.dataset.numbers);
    if (r) box.replaceChildren(...numbersContent(r, 'panel' in box.dataset).filter(Boolean));
  }
}

function home(rs) {
  return [
    el('p', { class: 'intro', text: "Live webcams embedded from the resorts' camera feeds, plus snow numbers and forecasts a worker pulls from each resort's report every hour." }),
    el('div', { class: 'home-grid' }, rs.map((r) => {
      const cam = r.cams[0];
      return el('section', { class: 'resort card', 'data-resort': r.id },
        el('div', { class: 'card-head' },
          el('h2', { text: r.name }),
          el('span', { class: 'muted', text: `${r.cams.length} cams` })),
        spot(cam, r),
        el('div', { class: 'cam-bar' },
          el('span', { class: 'cam-name', text: cam.name }),
          el('a', { class: 'pill', href: hashFor({ view: r.id }), 'aria-label': `See all ${r.cams.length} ${r.name} cams` },
            `See all ${r.cams.length} ›`)),
        numbers(r));
    })),
  ];
}

function resortView(r, bigId) {
  const big = r.cams.find((c) => c.id === bigId);
  const rest = r.cams.filter((c) => c !== big);
  // A grid (card #22, mockup "Resort view, tightened"): on a laptop the big cam takes the width left
  // beside a 360px numbers panel, the tiles in a row below, both rows on the same left and right edges.
  // On a phone: big cam, tiles, then numbers.
  return el('div', { class: 'resort-view' },
    el('figure', { class: 'big' },
      spot(big, r),
      el('figcaption', {}, el('span', { class: 'cam-name big-name', tabindex: '-1', text: `${r.name} · ${big.name}` }))),
    el('div', { class: 'tiles', 'data-count': String(rest.length) }, rest.map((c) =>
      el('figure', { class: 'tile' },
        spot(c, r),
        el('figcaption', {},
          el('span', { class: 'cam-name', text: c.name }),
          el('button', {
            type: 'button',
            class: 'pill',
            'aria-label': `Make ${c.name} the big cam`,
            onclick: () => { showBig = true; location.hash = hashFor({ view: r.id, big: c.id }); },
          }, 'Make big'))))),
    el('aside', { class: 'resort-info card' },
      numbers(r, { panel: true }),
      el('a', { href: r.camsPage, target: '_blank', rel: 'noopener', text: `${r.name}'s own cams page` })));
}

function tabs(rs, view) {
  const items = [{ id: 'home', name: 'All resorts' }, ...rs];
  nav.replaceChildren(...items.map((t) => el('a', {
    class: 'tab',
    href: hashFor({ view: t.id }),
    'aria-current': t.id === view ? 'page' : null,
    text: t.name,
  })));
}

function render(list) {
  const rs = resorts(list);
  const state = parseHash(location.hash, list);
  tabs(rs, state.view);
  if (state.view === 'home') main.replaceChildren(...home(rs));
  else main.replaceChildren(resortView(rs.find((r) => r.id === state.view), state.big));
  // After "Make big": bring the new big cam into view and put keyboard focus on its name.
  if (showBig && state.view !== 'home') {
    const big = main.querySelector('.big');
    big.scrollIntoView({ block: 'start' });
    big.querySelector('.big-name').focus({ preventScroll: true });
  }
  showBig = false;
}

async function start() {
  const snowLoaded = loadSnow(); // in parallel with the cam list; never throws
  try {
    const res = await fetch('cams.json');
    if (!res.ok) throw new Error(`cams.json: ${res.status}`);
    const list = await res.json();
    window.addEventListener('hashchange', () => render(list));
    render(list);
    snowLoaded.then(() => fillNumbers(list));
  } catch (err) {
    main.replaceChildren(el('p', { class: 'load-error', role: 'alert', text: `The cam list didn't load (${err.message}). Try reloading.` }));
  }
}

start();
