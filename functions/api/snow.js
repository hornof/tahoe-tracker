// GET /api/snow: Cloudflare Pages Function. The snow numbers and 5-day forecast for all three
// resorts, as JSON (docs/TDD.md, piece 2).
//
// It always answers at once from the last good copy in Workers KV (binding SNOW, one key per
// resort). When a resort's copy is over an hour old it also refreshes that resort in the background
// (waitUntil), so the page never waits on Vail. A resort whose fetch fails keeps its last good copy;
// it is "stale" once our fetch has failed and that copy is over 6 hours old, and "not-available"
// when there is no copy at all. Staleness is judged by our own fetch time, never by the report's
// update text: Vail updates its report once a morning.

const PAGE_PATH = '/the-mountain/mountain-conditions/snow-and-weather-report.aspx';

export const RESORTS = [
  { id: 'northstar', name: 'Northstar', url: `https://www.northstarcalifornia.com${PAGE_PATH}` },
  { id: 'heavenly', name: 'Heavenly', url: `https://www.skiheavenly.com${PAGE_PATH}` },
  { id: 'kirkwood', name: 'Kirkwood', url: `https://www.kirkwood.com${PAGE_PATH}` },
];

// An honest, named user agent. The spike found that a faked browser one is what Akamai blocks.
export const USER_AGENT =
  'tahoe-tracker/0.1 (+https://tahoe-tracker.hornof.org; personal snow dashboard)';

const FETCH_TIMEOUT_MS = 10000;
export const REFRESH_AFTER_MS = 60 * 60 * 1000; // refresh a copy older than this
export const RETRY_AFTER_MS = 10 * 60 * 1000; // after a failed attempt, wait this long to retry
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const kvKey = (id) => `resort:${id}`;

// ---------------------------------------------------------------- parsing the page

