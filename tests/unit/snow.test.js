import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RESORTS,
  USER_AGENT,
  REFRESH_AFTER_MS,
  RETRY_AFTER_MS,
  STALE_AFTER_MS,
  extractValue,
  readSnowReport,
  readForecast,
  needsRefresh,
  statusOf,
  onRequestGet,
} from '../../functions/api/snow.js';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const T0 = Date.parse('2026-11-23T15:00:00Z');

// Saved copies of the three resort pages (tests/fixtures/*-snow-report.html), cut down to the two
// inline scripts that hold the data. Fetched 2026-11-23 with the honest user agent.
const SAVED = Object.fromEntries(
  ['northstar', 'heavenly', 'kirkwood'].map((id) => [
    id,
    readFileSync(new URL(`../fixtures/${id}-snow-report.html`, import.meta.url), 'utf8'),
  ]),
);

// What Akamai sent the spike for a faked browser user agent: status 200, about 1,868 bytes, no data.
const BLOCK_PAGE =
  '<HTML><HEAD><TITLE>Error</TITLE></HEAD><BODY>The system cannot process your request. ' +
  'Please reference the following support ID: 1234567890</BODY></HTML>';

// An independent oracle for the saved pages: each object sits alone on its own line as
// `FR.<name> = <json>;`, so slicing the line and JSON.parse reads it without our brace matcher.
function lineOracle(html, name) {
  const line = html.split('\n').find((l) => l.trim().startsWith(`${name} =`));
  return JSON.parse(line.trim().slice(`${name} =`.length).replace(/;\s*$/, ''));
}
const num = (s) => (s === null || s === undefined || String(s).trim() === '' ? null : Number(s));

function page({ report, forecasts }) {
  return [
    '<html><head><script>',
    'var FR = FR || {};',
    'FR.snowReportSettings = {"Show12Hr":false};',
    report === undefined ? '' : `FR.snowReportData = ${JSON.stringify(report)};`,
    forecasts === undefined ? '' : `FR.forecasts = ${JSON.stringify(forecasts)};`,
    '</script></head><body>report</body></html>',
  ].join('\n');
}

// ---------------------------------------------------------------- extractValue

test('extractValue reads an object and an array out of the page', () => {
  const html = page({ report: { a: 1 }, forecasts: [{ b: [2, 3] }] });
  assert.deepEqual(extractValue(html, 'FR.snowReportData'), { a: 1 });
  assert.deepEqual(extractValue(html, 'FR.forecasts'), [{ b: [2, 3] }]);
});

test('extractValue reads window.FR.<name> = as well as FR.<name> =', () => {
  assert.deepEqual(extractValue('window.FR.snowReportData = {"y":2};', 'FR.snowReportData'), { y: 2 });
  assert.deepEqual(extractValue('x;window.FR.forecasts=[1];', 'FR.forecasts'), [1]);
});

test('extractValue skips a longer name on either side', () => {
  const html =
    'FR.snowReportDataSettings = {"x":1};\nMYFR.snowReportData = {"x":2};\n' +
    'a.FR.snowReportData = {"x":3};\nmywindow.FR.snowReportData = {"x":4};\n' +
    'FR.snowReportData = {"y":5};';
  assert.deepEqual(extractValue(html, 'FR.snowReportData'), { y: 5 });
});

test('extractValue does not take a comparison for an assignment', () => {
  const html = 'if (FR.snowReportData == {}) {}\nFR.snowReportData = {"y":2};';
  assert.deepEqual(extractValue(html, 'FR.snowReportData'), { y: 2 });
});

test('extractValue returns null when the value is missing, cut off or not JSON', () => {
  assert.equal(extractValue(BLOCK_PAGE, 'FR.snowReportData'), null);
  assert.equal(extractValue('', 'FR.snowReportData'), null);
  const full = SAVED.northstar;
  const cut = full.slice(0, full.indexOf('"BaseDepth"'));
  assert.equal(extractValue(cut, 'FR.snowReportData'), null);
  assert.equal(extractValue("FR.snowReportData = {a: 'not json'};", 'FR.snowReportData'), null);
});

