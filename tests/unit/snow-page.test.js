import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, shown, weekday, pacific, fetchedLine } from '../../site/snow.js';

// A small seeded random source, so a failing case can be replayed.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('the five numbers are the ones the Worker sends, in the resort order, each once', () => {
  assert.deepEqual(STATS.map((s) => s.key), [
    'twentyFourHourInches', 'fortyEightHourInches', 'sevenDayInches', 'baseDepthInches', 'seasonTotalInches',
  ]);
  assert.equal(new Set(STATS.map((s) => s.label)).size, 5);
});

test('shown keeps a value as the resort gives it and turns a missing one into a dash', () => {
  for (const v of [0, 1, 48, '0', '0-1', '2-4']) assert.equal(shown(v), String(v));
  for (const v of [null, undefined, '']) assert.equal(shown(v), '–');
});

test('weekday agrees with an independent count of days from a known Monday, over many dates', () => {
  // Oracle: 2026-11-23 is a Monday; every 7 days later or earlier is too. No Date weekday involved.
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const base = Date.UTC(2026, 10, 23);
  const r = rng(16);
  for (let i = 0; i < 500; i++) {
    const offset = Math.floor(r() * 4000) - 2000;
    const iso = new Date(base + offset * 86400000).toISOString().slice(0, 10);
    assert.equal(weekday(iso), names[((offset % 7) + 7) % 7], iso);
  }
  for (const junk of [null, undefined, '', 'Monday', '2026-11']) assert.equal(weekday(junk), '–');
});

test('pacific shows the day, date, hour and minute 8 hours behind UTC in winter and 7 in summer', () => {
  // Oracle: plain arithmetic on UTC hours, away from the two change-over weekends. The weekday and
  // date come from shifting the instant back by the offset and reading its UTC calendar fields.
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const r = rng(4);
  const cases = [
    { from: Date.UTC(2026, 10, 3), to: Date.UTC(2027, 2, 13), off: 8, zone: 'PST' },
    { from: Date.UTC(2027, 2, 15), to: Date.UTC(2027, 9, 30), off: 7, zone: 'PDT' },
  ];
  for (const c of cases) {
    for (let i = 0; i < 300; i++) {
      const t = c.from + Math.floor(r() * (c.to - c.from) / 60000) * 60000;
      const d = new Date(t);
      const h24 = (d.getUTCHours() - c.off + 24) % 24;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const local = new Date(t - c.off * 3600000);
      const day = `${DAYS[local.getUTCDay()]} ${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}`;
      const out = pacific(d.toISOString());
      assert.equal(out, `${day}, ${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'} ${c.zone}`, d.toISOString());
    }
  }
});

test('pacific puts the day on the Pacific side of midnight', () => {
  assert.equal(pacific('2026-11-23T07:00:00Z'), 'Sun Nov 22, 11:00 PM PST');
  assert.equal(pacific('2026-11-23T08:00:00Z'), 'Mon Nov 23, 12:00 AM PST');
  // Across a month and a year end, and a week apart (so an old copy can't read as this week's).
  assert.equal(pacific('2027-01-01T07:59:00Z'), 'Thu Dec 31, 11:59 PM PST');
  assert.notEqual(pacific('2026-11-16T09:30:00Z'), pacific('2026-11-23T09:30:00Z'));
  assert.equal(pacific('not a time'), null);
  assert.equal(pacific(null), null);
});

test('fetchedLine says when we fetched, and says "refreshing" only while the Worker refreshes', () => {
  const fetchedAt = '2026-11-23T09:30:00Z';
  assert.equal(fetchedLine({ fetchedAt, refreshing: false }), 'Fetched Mon Nov 23, 1:30 AM PST');
  assert.match(fetchedLine({ fetchedAt, refreshing: true }), /^Fetched Mon Nov 23, 1:30 AM PST · refreshing/);
  assert.doesNotMatch(fetchedLine({ fetchedAt, refreshing: false }), /refreshing/);
  assert.equal(fetchedLine({ fetchedAt: null, refreshing: false }), 'Fetch time unknown');
});