// Finds `FR.<name> = {...}` or `= [...]` (also `window.FR.<name> =`) in the page and parses the
// JSON value. A match that doesn't parse is skipped in favour of a later one. Returns null if none.
export function extractValue(html, name) {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*[{[]`, 'g');
  let match;
  while ((match = pattern.exec(html)) !== null) {
    // Skip a longer name that ends with this one, e.g. MYFR.snowReportData or a.FR.snowReportData,
    // but allow `window.` in front.
    let lead = match.index;
    if (lead >= 7 && html.slice(lead - 7, lead) === 'window.') lead -= 7;
    const before = html[lead - 1];
    if (before && /[\w$.]/.test(before)) continue;
    const start = match.index + match[0].length - 1;
    const end = matchingBracket(html, start);
    if (end === -1) continue;
    try {
      return JSON.parse(html.slice(start, end + 1));
    } catch {
      // not JSON here; try the next match
    }
  }
  return null;
}

// Index of the bracket that closes the one at `start`, skipping brackets inside strings; -1 if none.
function matchingBracket(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '{' || c === '[') {
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// "48" or 48 -> 48; "", "abc", null -> null.
function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Forecast snow is text as the resort shows it, such as "0-1"; blank or missing -> null.
function toText(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string' || v.trim() === '') return null;
  return v.trim();
}

// The five numbers (inches) and the report's own update text, or null when the page has no report.
export function readSnowReport(html) {
  const r = extractValue(html, 'FR.snowReportData');
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const report = {
    twentyFourHourInches: toNumber(r.TwentyFourHourSnowfall?.Inches),
    fortyEightHourInches: toNumber(r.FortyEightHourSnowfall?.Inches),
    sevenDayInches: toNumber(r.SevenDaySnowfall?.Inches),
    baseDepthInches: toNumber(r.BaseDepth?.Inches),
    seasonTotalInches: toNumber(r.CurrentSeason?.Inches),
    lastUpdatedText: typeof r.LastUpdatedText === 'string' ? r.LastUpdatedText : null,
  };
  const numbers = Object.values(report).filter((v) => typeof v === 'number');
  return numbers.length > 0 ? report : null;
}

const pacificDay = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// "2026-11-23T08:00:00Z" (midnight Pacific) -> "2026-11-23".
function pacificDate(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const parts = Object.fromEntries(pacificDay.formatToParts(t).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Up to five days of { date, highF, lowF, snowDayInches, snowNightInches }, or null.
export function readForecast(html) {
  const v = extractValue(html, 'FR.forecasts');
  const f = Array.isArray(v) ? v[0] : v;
  const days = f?.ForecastData;
  if (!Array.isArray(days) || days.length === 0) return null;
  return days.slice(0, 5).map((d) => ({
    date: pacificDate(d?.Date),
    highF: toNumber(d?.HighTempStandard),
    lowF: toNumber(d?.LowTempStandard),
    snowDayInches: toText(d?.SnowFallDayStandard),
    snowNightInches: toText(d?.SnowFallNightStandard),
  }));
}

// ---------------------------------------------------------------- the rules

const age = (iso, now) => (iso ? now - Date.parse(iso) : Infinity);

// A KV record is { data: {report, forecast} | null, fetchedAt, attemptedAt, error }, times as ISO.
export function needsRefresh(rec, now) {
  if (!rec) return true;
  return age(rec.fetchedAt, now) > REFRESH_AFTER_MS && age(rec.attemptedAt, now) > RETRY_AFTER_MS;
}

export function statusOf(rec, now) {
  if (!rec?.data) return 'not-available';
  if (rec.error && age(rec.fetchedAt, now) > STALE_AFTER_MS) return 'stale';
  return 'ok';
}

// ---------------------------------------------------------------- fetching and storing

// { data } on success, { error } with what came back otherwise. Never throws.
async function fetchResort(resort, fetchImpl) {
  let res;
  let html;
  try {
    res = await fetchImpl(resort.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    html = await res.text();
  } catch (err) {
    return { error: `fetch-failed: ${err?.name}: ${err?.message}` };
  }
  // Check for the data, not the status code: Akamai's block page comes back as 200.
  const report = res.ok ? readSnowReport(html) : null;
  if (report) return { data: { report, forecast: readForecast(html) } };
  const bytes = new TextEncoder().encode(html).length;
  const server = res.headers.get('server');
  const reason = res.ok ? 'no-snow-report' : 'upstream-status';
  return { error: `${reason}: status ${res.status}, ${bytes} bytes${server ? `, server ${server}` : ''}` };
}

async function refreshResort(resort, kv, prev, fetchImpl, now) {
  const attemptedAt = new Date(now()).toISOString();
  const result = await fetchResort(resort, fetchImpl);
  const rec = result.data
    ? { data: result.data, fetchedAt: attemptedAt, attemptedAt, error: null }
    : { data: prev?.data ?? null, fetchedAt: prev?.fetchedAt ?? null, attemptedAt, error: result.error };
  try {
    await kv.put(kvKey(resort.id), JSON.stringify(rec));
  } catch (err) {
    console.error(`snow: KV write for ${resort.id} failed: ${err?.message}`);
  }
}

async function readRecord(kv, id) {
  try {
    return await kv.get(kvKey(id), 'json');
  } catch {
    return null; // a value that isn't JSON counts as none
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// `fetchImpl` and `now` let the unit tests pass a fake fetch and clock; on Cloudflare they are the
// global fetch and Date.now.
export async function onRequestGet(context) {
  const { env, fetchImpl = fetch, now = Date.now } = context;
  const waitUntil = context.waitUntil ? (p) => context.waitUntil(p) : () => {};
  const kv = env?.SNOW;
  if (!kv) {
    return json({ error: 'kv-missing', message: 'The SNOW KV binding is not set for this deployment.' }, 500);
  }

  const t = now();
  const records = await Promise.all(RESORTS.map((r) => readRecord(kv, r.id)));
  const resorts = RESORTS.map((resort, i) => {
    const rec = records[i];
    const refreshing = needsRefresh(rec, t);
    if (refreshing) waitUntil(refreshResort(resort, kv, rec, fetchImpl, now));
    return {
      id: resort.id,
      name: resort.name,
      reportUrl: resort.url,
      status: statusOf(rec, t),
      fetchedAt: rec?.fetchedAt ?? null,
      lastAttemptAt: rec?.attemptedAt ?? null,
      lastError: rec?.error ?? null,
      refreshing,
      report: rec?.data?.report ?? null,
      forecast: rec?.data?.forecast ?? null,
    };
  });
  return json({ resorts, generatedAt: new Date(t).toISOString() }, 200);
}
