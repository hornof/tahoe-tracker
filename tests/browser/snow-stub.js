// Builds the `/api/snow` answer the browser tests stub, by running the real Pages Function
// (functions/api/snow.js) over a fake KV filled from the saved resort pages in tests/fixtures/.
// So the stub has exactly the shape the live Worker sends, and the expected numbers come from
// the parser, not from values typed into the tests.
import { readFileSync } from 'node:fs';
import { RESORTS, readSnowReport, readForecast, onRequestGet } from '../../functions/api/snow.js';

export const NOW = Date.parse('2026-11-23T10:00:00Z'); // a Monday, 2:00 AM PST
const HOUR = 60 * 60 * 1000;

// What the parser reads from each saved page: the oracle for what the page must show.
export const PARSED = Object.fromEntries(RESORTS.map((r) => {
  const html = readFileSync(new URL(`../fixtures/${r.id}-snow-report.html`, import.meta.url), 'utf8');
  return [r.id, { report: readSnowReport(html), forecast: readForecast(html) }];
}));

export const REPORT_URL = Object.fromEntries(RESORTS.map((r) => [r.id, r.url]));

// `kinds` maps a resort id to one of:
//   'ok'           fetched 30 minutes ago (no refresh due)
//   'refreshing'   fetched 3 hours ago, so the Worker answers with the old copy and refreshes
//   'stale'        our last fetch failed and the copy is 7 hours old
//   'not-available' no copy at all
// Resorts not named are 'ok'.
export async function snowBody(kinds = {}) {
  const store = new Map();
  for (const r of RESORTS) {
    const kind = kinds[r.id] || 'ok';
    if (kind === 'not-available') continue;
    const ago = { ok: 0.5, refreshing: 3, stale: 7 }[kind] * HOUR;
    const fetchedAt = new Date(NOW - ago).toISOString();
    const attemptedAt = kind === 'stale' ? new Date(NOW - 0.5 * HOUR).toISOString() : fetchedAt;
    store.set(`resort:${r.id}`, JSON.stringify({
      data: PARSED[r.id],
      fetchedAt,
      attemptedAt,
      error: kind === 'stale' ? 'upstream-status: status 503, 0 bytes' : null,
    }));
  }
  const kv = {
    async get(key) { const v = store.get(key); return v === undefined ? null : JSON.parse(v); },
    async put() {},
  };
  const res = await onRequestGet({
    env: { SNOW: kv },
    now: () => NOW,
    fetchImpl: async () => { throw new Error('no network in tests'); },
    waitUntil: () => {},
  });
  return res.json();
}

// Answers the page's `/api/snow` request with `body` (or `status` with no JSON, to test a failure).
export async function stubSnow(page, { body, status = 200 } = {}) {
  const json = body ?? (await snowBody());
  await page.route('**/api/snow', (route) => (status === 200
    ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) })
    : route.fulfill({ status, body: 'oops' })));
}
