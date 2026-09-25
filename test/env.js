// Headless harness: stubs just enough DOM/canvas/storage to run index.html's script in Node.
'use strict';
const fs = require('fs');
const path = require('path');

// Deterministic: Math.random is seeded for the whole process (SEED env var, default 1), so a run of the suite is
// the same run every time. `SEED=7 npm test` explores another sequence.
const SEED = Number(process.env.SEED) || 1;
let seedState = SEED >>> 0;
Math.random = function () {
  seedState = (seedState + 0x6D2B79F5) >>> 0; let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function noop() {}
function ctxStub() {
  return new Proxy({}, { get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 50 });
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (typeof k === 'string' && !(k in t)) return noop;
    return t[k];
  } });
}

function makeEnv(storeMap, opts) {
  opts = opts || {};
  const H = {}, els = {}; let anonId = 0;
  function el(id) {
    const attrs = {}, classes = new Set();
    const e = {
      id, style: { setProperty() {} }, children: [], _html: '', textContent: '', className: '', disabled: false, tagName: 'BUTTON',
      classList: {
        toggle(c, f) { if (f === undefined) f = !classes.has(c); f ? classes.add(c) : classes.delete(c); },
        add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains(c) { return classes.has(c); }
      },
      setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
      addEventListener(n, f) { (H[id + ':' + n] = H[id + ':' + n] || []).push(f); },
      focus() {}, appendChild(c) { e.children.push(c); }, contains() { return false; },
      getContext() { return ctxStub(); }, setPointerCapture() {}
    };
    Object.defineProperty(e, 'innerHTML', { get() { return e._html; }, set(v) { e._html = v; if (v === '') e.children = []; } });
    return e;
  }
  const doc = {
    hidden: false,
    getElementById(id) { return els[id] || (els[id] = el(id)); },
    addEventListener(n, f) { (H['doc:' + n] = H['doc:' + n] || []).push(f); },
    createElement() { return el('anon' + (++anonId)); }
  };
  const timers = []; let tid = 0;
  const win = {
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    addEventListener(n, f) { (H['win:' + n] = H['win:' + n] || []).push(f); },
    matchMedia: () => ({ matches: !!opts.reduced })
  };
  if (opts.storage !== false) {
    win.storage = {
      get: (k) => storeMap.has(k) ? Promise.resolve({ key: k, value: storeMap.get(k) }) : Promise.reject(new Error('missing')),
      set: (k, v) => { storeMap.set(k, v); return Promise.resolve({ key: k, value: v }); }
    };
  }
  if (opts.localStorage) { // a Map standing in for localStorage; localStorageThrows mimics Safari private mode (writes throw)
    const m = opts.localStorage, deny = () => { throw new Error('QuotaExceededError'); };
    win.localStorage = {
      getItem: (k) => m.has(k) ? m.get(k) : null,
      setItem: (k, v) => { if (opts.localStorageThrows) deny(); m.set(k, String(v)); },
      removeItem: (k) => { if (opts.localStorageThrows) deny(); m.delete(k); }
    };
  }
  let now = 0;
  const vibes = [], shares = [];
  const g = {
    window: win, document: doc, performance: { now: () => now },
    navigator: { vibrate: (p) => { vibes.push(p); return true; }, userActivation: { hasBeenActive: true }, share: (d) => { shares.push(d); return Promise.resolve(); } },
    vibes, shares,
    requestAnimationFrame: f => { g._raf = f; },
    setTimeout: (f) => { f(); },
    setInterval: (f, ms) => { const id = ++tid; timers.push({ id, f, ms, acc: 0 }); return id; },
    clearInterval: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); }
  };
  g.step = (ms) => { now += ms; for (const t of timers.slice()) { t.acc += ms; while (t.acc >= t.ms) { t.acc -= t.ms; t.f(); } } g._raf(now); };
  g.H = H; g.els = els; g.timers = timers;
  g.fire = (key, ev) => { (H[key] || []).forEach(f => f(ev || {})); };
  g.dbg = () => win.__dbg();
  g.fetchLog = [];   // the game's network calls; fetchReply decides the answer
  g.fetchReply = (url) => (url.indexOf('/top') >= 0 ? { status: 200, body: { rows: [] } } : { status: 200, body: { ok: true, rank: 1 } });
  g.fetch = (url, init) => { g.fetchLog.push({ url, init }); const r = g.fetchReply(url, init); return Promise.resolve({ ok: r.status < 400, status: r.status, json: () => Promise.resolve(r.body) }); };
  g.reset = () => win.__reset();
  g.tap = (x) => { g.fire('c:pointerdown', { clientX: x, pointerId: 1 }); g.fire('c:pointerup', { clientX: x, pointerId: 1 }); };
  return g;
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let src = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
src = src.replace(/\}\)\(\);\s*$/, `
window.__reset=reset;
window.__setOpt=setOpt;window.__clockFor=clockFor;window.__setBoard=function(u){BOARD_URL=u;};window.__cleanName=cleanName;
var __origRender=render;window.__breakRender=function(){render=function(){throw new Error('boom');};};window.__fixRender=function(){render=__origRender;};
window.__music=musicEvents;window.__musicLayers=musicLayers;window.__L={bass:L_BASS,drums:L_DRUMS,lead:L_LEAD,arp:L_ARP,tense:L_TENSE};
window.__burst=function(n){for(var i=0;i<n;i++)fx(180,300,8,true);};
window.__chain=function(){addScore(1,180,300,false,3);addScore(1,180,300,false,3);addScore(1,180,300,false,3);};
window.__dbg=function(){
  var maxY=-Infinity,minY=Infinity,maxSpeed=0,maxUp=0;
  for(var i=0;i<balls.length;i++){var b=balls[i];if(b.y+b.r>maxY)maxY=b.y+b.r;if(b.y-b.r<minY)minY=b.y-b.r;
    var sp=Math.sqrt((b.x-b.px)*(b.x-b.px)+(b.y-b.py)*(b.y-b.py));if(sp>maxSpeed)maxSpeed=sp;if(b.py-b.y>maxUp)maxUp=b.py-b.y;}
  return {n:balls.length,score:score,state:state,paused:paused,undosFree:undosFree,undosUsed:undosUsed,snap:!!snapshot,
    revivesUsed:revivesUsed,revives:save.revives,tiers:balls.map(function(b){return b.t;}),
    parts:parts.length,rings:rings.length,ghosts:ghosts.length,floats:floats.map(function(f){return f.txt;}),timeScale:timeScale,shown:shown,warn:warn,wash:!!wash,sprites:SPR.length,
    maxScale:balls.reduce(function(m,b){return Math.max(m,b.scale);},0),flashing:balls.filter(function(b){return b.flash>0;}).length,squashed:balls.filter(function(b){return b.sq>0;}).length,
    opt:JSON.parse(JSON.stringify(opt)),optsOpen:optsEl.classList.contains('show'),boardOpen:sheetEl.classList.contains('show'),music:mOn,mNotes:mNotes,
    runMode:runMode,clock:clock,clockMax:clockMax,boardMode:boardMode,modes:JSON.parse(JSON.stringify(save.modes)),startBest:startBest,
    faulted:faulted,faultCount:faultCount,faultShown:faultEl.classList.contains('show'),
    rotated:rotated,rotateShown:rotateEl.classList.contains('show'),installShown:installBtn.classList.contains('show'),iosHintShown:iosHintEl.classList.contains('show'),hintedInstall:save.hintedInstall,
    cid:save.cid,sent:JSON.parse(JSON.stringify(save.sent)),onlineOn:onlineOn(),filter:filter,
    modeUI:modeBtns.map(function(b){return b.getAttribute('data-m')+(b.classList.contains('on')?'*':'');}).join(' '),
    switches:Object.keys(swEls).map(function(k){return k+'='+swEls[k].getAttribute('aria-checked');}).join(' '),soundOff:soundBtn.classList.contains('off'),
    games:save.games,runs:save.runs.length,top:save.top.length,drops:drops,live:!!save.live,tier:runBestTier,store:store.kind,
    FLOOR:FLOOR,BOXY:BOX.y,MAXV:MAXV,maxY:maxY,minY:minY,maxSpeed:maxSpeed,maxUp:maxUp};
};
})();`);

function boot(storeMap, opts) {
  const g = makeEnv(storeMap, opts);
  const fn = new Function('window', 'document', 'performance', 'navigator', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'clearInterval', 'fetch', src);
  fn(g.window, g.document, g.performance, g.navigator, g.requestAnimationFrame, g.setTimeout, g.setInterval, g.clearInterval, g.fetch);
  return g;
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }
function done(name) { console.log(name + ': ' + (failures ? failures + ' failure(s)' : 'all passed')); process.exit(failures ? 1 : 0); }

module.exports = { boot, settle, check, done, SEED };