// Property: whatever the strings hold (braces, brackets, quotes, backslashes, script-ish text),
// embedding the value with JSON.stringify and reading it back gives the same value, for objects and
// arrays, with and without `window.`. JSON.parse is the oracle.
test('extractValue round-trips random objects and arrays', () => {
  let seed = 14;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const alphabet = ['a', 'Z', '0', ' ', '{', '}', '[', ']', '"', "'", '\\', ';', '\n', 'é', '❄', '<', '/', '='];
  const str = () => {
    let s = '';
    for (let i = Math.floor(rand() * 12); i > 0; i--) s += alphabet[Math.floor(rand() * alphabet.length)];
    return s;
  };
  const value = (depth) => {
    const r = rand();
    if (depth > 2 || r < 0.3) return str();
    if (r < 0.4) return Math.floor(rand() * 100) - 50;
    if (r < 0.45) return null;
    if (r < 0.7) return Array.from({ length: Math.floor(rand() * 4) }, () => value(depth + 1));
    return Object.fromEntries(Array.from({ length: Math.floor(rand() * 4) }, () => [str(), value(depth + 1)]));
  };
  for (let i = 0; i < 400; i++) {
    const v = rand() < 0.5 ? { k: value(0), n: [value(0)] } : [value(0), { k: value(0) }];
    const lead = rand() < 0.5 ? 'window.' : '';
    const html = `<script>\nvar x = "FR.snowReportData = {";\n${lead}FR.snowReportData = ${JSON.stringify(v)};\n</script>`;
    // The decoy above sits inside a JS string; what follows it isn't JSON, so the parser moves on
    // to the real assignment instead of giving up.
    assert.deepEqual(extractValue(html, 'FR.snowReportData'), v, `case ${i}`);
  }
});

// ---------------------------------------------------------------- the parser on saved pages

for (const id of ['northstar', 'heavenly', 'kirkwood']) {
  test(`readSnowReport reads the five numbers and update time from the saved ${id} page`, () => {
    const raw = lineOracle(SAVED[id], 'FR.snowReportData');
    assert.deepEqual(readSnowReport(SAVED[id]), {
      twentyFourHourInches: num(raw.TwentyFourHourSnowfall.Inches),
      fortyEightHourInches: num(raw.FortyEightHourSnowfall.Inches),
      sevenDayInches: num(raw.SevenDaySnowfall.Inches),
      baseDepthInches: num(raw.BaseDepth.Inches),
      seasonTotalInches: num(raw.CurrentSeason.Inches),
      lastUpdatedText: raw.LastUpdatedText,
    });
  });

  test(`readForecast reads five days of high, low and snow from the saved ${id} page`, () => {
    const raw = lineOracle(SAVED[id], 'FR.forecasts')[0].ForecastData;
    const days = readForecast(SAVED[id]);
    assert.equal(days.length, 5);
    // Invariants: one day each, consecutive Pacific dates from Nov 23, low never above high.
    days.forEach((d, i) => {
      assert.equal(d.date, `2026-11-${23 + i}`);
      assert.ok(Number.isFinite(d.highF) && Number.isFinite(d.lowF));
      assert.ok(d.lowF <= d.highF, `${id} day ${i}: low ${d.lowF} > high ${d.highF}`);
      assert.equal(d.highF, raw[i].HighTempStandard);
      assert.equal(d.lowF, raw[i].LowTempStandard);
      assert.equal(d.snowDayInches, raw[i].SnowFallDayStandard);
      assert.equal(d.snowNightInches, raw[i].SnowFallNightStandard);
    });
  });
}

// Spot checks against what the snow-report spike saw on the resorts' own pages, and what the
// resort pages displayed (ranges such as "0-1" kept as text, a missing night as null).
test('the saved pages match the numbers the spike saw on the resorts\' own pages', () => {
  const n = readSnowReport(SAVED.northstar);
  assert.equal(n.sevenDayInches, 48);
  assert.equal(n.baseDepthInches, 50);
  assert.equal(n.seasonTotalInches, 66);
  assert.equal(n.lastUpdatedText, 'Updated November 22, 2026 at 6:31 AM PST');
  assert.equal(readSnowReport(SAVED.heavenly).baseDepthInches, 25);
  assert.equal(readSnowReport(SAVED.heavenly).lastUpdatedText, 'Updated November 22, 2026 at 7:02 AM PST');
  assert.equal(readSnowReport(SAVED.kirkwood).fortyEightHourInches, 1);
  assert.equal(readSnowReport(SAVED.kirkwood).baseDepthInches, 37);
  const f = readForecast(SAVED.northstar);
  assert.deepEqual(f[0], { date: '2026-11-23', highF: 39, lowF: 23, snowDayInches: '0', snowNightInches: '0' });
  assert.equal(f[1].snowNightInches, '0-1');
  assert.equal(f[4].snowNightInches, null);
});

