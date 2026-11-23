// Pure helpers for showing /api/snow on the page, shared by app.js and the unit tests.

// The five numbers, in the order the resorts show them, with their labels.
export const STATS = [
  { key: 'twentyFourHourInches', label: '24 h' },
  { key: 'fortyEightHourInches', label: '48 h' },
  { key: 'sevenDayInches', label: '7 days' },
  { key: 'baseDepthInches', label: 'Base' },
  { key: 'seasonTotalInches', label: 'Season' },
];

const DASH = '–';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A number of inches or degrees as text; a missing one is a dash, never "null" or "0".
export const shown = (v) => (v === null || v === undefined || v === '' ? DASH : String(v));

// "2026-11-23" -> "Mon". The forecast date is a calendar date at the resort, so no time zone applies.
export function weekday(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return DASH;
  return WEEKDAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
}

// An ISO instant as Pacific time, the resorts' own: "Sun Nov 22, 11:00 PM PST" (PDT in summer).
// The date is there so a copy more than a week old can't be read as this week's (PR #20 review).
export function pacific(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.hour}:${parts.minute} ${parts.dayPeriod} ${parts.timeZoneName}`;
}

// When we last fetched the numbers, so old numbers aren't read as current (PR #18 review, Note 2).
// After a quiet spell the Worker answers with its old copy and refreshes it in the background.
export function fetchedLine(resort) {
  const when = pacific(resort?.fetchedAt);
  const base = when ? `Fetched ${when}` : 'Fetch time unknown';
  return resort?.refreshing ? `${base} · refreshing now, reload for newer` : base;
}
