// Pure helpers for the cam list, shared by the page (app.js) and the unit tests.
// Only these two Brownrice URLs are used; never the liveN hosts (webcams spike).
export const embedUrl = (id) => `https://player.brownrice.com/embed/${id}`;
export const snapshotUrl = (id) => `https://player.brownrice.com/snapshot/${id}`;

// The resorts in cams.json order, each with its cams in order; the first cam is the home cam.
export function resorts(list) {
  return list.resorts.map((r) => ({ ...r, cams: list.cams.filter((c) => c.resort === r.id) }));
}

// The view in the URL: "" or "#" is home, "#heavenly" a resort, "#heavenly/heavenlytram" a resort with that cam big.
export function parseHash(hash, list) {
  const [view, camId] = String(hash || '').replace(/^#\/?/, '').split('/');
  const r = resorts(list).find((x) => x.id === view);
  if (!r) return { view: 'home' };
  const big = r.cams.find((c) => c.id === camId) || r.cams[0];
  return { view: r.id, big: big.id };
}

export function hashFor(state) {
  if (!state || state.view === 'home') return '#';
  return state.big ? `#${state.view}/${state.big}` : `#${state.view}`;
}
