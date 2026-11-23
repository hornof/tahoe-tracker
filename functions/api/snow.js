// GET /api/snow: Cloudflare Pages Function. Piece 1 (card #13), the Akamai check.
// Fetches Northstar's snow-report page from Cloudflare and returns its 24 h number as JSON.
// When Vail answers without the data (Akamai's block page comes back as status 200), it says so,
// with what came back, so the live check on the preview shows whether Vail lets Cloudflare through.

export const NORTHSTAR_URL =
  'https://www.northstarcalifornia.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx';

// An honest, named user agent. The spike found that a faked browser one is what Akamai blocks.
export const USER_AGENT =
  'tahoe-tracker/0.1 (+https://tahoe-tracker.hornof.org; personal snow dashboard)';

const FETCH_TIMEOUT_MS = 10000;

// Finds `<name> = {...}` in the page and parses the object. Returns null if it is missing,
// cut off or not valid JSON.
export function extractObject(html, name) {
  const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*\\{`, 'g');
  let match;
  while ((match = pattern.exec(html)) !== null) {
    // Skip a longer name that starts with this one, e.g. FR.snowReportDataSettings.
    const before = html[match.index - 1];
    if (before && /[\w$.]/.test(before)) continue;
    const start = match.index + match[0].length - 1;
    const end = matchingBrace(html, start);
    if (end === -1) return null;
    try {
      return JSON.parse(html.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

// Index of the brace that closes the one at `start`, skipping braces inside strings; -1 if none.
function matchingBrace(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// The 24 h number (inches, as a number) and the report's own update text, or null.
export function readSnowReport(html) {
  const report = extractObject(html, 'FR.snowReportData');
  const raw = report?.TwentyFourHourSnowfall?.Inches;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  if (String(raw).trim() === '') return null;
  const inches = Number(raw);
  if (!Number.isFinite(inches)) return null;
  return {
    twentyFourHourInches: inches,
    lastUpdatedText: typeof report.LastUpdatedText === 'string' ? report.LastUpdatedText : null,
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// `fetchImpl` lets the unit tests pass a fake fetch; on Cloudflare it is the global fetch.
export async function onRequestGet({ request, fetchImpl = fetch }) {
  const colo = request?.cf?.colo ?? null;
  let res;
  let html;
  try {
    res = await fetchImpl(NORTHSTAR_URL, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    html = await res.text();
  } catch (err) {
    return json(
      { ok: false, reason: 'fetch-failed', error: `${err?.name}: ${err?.message}`, colo },
      502,
    );
  }

  const report = res.ok ? readSnowReport(html) : null;
  if (report) {
    return json({ ok: true, resort: 'northstar', ...report, source: NORTHSTAR_URL, colo }, 200);
  }

  return json(
    {
      ok: false,
      reason: res.ok ? 'no-snow-report' : 'upstream-status',
      upstream: {
        status: res.status,
        bytes: new TextEncoder().encode(html).length,
        server: res.headers.get('server'),
        start: html.slice(0, 300),
      },
      colo,
    },
    502,
  );
}
