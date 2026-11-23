// Stubs the Brownrice player and stills so browser tests don't depend on live video (TDD, Tools).
// `down` lists cam ids whose still fails (404), to test the "not available" placeholder.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function stubBrownrice(page, { down = [] } = {}) {
  await page.route('https://player.brownrice.com/**', (route) => {
    const url = new URL(route.request().url());
    const [, kind, id] = url.pathname.split('/');
    if (kind === 'snapshot') {
      if (down.includes(id)) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF });
    }
    if (kind === 'embed') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><body style="margin:0;background:#789"><button id="play">${id}</button></body>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  // Nothing else outside the page's own server may load in tests.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|player\.brownrice\.com)/, (route) => route.abort());
}
