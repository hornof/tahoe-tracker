// The cams page: home (one live cam per resort) and a view per resort (one big cam plus tiles).
// The live players stay clickable everywhere (play, pause); the label or button next to each cam
// navigates (Luke, Decision 12). Nothing is laid over a player.
import { embedUrl, snapshotUrl, resorts, parseHash, hashFor } from './cams.js';

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

// Room for card #16's snow numbers and forecast.
function numbers(resort) {
  return el('div', { class: 'numbers', 'data-numbers': resort.id },
    el('p', { class: 'muted', text: 'Snow numbers and forecast: coming soon.' }));
}

function home(rs) {
  return [
    el('p', { class: 'intro', text: 'One live cam per resort. Click a cam to play or pause it; "See all" shows that resort\'s cams.' }),
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
  return el('div', { class: 'resort-view' },
    el('div', { class: 'cams' },
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
            }, 'Make big')))))),
    el('aside', { class: 'resort-info card' },
      el('h2', { text: r.name }),
      numbers(r),
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
  try {
    const res = await fetch('cams.json');
    if (!res.ok) throw new Error(`cams.json: ${res.status}`);
    const list = await res.json();
    window.addEventListener('hashchange', () => render(list));
    render(list);
  } catch (err) {
    main.replaceChildren(el('p', { class: 'load-error', role: 'alert', text: `The cam list didn't load (${err.message}). Try reloading.` }));
  }
}

start();
