import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the page has a title and a description for link previews', async () => {
  const html = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>Tahoe Tracker<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
});