test('readSnowReport returns null without a report, and null for a number it cannot read', () => {
  assert.equal(readSnowReport(BLOCK_PAGE), null);
  const raw = lineOracle(SAVED.kirkwood, 'FR.snowReportData');
  const blanks = {
    ...raw,
    TwentyFourHourSnowfall: { Inches: '' },
    FortyEightHourSnowfall: null,
    SevenDaySnowfall: { Inches: 'abc' },
  };
  const r = readSnowReport(page({ report: blanks }));
  assert.equal(r.twentyFourHourInches, null);
  assert.equal(r.fortyEightHourInches, null);
  assert.equal(r.sevenDayInches, null);
  assert.equal(r.baseDepthInches, 37);
  // With no number at all, it isn't a report.
  const none = { LastUpdatedText: 'x', BaseDepth: {}, CurrentSeason: { Inches: '' } };
  assert.equal(readSnowReport(page({ report: none })), null);
});

test('readForecast returns null without a forecast, and caps the days at five', () => {
  assert.equal(readForecast(BLOCK_PAGE), null);
  assert.equal(readForecast(page({ forecasts: [] })), null);
  assert.equal(readForecast(page({ forecasts: [{ ForecastData: [] }] })), null);
  const raw = lineOracle(SAVED.heavenly, 'FR.forecasts');
  const seven = [{ ...raw[0], ForecastData: [...raw[0].ForecastData, ...raw[0].ForecastData.slice(0, 2)] }];
  assert.equal(readForecast(page({ forecasts: seven })).length, 5);
});

test('readForecast gives each day\'s date in Pacific time, in winter and in summer', () => {
  const day = (Date) => ({ Date, HighTempStandard: 40, LowTempStandard: 30 });
  const dates = readForecast(
    page({
      forecasts: [
        {
          ForecastData: [
            day('2026-11-23T08:00:00Z'), // midnight PST
            day('2026-11-24T07:59:00Z'), // still Nov 23 in Pacific, Nov 24 in UTC
            day('2027-07-04T07:00:00Z'), // midnight PDT
            day('2027-07-05T06:30:00Z'), // still Jul 4 in Pacific
            day('not a date'),
          ],
        },
      ],
    }),
  ).map((d) => d.date);
  assert.deepEqual(dates, ['2026-11-23', '2026-11-23', '2027-07-04', '2027-07-04', null]);
});

// ---------------------------------------------------------------- the hourly and stale rules

test('needsRefresh: only when the copy is over an hour old and no attempt in the last 10 minutes', () => {
  assert.equal(REFRESH_AFTER_MS, HOUR);
  assert.equal(RETRY_AFTER_MS, 10 * MIN);
  assert.equal(needsRefresh(null, T0), true);
  // Property over a grid of ages; the oracle is the rule written out plainly.
  for (let copyAge = 0; copyAge <= 8 * HOUR; copyAge += 7 * MIN) {
    for (let attemptAge = 0; attemptAge <= copyAge; attemptAge += 3 * MIN) {
      const rec = {
        data: {},
        fetchedAt: new Date(T0 - copyAge).toISOString(),
        attemptedAt: new Date(T0 - attemptAge).toISOString(),
      };
      const expected = copyAge > HOUR && attemptAge > 10 * MIN;
      assert.equal(needsRefresh(rec, T0), expected, `copy ${copyAge / MIN} min, attempt ${attemptAge / MIN} min`);
    }
  }
  // Exact edges.
  const at = (copy, attempt) => ({
    fetchedAt: new Date(T0 - copy).toISOString(),
    attemptedAt: new Date(T0 - attempt).toISOString(),
  });
  assert.equal(needsRefresh(at(HOUR, HOUR), T0), false);
  assert.equal(needsRefresh(at(HOUR + 1, HOUR + 1), T0), true);
  // Never fetched successfully: the copy counts as infinitely old; the retry wait still applies.
  assert.equal(needsRefresh({ data: null, fetchedAt: null, attemptedAt: new Date(T0 - 5 * MIN).toISOString() }, T0), false);
  assert.equal(needsRefresh({ data: null, fetchedAt: null, attemptedAt: new Date(T0 - 11 * MIN).toISOString() }, T0), true);
});

