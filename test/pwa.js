// The PWA shell holds together: the manifest parses and every icon it names is a PNG of the declared size,
// index.html links the manifest and registers sw.js, and sw.js (run against a stub worker scope) precaches exactly
// the shell, drops stale caches on activate, and serves cache-first with the network as fallback.
'use strict';
const fs = require('fs'), path = require('path');
const { check, done } = require('./env.js');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
function pngSize(f) {
  if (!fs.existsSync(path.join(root, f))) return null;
  const b = fs.readFileSync(path.join(root, f));
  const sig = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return sig && b.subarray(12, 16).toString('ascii') === 'IHDR' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : null;
}

(async () => {
  const man = JSON.parse(read('manifest.webmanifest'));
  check(man.name === 'Orbfall' && man.display === 'standalone' && man.orientation === 'portrait', 'manifest: Orbfall, standalone, portrait');
  check(man.theme_color === '#10231e' && man.background_color === '#10231e', 'manifest: felt theme and background colour');
  check(['192x192', '512x512'].every(s => man.icons.some(i => i.sizes === s && i.purpose === 'any')), 'manifest: 192 and 512 icons for purpose any');
  check(['192x192', '512x512'].every(s => man.icons.some(i => i.sizes === s && i.purpose === 'maskable')), 'manifest: 192 and 512 icons for purpose maskable');
  check(man.icons.every(i => pngSize(i.src) === i.sizes && i.type === 'image/png'), 'manifest: every icon is a PNG of its declared size');

  const html = read('index.html');
  check(/<link rel="manifest" href="manifest\.webmanifest">/.test(html), 'index.html links the manifest');
  check(/apple-mobile-web-app-capable/.test(html) && /apple-mobile-web-app-status-bar-style/.test(html), 'the apple-mobile-web-app meta tags are still there');
  check(/serviceWorker\.register\('sw\.js'\)/.test(html), 'index.html registers sw.js');
  const touch = /<link rel="apple-touch-icon" href="([^"]+)">/.exec(html);
  check(touch && pngSize(touch[1]) === '180x180', 'apple-touch-icon is a 180x180 PNG');

  // run sw.js inside a stub ServiceWorkerGlobalScope
  const BASE = 'https://example.test/orbfall/';
  const abs = u => new URL(u, BASE + 'sw.js').href;
  const H = {}, cacheStore = new Map(), fetched = [];
  const mkRes = (url, extra) => Object.assign({ ok: true, status: 200, statusText: 'OK', redirected: false, headers: {}, body: url, url }, extra);
  const self = { location: { href: BASE + 'sw.js' }, addEventListener: (n, f) => { H[n] = f; }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } };
  const caches = {
    open: async (name) => {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      const c = cacheStore.get(name);
      return { put: async (k, res) => { c.set(abs(typeof k === 'string' ? k : k.url), res); }, keys: async () => [...c.keys()] };
    },
    keys: async () => [...cacheStore.keys()],
    delete: async (name) => cacheStore.delete(name),
    match: async (req) => { const u = abs(typeof req === 'string' ? req : req.url).split('?')[0]; for (const c of cacheStore.values()) if (c.has(u)) return c.get(u); return undefined; }
  };
  function Request(url, init) { this.url = abs(url); this.method = 'GET'; this.mode = 'cors'; Object.assign(this, init); }
  function Response(body, init) { Object.assign(this, { ok: true, redirected: false, body }, init); }
  let fetchImpl = (req) => { const url = typeof req === 'string' ? abs(req) : req.url; fetched.push(url); return Promise.resolve(mkRes(url)); };
  new Function('self', 'caches', 'fetch', 'Request', 'Response', read('sw.js'))(self, caches, (req) => fetchImpl(req), Request, Response);
  check(H.install && H.activate && H.fetch, 'sw.js registers install, activate and fetch handlers');

  cacheStore.set('orbfall-shell-0', new Map()); // a stale cache left by a previous version
  let p; H.install({ waitUntil: x => { p = x; } }); await p;
  const live = [...cacheStore.keys()].find(n => n !== 'orbfall-shell-0');
  check(!!live && /\d/.test(live), 'install opens a versioned cache (' + live + ')');
  const cached = live ? [...cacheStore.get(live).keys()].map(u => u.replace(BASE, '')) : [];
  const missing = cached.filter(u => u !== '' && !fs.existsSync(path.join(root, u)));
  check(cached.includes('') && cached.includes('manifest.webmanifest') && missing.length === 0, 'install precaches the shell and every entry exists on disk (' + cached.length + ' entries)');
  check(man.icons.every(i => cached.includes(i.src)) && touch && cached.includes(touch[1]), 'every icon the manifest and index.html name is in the shell');
  check(fetched.every(u => !/index\.html$/.test(u)), 'the page is cached under ./ only, never /index.html (redirect-safe)');

  H.activate({ waitUntil: x => { p = x; } }); await p;
  check(!cacheStore.has('orbfall-shell-0') && cacheStore.has(live), 'activate deletes stale caches and keeps the current one');

  fetchImpl = () => Promise.reject(new Error('offline'));
  let out; H.fetch({ request: new Request(BASE + '?utm=1', { mode: 'navigate' }), respondWith: x => { out = x; } });
  let res = await out;
  check(res && res.url === BASE, 'a navigation is answered from the cached shell while offline');
  H.fetch({ request: new Request(BASE + 'icons/icon-192.png'), respondWith: x => { out = x; } });
  res = await out;
  check(res && res.url === BASE + 'icons/icon-192.png', 'a shell asset is served from cache while offline');
  fetchImpl = (req) => Promise.resolve(mkRes(req.url, { fromNetwork: true }));
  H.fetch({ request: new Request(BASE + 'later/asset.json'), respondWith: x => { out = x; } });
  res = await out;
  check(res && res.fromNetwork, 'an uncached request goes to the network');
  let handled = false; H.fetch({ request: Object.assign(new Request(BASE), { method: 'POST' }), respondWith: () => { handled = true; } });
  check(!handled, 'non-GET requests are left to the browser');
  done('pwa');
})().catch(e => { console.error(e); process.exit(1); });
