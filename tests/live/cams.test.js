// Live check, after each deploy (TDD test plan, requirement 3): every cam's still and player answer.
// Not part of `npm test`; run with `npm run test:live`. It talks to Brownrice, so it needs the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { embedUrl, snapshotUrl } from '../../site/cams.js';

const list = JSON.parse(await readFile(new URL('../../site/cams.json', import.meta.url), 'utf8'));
const get = (url) => fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'tahoe-tracker live check' } });

for (const cam of list.cams) {
  test(`${cam.id}: still is 200 image/jpeg`, async () => {
    const res = await get(snapshotUrl(cam.id));
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /^image\/jpeg/);
    await res.arrayBuffer();
  });
  test(`${cam.id}: player is 200`, async () => {
    const res = await get(embedUrl(cam.id));
    assert.equal(res.status, 200);
    await res.text();
  });
}