test('statusOf: "stale" only when our fetch has failed and the last good copy is over 6 hours old', () => {
  assert.equal(STALE_AFTER_MS, 6 * HOUR);
  assert.equal(statusOf(null, T0), 'not-available');
  assert.equal(statusOf({ data: null, fetchedAt: null, error: 'x' }, T0), 'not-available');
  for (let age = 0; age <= 12 * HOUR; age += 13 * MIN) {
    const fetchedAt = new Date(T0 - age).toISOString();
    assert.equal(statusOf({ data: {}, fetchedAt, error: 'fetch-failed' }, T0), age > 6 * HOUR ? 'stale' : 'ok');
    // An old copy whose last fetch worked (nobody visited for hours) is not "stale".
    assert.equal(statusOf({ data: {}, fetchedAt, error: null }, T0), 'ok');
  }
  const failed = (age) => ({ data: {}, fetchedAt: new Date(T0 - age).toISOString(), error: 'x' });
  assert.equal(statusOf(failed(6 * HOUR), T0), 'ok');
  assert.equal(statusOf(failed(6 * HOUR + 1), T0), 'stale');
});

// ---------------------------------------------------------------- the Worker

function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    store,
    gets: 0,
    puts: [],
    async get(key, type) {
      this.gets++;
      const v = store.get(key);
      if (v === undefined) return null;
      const asJson = type === 'json' || type?.type === 'json';
      return asJson ? JSON.parse(v) : v;
    },
    async put(key, value) {
      this.puts.push(key);
      store.set(key, value);
    },
    read(key) {
      const v = store.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
  };
}

const URLS = Object.fromEntries(RESORTS.map((r) => [r.id, r.url]));

// A fetch that answers each resort URL from `pages` (a page string, an Error to throw, or a
// {status, body} pair). Records each call.
function fakeFetch(pages) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    const id = RESORTS.find((r) => r.url === String(url))?.id;
    const p = pages[id];
    if (p instanceof Error) throw p;
    if (p && typeof p === 'object') return new Response(p.body, { status: p.status });
    return new Response(p ?? 'no such page', { status: p === undefined ? 404 : 200 });
  };
  fn.calls = calls;
  return fn;
}

const record = (id, { copyAge, attemptAge = copyAge, error = null, data = 'saved' }) => ({
  data:
    data === 'saved'
      ? { report: readSnowReport(SAVED[id]), forecast: readForecast(SAVED[id]) }
      : data,
  fetchedAt: copyAge === null ? null : new Date(T0 - copyAge).toISOString(),
  attemptedAt: new Date(T0 - attemptAge).toISOString(),
  error,
});

async function call({ kv, fetchImpl, now = T0, env }) {
  const pending = [];
  const res = await onRequestGet({
    request: new Request('https://example.test/api/snow'),
    env: env ?? { SNOW: kv },
    waitUntil: (p) => pending.push(p),
    fetchImpl,
    now: () => now,
  });
  return { res, body: await res.json(), pending };
}

const byId = (body) => Object.fromEntries(body.resorts.map((r) => [r.id, r]));

test('/api/snow with fetch mocked returns all three resorts\' numbers and forecasts as JSON', async () => {
  const kv = fakeKV();
  const fetchImpl = fakeFetch(SAVED);
  // First call: KV is empty, so it answers at once with "not available" and fills KV behind.
  const first = await call({ kv, fetchImpl });
  assert.deepEqual(first.body.resorts.map((r) => r.status), ['not-available', 'not-available', 'not-available']);
  await Promise.all(first.pending);
  // Second call: answered from KV.
  const { res, body } = await call({ kv, fetchImpl, now: T0 + MIN });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body.resorts.map((r) => r.id), ['northstar', 'heavenly', 'kirkwood']);
  for (const r of body.resorts) {
    assert.equal(r.status, 'ok');
    assert.equal(r.reportUrl, URLS[r.id]);
    assert.equal(r.fetchedAt, new Date(T0).toISOString());
    assert.deepEqual(r.report, readSnowReport(SAVED[r.id]));
    assert.deepEqual(r.forecast, readForecast(SAVED[r.id]));
    assert.equal(r.lastError, null);
  }
  assert.equal(byId(body).northstar.report.baseDepthInches, 50);
  assert.equal(fetchImpl.calls.length, 3, 'the second call did not fetch again');
});

