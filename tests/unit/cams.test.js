import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { embedUrl, snapshotUrl, resorts, parseHash, hashFor } from '../../site/cams.js';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
const cams = JSON.parse(await read('../../site/cams.json'));

// Independent oracle: the Brownrice names in the webcams spike's table, not a copy typed here.
async function spikeIds() {
  const md = await read('../../docs/spikes/webcams.md');
  const rows = md.split('\n').filter((l) => /^\| (Northstar|Heavenly|Kirkwood) \|/.test(l));
  return rows.map((l) => {
    const cells = l.split('|').map((c) => c.trim());
    return { resort: cells[1], id: cells[3].replace(/`/g, '') };
  });
}

test('cams.json lists exactly the ten cams from the webcams spike, each with its resort', async () => {
  const fromSpike = await spikeIds();
  assert.equal(fromSpike.length, 10);
  const key = (c) => `${c.resort.toLowerCase()}/${c.id}`;
  assert.deepEqual(cams.cams.map(key).sort(), fromSpike.map(key).sort());
});

test('every cam has a name, and names and ids are unique', () => {
  for (const c of cams.cams) {
    assert.ok(c.name && c.name.trim().length > 0, `${c.id} has a name`);
    assert.match(c.id, /^[a-z]+$/);
  }
  assert.equal(new Set(cams.cams.map((c) => c.id)).size, cams.cams.length);
  assert.equal(new Set(cams.cams.map((c) => `${c.resort}/${c.name}`)).size, cams.cams.length);
});

test('resorts come in order with 4, 4 and 2 cams, and the home cam first', () => {
  const rs = resorts(cams);
  assert.deepEqual(rs.map((r) => [r.id, r.cams.length]), [['northstar', 4], ['heavenly', 4], ['kirkwood', 2]]);
  assert.deepEqual(rs.map((r) => r.cams[0].id), ['northstarvillage', 'heavenlydipper', 'kirkwoodcornice']);
  for (const r of rs) {
    assert.ok(r.name);
    assert.match(r.camsPage, /^https:\/\/www\.[a-z]+\.com\/the-mountain\/mountain-conditions\/mountain-cams\.aspx$/);
  }
});

test('only the two stable Brownrice URLs are used, never the liveN hosts', async () => {
  for (const c of cams.cams) {
    assert.equal(embedUrl(c.id), `https://player.brownrice.com/embed/${c.id}`);
    assert.equal(snapshotUrl(c.id), `https://player.brownrice.com/snapshot/${c.id}`);
  }
  for (const f of ['../../site/index.html', '../../site/app.js', '../../site/cams.js', '../../site/cams.json']) {
    const text = await read(f);
    assert.doesNotMatch(text, /live\d+p?\.brownrice|streamer\d*\.brownrice|cam-images/, f);
  }
});

test('hashFor and parseHash round-trip for home, every resort and every cam', () => {
  const rs = resorts(cams);
  assert.deepEqual(parseHash('', cams), { view: 'home' });
  assert.deepEqual(parseHash(hashFor({ view: 'home' }), cams), { view: 'home' });
  for (const r of rs) {
    assert.deepEqual(parseHash(hashFor({ view: r.id }), cams), { view: r.id, big: r.cams[0].id });
    for (const c of r.cams) {
      const s = { view: r.id, big: c.id };
      assert.deepEqual(parseHash(hashFor(s), cams), s);
    }
  }
});

test('parseHash falls back sensibly on junk', () => {
  assert.deepEqual(parseHash('#nowhere', cams), { view: 'home' });
  assert.deepEqual(parseHash('#heavenly/northstarvillage', cams), { view: 'heavenly', big: 'heavenlydipper' });
  assert.deepEqual(parseHash('#kirkwood/nope', cams), { view: 'kirkwood', big: 'kirkwoodcornice' });
});

test('the tabs written in index.html (shown before and without cams.json) match the resorts in cams.json', async () => {
  const html = await read('../../site/index.html');
  const nav = html.match(/<nav id="tabs"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const tabs = [...nav.matchAll(/<a class="tab" href="([^"]*)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2]]);
  const expected = [['#', 'All resorts'], ...resorts(cams).map((r) => [hashFor({ view: r.id }), r.name])];
  assert.deepEqual(tabs, expected);
});
