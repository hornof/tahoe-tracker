import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NORTHSTAR_URL,
  USER_AGENT,
  extractObject,
  readSnowReport,
  onRequestGet,
} from '../../functions/api/snow.js';

// The shape the snow-report spike saw in Northstar's page (docs/spikes/snow-report-data.md).
const REPORT = {
  OverallSnowConditions: 'Variable',
  OvernightSnowfall: { Inches: '0', Centimeters: '0' },
  TwentyFourHourSnowfall: { Inches: '3', Centimeters: '7' },
  FortyEightHourSnowfall: { Inches: '5', Centimeters: '12' },
  SevenDaySnowfall: { Inches: '48', Centimeters: '121' },
  BaseDepth: { Inches: '50', Centimeters: '127' },
  CurrentSeason: { Inches: '66', Centimeters: '167' },
  LastUpdatedText: 'Updated November 22, 2026 at 6:31 AM PST',
};

function page(report) {
  return [
    '<html><head><script>',
    'var FR = FR || {};',
    "FR.digitalApiBaseUrl = 'https://digital.snow.com/api/';",
    `FR.snowReportData = ${JSON.stringify(report)};`,
    'FR.forecasts = {"CurrentTempStandard":"28"};',
    '</script></head><body>report</body></html>',
  ].join('\n');
}

// What Akamai sent the spike for a faked browser user agent: status 200, about 1,868 bytes, no data.
const BLOCK_PAGE =
  '<HTML><HEAD><TITLE>Error</TITLE></HEAD><BODY>The system cannot process your request. ' +
  'Please reference the following support ID: 1234567890</BODY></HTML>';

function fakeFetch(body, { status = 200, headers = {} } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status, headers });
  };
  fn.calls = calls;
  return fn;
}

async function call(fetchImpl) {
  const res = await onRequestGet({
    request: new Request('https://example.test/api/snow'),
    env: {},
    fetchImpl,
  });
  return { res, body: await res.json() };
}

test('extractObject reads the FR.snowReportData object out of the page', () => {
  assert.deepEqual(extractObject(page(REPORT), 'FR.snowReportData'), REPORT);
});

test('extractObject returns null when the object is missing', () => {
  assert.equal(extractObject(BLOCK_PAGE, 'FR.snowReportData'), null);
  assert.equal(extractObject('', 'FR.snowReportData'), null);
});

test('extractObject returns null for a cut-off object instead of throwing', () => {
  const cut = page(REPORT).slice(0, page(REPORT).indexOf('"BaseDepth"'));
  assert.equal(extractObject(cut, 'FR.snowReportData'), null);
});

test('extractObject does not take FR.snowReportDataSettings for FR.snowReportData', () => {
  const html = 'FR.snowReportDataSettings = {"x":1};\nFR.snowReportData = {"y":2};';
  assert.deepEqual(extractObject(html, 'FR.snowReportData'), { y: 2 });
});

// Property: whatever strings the report holds (braces, quotes, backslashes, script-ish text),
// embedding it with JSON.stringify and reading it back gives the same object. JSON.parse is the oracle.
test('extractObject round-trips random reports, including braces and quotes inside strings', () => {
  let seed = 13;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const alphabet = ['a', 'Z', '0', ' ', '{', '}', '"', '\\', ';', '\n', 'é', '❄', '<', '/'];
  const str = () => {
    const n = Math.floor(rand() * 12);
    let s = '';
    for (let i = 0; i < n; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
    return s;
  };
  for (let i = 0; i < 300; i++) {
    const report = {
      OverallSnowConditions: str(),
      TwentyFourHourSnowfall: { Inches: String(Math.floor(rand() * 40)), Centimeters: str() },
      Nested: { deeper: [str(), { k: str() }], n: rand() },
      LastUpdatedText: str(),
    };
    assert.deepEqual(extractObject(page(report), 'FR.snowReportData'), report, `case ${i}`);
  }
});

test('readSnowReport gives the 24 h number as a number, with the update text', () => {
  assert.deepEqual(readSnowReport(page(REPORT)), {
    twentyFourHourInches: 3,
    lastUpdatedText: 'Updated November 22, 2026 at 6:31 AM PST',
  });
});

test('readSnowReport returns null when the page has no report or no usable 24 h number', () => {
  assert.equal(readSnowReport(BLOCK_PAGE), null);
  assert.equal(readSnowReport(page({ ...REPORT, TwentyFourHourSnowfall: { Inches: '' } })), null);
  assert.equal(readSnowReport(page({ ...REPORT, TwentyFourHourSnowfall: null })), null);
  assert.equal(readSnowReport(page({ ...REPORT, TwentyFourHourSnowfall: { Inches: 'abc' } })), null);
});

test('/api/snow fetches Northstar with the honest user agent and a 10 s timeout', async () => {
  const original = AbortSignal.timeout;
  const timeouts = [];
  AbortSignal.timeout = (ms) => {
    timeouts.push(ms);
    return original.call(AbortSignal, ms);
  };
  try {
    const fetchImpl = fakeFetch(page(REPORT));
    await call(fetchImpl);
    assert.equal(fetchImpl.calls.length, 1);
    const { url, init } = fetchImpl.calls[0];
    assert.equal(url, NORTHSTAR_URL);
    assert.equal(new Headers(init.headers).get('user-agent'), USER_AGENT);
    assert.match(USER_AGENT, /^tahoe-tracker\/[\d.]+ \(\+https:\/\/tahoe-tracker\.hornof\.org/);
    assert.doesNotMatch(USER_AGENT, /Mozilla|Chrome|Safari|Firefox/);
    assert.ok(init.signal instanceof AbortSignal, 'fetch gets an AbortSignal');
    assert.deepEqual(timeouts, [10000]);
  } finally {
    AbortSignal.timeout = original;
  }
});

test('/api/snow returns the 24 h number as JSON', async () => {
  const { res, body } = await call(fakeFetch(page(REPORT)));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.equal(body.ok, true);
  assert.equal(body.resort, 'northstar');
  assert.equal(body.twentyFourHourInches, 3);
  assert.equal(body.lastUpdatedText, 'Updated November 22, 2026 at 6:31 AM PST');
  assert.equal(body.source, NORTHSTAR_URL);
});

test('/api/snow reports a block when Vail answers 200 without the data', async () => {
  const { res, body } = await call(
    fakeFetch(BLOCK_PAGE, { headers: { server: 'AkamaiNetStorage' } }),
  );
  assert.equal(res.status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'no-snow-report');
  assert.equal(body.upstream.status, 200);
  assert.equal(body.upstream.bytes, new TextEncoder().encode(BLOCK_PAGE).length);
  assert.equal(body.upstream.server, 'AkamaiNetStorage');
  assert.match(body.upstream.start, /cannot process your request/);
});

test('/api/snow reports an upstream error status', async () => {
  const { res, body } = await call(fakeFetch('Forbidden', { status: 403 }));
  assert.equal(res.status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'upstream-status');
  assert.equal(body.upstream.status, 403);
});

test('/api/snow reports a fetch that fails or times out, without throwing', async () => {
  const failing = async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };
  const { res, body } = await call(failing);
  assert.equal(res.status, 502);
  assert.equal(body.ok, false);
  assert.equal(body.reason, 'fetch-failed');
  assert.match(body.error, /TimeoutError/);
});

test('/api/snow answers are not cached', async () => {
  const ok = await call(fakeFetch(page(REPORT)));
  const blocked = await call(fakeFetch(BLOCK_PAGE));
  assert.equal(ok.res.headers.get('cache-control'), 'no-store');
  assert.equal(blocked.res.headers.get('cache-control'), 'no-store');
});