test('/api/snow fetches each resort with the honest user agent and a 10 s timeout', async () => {
  const original = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = (ms) => {
    timeouts.push(ms);
    return original.call(AbortSignal, ms);
  };
  try {
    const fetchImpl = fakeFetch(SAVED);
    const { pending } = await call({ kv: fakeKV(), fetchImpl });
    await Promise.all(pending);
    assert.deepEqual(fetchImpl.calls.map((c) => c.url).sort(), Object.values(URLS).sort());
    for (const { init } of fetchImpl.calls) {
      assert.equal(new Headers(init.headers).get('user-agent'), USER_AGENT);
      assert.ok(init.signal instanceof AbortSignal);
    }
    assert.match(USER_AGENT, /^tahoe-tracker\/[\d.]+ \(\+https:\/\/tahoe-tracker\.hornof\.org/);
    assert.doesNotMatch(USER_AGENT, /Mozilla|Chrome|Safari|Firefox/);
    assert.deepEqual(timeouts, [10000, 10000, 10000]);
  } finally {
    AbortSignal.timeout = original;
  }
});

test('/api/snow answers from KV at once and does not fetch while the copy is under an hour old', async () => {
  const kv = fakeKV(Object.fromEntries(RESORTS.map((r) => [`resort:${r.id}`, record(r.id, { copyAge: 59 * MIN })])));
  const fetchImpl = fakeFetch(SAVED);
  const { body, pending } = await call({ kv, fetchImpl });
  assert.equal(pending.length, 0);
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(kv.puts.length, 0);
  assert.deepEqual(body.resorts.map((r) => r.status), ['ok', 'ok', 'ok']);
  assert.deepEqual(body.resorts.map((r) => r.refreshing), [false, false, false]);
});

test('/api/snow answers before Vail does when the copy is over an hour old, then refreshes it behind', async () => {
  const kv = fakeKV(Object.fromEntries(RESORTS.map((r) => [`resort:${r.id}`, record(r.id, { copyAge: 61 * MIN })])));
  // Vail hangs until released: the answer must not wait for it.
  let release;
  const gate = new Promise((r) => (release = r));
  const inner = fakeFetch(SAVED);
  const fetchImpl = async (url, init) => {
    await gate;
    return inner(url, init);
  };
  const { body, pending } = await call({ kv, fetchImpl });
  assert.deepEqual(body.resorts.map((r) => r.status), ['ok', 'ok', 'ok']);
  assert.deepEqual(body.resorts.map((r) => r.refreshing), [true, true, true]);
  assert.equal(body.resorts[0].fetchedAt, new Date(T0 - 61 * MIN).toISOString(), 'answered with the old copy');
  assert.equal(pending.length, 3, 'one background refresh per resort');
  release();
  await Promise.all(pending);
  for (const r of RESORTS) assert.equal(kv.read(`resort:${r.id}`).fetchedAt, new Date(T0).toISOString());
});

test('/api/snow refreshes only the resorts whose copy is over an hour old', async () => {
  const kv = fakeKV({
    'resort:northstar': record('northstar', { copyAge: 2 * HOUR }),
    'resort:heavenly': record('heavenly', { copyAge: 10 * MIN }),
    'resort:kirkwood': record('kirkwood', { copyAge: HOUR + 1 }),
  });
  const fetchImpl = fakeFetch(SAVED);
  const { pending } = await call({ kv, fetchImpl });
  await Promise.all(pending);
  assert.deepEqual(fetchImpl.calls.map((c) => c.url).sort(), [URLS.kirkwood, URLS.northstar].sort());
  assert.deepEqual(kv.puts.sort(), ['resort:kirkwood', 'resort:northstar']);
});

// One resort's fetch fails in each way Vail can fail; the other two are unaffected.
const FAILURES = {
  'a block page with status 200': { page: BLOCK_PAGE, error: /^no-snow-report: status 200, \d+ bytes/ },
  'an error status': { page: { status: 503, body: 'Service Unavailable' }, error: /^upstream-status: status 503/ },
  'a timeout': {
    page: new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    error: /^fetch-failed: TimeoutError/,
  },
};

for (const [how, { page: badPage, error }] of Object.entries(FAILURES)) {
  for (const [copyAge, expected] of [
    [2 * HOUR, 'ok'],
    [7 * HOUR, 'stale'],
    [null, 'not-available'],
  ]) {
    const label = copyAge === null ? 'no data' : `data ${copyAge / HOUR} h old`;
    test(`Heavenly fails with ${how} (${label}): it is "${expected}", the other two are unaffected`, async () => {
      const prior = record('heavenly', { copyAge, attemptAge: 2 * HOUR, data: copyAge === null ? null : 'saved' });
      const kv = fakeKV({
        'resort:northstar': record('northstar', { copyAge: 2 * HOUR }),
        'resort:heavenly': prior,
        'resort:kirkwood': record('kirkwood', { copyAge: 2 * HOUR }),
      });
      const fetchImpl = fakeFetch({ ...SAVED, heavenly: badPage });
      const first = await call({ kv, fetchImpl });
      await Promise.all(first.pending); // must not reject
      const { body, pending } = await call({ kv, fetchImpl, now: T0 + MIN });
      assert.equal(pending.length, 0, 'no retry within 10 minutes of the failed attempt');
      const r = byId(body);
      assert.equal(r.heavenly.status, expected);
      assert.match(r.heavenly.lastError, error);
      assert.equal(r.heavenly.lastAttemptAt, new Date(T0).toISOString());
      // The failed fetch keeps the last good copy, untouched.
      assert.deepEqual(r.heavenly.report, prior.data?.report ?? null);
      assert.deepEqual(r.heavenly.forecast, prior.data?.forecast ?? null);
      assert.equal(r.heavenly.fetchedAt, prior.fetchedAt);
      for (const id of ['northstar', 'kirkwood']) {
        assert.equal(r[id].status, 'ok');
        assert.equal(r[id].lastError, null);
        assert.equal(r[id].fetchedAt, new Date(T0).toISOString());
        assert.deepEqual(r[id].report, readSnowReport(SAVED[id]));
      }
    });
  }
}

test('a stale resort goes back to "ok" when its fetch works again', async () => {
  const kv = fakeKV({
    'resort:northstar': record('northstar', { copyAge: 8 * HOUR, attemptAge: 30 * MIN, error: 'fetch-failed: x' }),
  });
  const failing = fakeFetch({ ...SAVED, northstar: BLOCK_PAGE });
  const before = await call({ kv, fetchImpl: failing });
  assert.equal(byId(before.body).northstar.status, 'stale');
  await Promise.all(before.pending);
  // Twenty minutes later Vail answers again.
  const later = T0 + 20 * MIN;
  const working = fakeFetch(SAVED);
  const retry = await call({ kv, fetchImpl: working, now: later });
  await Promise.all(retry.pending);
  assert.ok(working.calls.some((c) => c.url === URLS.northstar));
  const { body } = await call({ kv, fetchImpl: working, now: later + MIN });
  const n = byId(body).northstar;
  assert.equal(n.status, 'ok');
  assert.equal(n.lastError, null);
  assert.equal(n.fetchedAt, new Date(later).toISOString());
});

test('a page that has the report but no forecast still counts, with forecast null', async () => {
  const kv = fakeKV();
  const report = lineOracle(SAVED.kirkwood, 'FR.snowReportData');
  const { pending } = await call({ kv, fetchImpl: fakeFetch({ ...SAVED, kirkwood: page({ report }) }) });
  await Promise.all(pending);
  const { body } = await call({ kv, fetchImpl: fakeFetch(SAVED), now: T0 + MIN });
  const k = byId(body).kirkwood;
  assert.equal(k.status, 'ok');
  assert.equal(k.forecast, null);
  assert.equal(k.report.baseDepthInches, 37);
});

test('a KV value that is not JSON counts as no data, and a KV write that fails does not throw', async () => {
  const kv = fakeKV({ 'resort:northstar': '{not json' });
  kv.put = async () => {
    throw new Error('KV write limit');
  };
  const { res, body, pending } = await call({ kv, fetchImpl: fakeFetch(SAVED) });
  assert.equal(res.status, 200);
  assert.equal(byId(body).northstar.status, 'not-available');
  await Promise.all(pending);
});

test('/api/snow says so when the SNOW binding is missing', async () => {
  const { res, body } = await call({ env: {}, fetchImpl: fakeFetch(SAVED) });
  assert.equal(res.status, 500);
  assert.equal(body.error, 'kv-missing');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
