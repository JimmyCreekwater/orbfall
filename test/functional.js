// Runs are recorded, the scoreboard renders, undo (free + ad-gated) works, runs resume, reloads keep the save,
// the storage adapter works with localStorage alone (or nothing at all), the revive clears the smallest orbs
// at game over, once per run, free the first time and ad-gated after, marked on the board, and the feel pass
// (sprites, landing squash and dust, merge flash and overshoot, reveals, score roll, chain wash, slow motion,
// revive ghosts, the particle cap) works and switches itself off under prefers-reduced-motion.
'use strict';
const { boot, settle, check, done } = require('./env.js');
async function playToGameOver(g) {
  let i = 0; while (i < 30000 && g.dbg().state !== 'over') { g.step(16.67); i++; if (i % 30 === 10) g.tap(40 + Math.random() * 310); }
  return g.dbg();
}
(async () => {
  const store = new Map();
  let g = boot(store); await settle(); g.step(16.67);

  const over = await playToGameOver(g);
  check(over.state === 'over' && over.games === 1 && over.runs === 1 && over.top === 1, 'game over records exactly one run');

  g.fire('scores:click'); g.step(16.67);
  const scoreText = over.score.toLocaleString('en-US');
  check(g.dbg().paused === true, 'physics pause while the board is open');
  check(g.els.rows._html.includes(scoreText) && g.els.rows._html.includes('class="you"'), 'all-time board shows and highlights the run');
  g.fire('chips:click', { target: { getAttribute: () => 'day' } });
  check(g.els.rows._html.includes(scoreText), 'day filter includes the run');
  g.fire('chips:click', { target: { getAttribute: () => 'month' } });
  check(g.els.stats.textContent.indexOf('1 run') === 0, 'stats line reads "1 run…" (' + g.els.stats.textContent + ')');
  g.fire('close:click'); g.step(16.67);
  check(g.dbg().paused === false, 'board close unpauses');

  g.fire('undo2:click'); g.step(16.67);
  let d = g.dbg();
  check(d.state === 'play' && d.games === 0 && d.runs === 0 && d.undosFree === 0 && d.undosUsed === 1, 'free undo from game over restores play and unrecords the run');

  g.tap(180); g.step(16.67);
  check(g.dbg().snap === true, 'a drop creates an undo snapshot');
  g.fire('undo:click'); g.step(16.67);
  check(g.dbg().paused === true && g.els.adbox.classList.contains('show'), 'second undo is gated behind the ad placeholder');
  for (let k = 0; k < 200; k++) g.step(16.67);
  d = g.dbg();
  check(d.paused === false && d.undosUsed === 2 && !g.els.adbox.classList.contains('show'), 'placeholder ad completes and grants the undo');

  g.fire('undo:click'); g.step(16.67);
  if (g.els.adbox.classList.contains('show')) { g.fire('adcancel:click'); g.step(16.67); }
  check(g.dbg().paused === false && g.dbg().undosUsed === 2, 'cancelling the placeholder ad grants nothing');

  g.reset(); g.step(16.67);
  for (let k = 0; k < 400; k++) { g.step(16.67); if (k % 40 === 0) g.tap(100 + (k % 200)); }
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  const saved = JSON.parse(store.get('orbfall_v2'));
  check(saved.live && saved.live.b.length > 0, 'hiding the page flushes the in-progress run (' + (saved.live ? saved.live.b.length : 0) + ' orbs)');
  g = boot(store); await settle(); g.step(16.67);
  d = g.dbg();
  check(d.n === saved.live.b.length && d.score === saved.live.s && d.drops === saved.live.d, 'a reload restores the in-progress run');

  const finished = await playToGameOver(g); await settle();
  const s1 = JSON.parse(store.get('orbfall_v2'));
  g = boot(store); await settle(); g.step(16.67); await settle(); g.step(16.67);
  const s2 = JSON.parse(store.get('orbfall_v2'));
  check(s2.best === s1.best && s2.games === s1.games && s2.runs.length === s1.runs.length && g.dbg().games === s1.games, 'a reload after game over keeps best/history (best ' + s1.best + ')');

  g = boot(new Map(), { storage: false }); await settle(); g.step(16.67);
  await playToGameOver(g);
  check(g.dbg().games === 1, 'runs without window.storage still play and record in memory');

  // backlog #1, the storage adapter: a plain browser has only localStorage
  const ls = new Map();
  g = boot(new Map(), { storage: false, localStorage: ls }); await settle(); g.step(16.67);
  check(g.dbg().store === 'local', 'with only localStorage present the adapter picks it');
  await playToGameOver(g); await settle();
  let L = JSON.parse(ls.get('orbfall_v2') || 'null');
  check(L && L.games === 1 && L.runs.length === 1 && L.top.length === 1, 'game over is written to localStorage');
  g = boot(new Map(), { storage: false, localStorage: ls }); await settle(); g.step(16.67);
  check(g.dbg().games === 1 && g.dbg().state === 'play', 'a reload with only localStorage keeps the history');
  for (let k = 0; k < 400; k++) { g.step(16.67); if (k % 40 === 0) g.tap(100 + (k % 200)); }
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  L = JSON.parse(ls.get('orbfall_v2'));
  g = boot(new Map(), { storage: false, localStorage: ls }); await settle(); g.step(16.67);
  d = g.dbg();
  check(L.live && d.n === L.live.b.length && d.score === L.live.s && d.drops === L.live.d, 'a reload with only localStorage restores the in-progress run (' + d.n + ' orbs)');

  g = boot(new Map(), { storage: false, localStorage: new Map(), localStorageThrows: true }); await settle(); g.step(16.67);
  check(g.dbg().store === 'memory', 'localStorage that throws on write (Safari private mode) falls back to memory');
  await playToGameOver(g);
  check(g.dbg().games === 1, 'and the game still plays and records for the session');

  g = boot(new Map(), { localStorage: new Map() }); await settle();
  check(g.dbg().store === 'hosted', 'window.storage wins over localStorage when both exist');

  // backlog #3, revive: clears the smallest orbs at game over, once per run, the first one free then ad-gated
  const rs = new Map();
  g = boot(rs); await settle(); g.step(16.67);
  let o = await playToGameOver(g);
  const before = o.n, smallest = o.tiers.slice().sort((a, b) => a - b).slice(0, 8);
  check(o.state === 'over' && g.els.revive.disabled === false && !g.els.revive.classList.contains('ad'), 'at game over the revive is offered, free the first time');
  g.fire('revive:click'); g.step(16.67);
  d = g.dbg();
  const kept = d.tiers.slice().sort((a, b) => a - b);
  check(d.state === 'play' && d.games === 0 && d.n === before - Math.min(8, before), 'revive resumes the run, unrecords it and removes 8 orbs (' + before + ' -> ' + d.n + ')');
  check(kept.length === 0 || kept[0] >= smallest[smallest.length - 1], 'the removed orbs were the smallest ones');
  check(d.revivesUsed === 1 && d.revives === 1 && d.snap === false, 'revive counted for the run and for the lifetime total, undo snapshot cleared');
  check(g.els.revive.disabled === true, 'a second revive in the same run is not offered');
  g.fire('revive:click'); g.step(16.67);
  check(g.dbg().state === 'play' && g.dbg().revivesUsed === 1, 'revive during play is a no-op');
  o = await playToGameOver(g); await settle();
  let sv = JSON.parse(rs.get('orbfall_v2'));
  check(o.games === 1 && sv.runs[0].v === 1 && sv.top[0].v === 1 && sv.revives === 1, 'the finished run carries v=1 and the lifetime count is persisted');
  g.fire('scores:click'); g.step(16.67);
  check(g.els.rows._html.includes('\u21bb1'), 'the board marks the revived run');
  g.fire('close:click'); g.step(16.67);
  check(g.els.revive.disabled === true, 'the revive stays used up at the second game over of the run');

  g.fire('again:click'); g.step(16.67);
  await playToGameOver(g);
  check(g.els.revive.disabled === false && g.els.revive.classList.contains('ad'), 'next run: the revive is offered again, now ad-gated');
  g.fire('win:keydown', { key: 'r' }); g.step(16.67);
  check(g.dbg().paused === true && g.els.adbox.classList.contains('show') && g.dbg().state === 'over', 'the r key asks for the reward first');
  g.fire('adcancel:click'); g.step(16.67);
  check(g.dbg().state === 'over' && g.dbg().revivesUsed === 0 && g.dbg().revives === 1, 'cancelling the placeholder ad grants no revive');
  g.fire('revive:click'); g.step(16.67);
  for (let k = 0; k < 200; k++) g.step(16.67);
  d = g.dbg();
  check(d.state === 'play' && d.revivesUsed === 1 && d.revives === 2 && !g.els.adbox.classList.contains('show'), 'placeholder ad completes and grants the revive');
  for (let k = 0; k < 30; k++) g.step(16.67);
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  sv = JSON.parse(rs.get('orbfall_v2'));
  g = boot(rs); await settle(); g.step(16.67);
  check(sv.live && sv.live.v === 1 && g.dbg().revivesUsed === 1 && g.dbg().revives === 2, 'a reload restores the run with its revive already spent');

  // the feel pass
  g = boot(new Map()); await settle(); g.step(16.67);
  check(g.dbg().sprites === 11, 'one lit sprite per tier is built at boot');
  g.window.__burst(12); check(g.dbg().parts <= 420 && g.dbg().parts > 0, 'the particle cap holds under a burst (' + g.dbg().parts + ' particles)');
  g.window.__chain(); check(g.dbg().wash === true && g.dbg().floats.some(t => t === 'chain \u00d73'), 'a chain of three washes the box edge and floats the chain');
  g.reset(); for (let k = 0; k < 15; k++) g.step(16.67);   // let the first piece spawn before tapping
  g.tap(180); let landedAt = -1, dustAtLanding = 0;
  for (let k = 0; k < 120 && landedAt < 0; k++) { g.step(16.67); const q = g.dbg(); if (q.squashed > 0) { landedAt = k; dustAtLanding = q.parts; } }
  check(landedAt > 5 && dustAtLanding > 0, 'a dropped orb squashes and kicks up dust when it lands (frame ' + landedAt + ', ' + dustAtLanding + ' particles)');
  const seen = { flash: false, over: false, reveal: false, roll: false, slow: false };
  const allSeen = () => seen.flash && seen.over && seen.reveal && seen.roll && seen.slow;
  let ghostsOk = null, ghostsGone = null, mergeFrame = -99, lastN = g.dbg().n;
  for (let i = 0; i < 24000 && !(allSeen() && ghostsOk !== null); i++) {
    g.step(16.67);
    const q = g.dbg();
    if (q.state === 'over') {
      if (ghostsOk === null) { g.fire('revive:click'); ghostsOk = g.dbg().ghosts === 8; for (let k = 0; k < 40; k++) g.step(16.67); ghostsGone = g.dbg().ghosts === 0; }
      else { g.step(400); g.fire('again:click'); }
      lastN = 0; continue;
    }
    if (i % 30 === 10) g.tap(40 + Math.random() * 310);
    if (q.n < lastN) { mergeFrame = i; if (q.flashing > 0) seen.flash = true; }
    if (i - mergeFrame < 40 && q.maxScale > 1.03) seen.over = true;
    if (q.floats.some(t => ['Moon', 'Planet', 'Giant', 'Star', 'Nova', 'Sun'].includes(t))) seen.reveal = true;
    if (q.shown < q.score) seen.roll = true;
    if (q.warn > .6 && q.timeScale < .95) seen.slow = true;
    lastN = q.n;
  }
  check(seen.flash, 'a merged orb flashes white on the frame it is born');
  check(seen.over, 'a merged orb springs past full size before settling');
  check(seen.reveal, 'reaching a new tier floats its name');
  check(seen.roll, 'the score counter rolls towards the real score');
  check(seen.slow, 'time slows as the loss timer runs out');
  check(ghostsOk === true, 'a revive leaves eight shrinking ghosts where the orbs were');
  check(ghostsGone === true, 'the ghosts are gone within a second');

  g = boot(new Map(), { reduced: true }); await settle(); g.step(16.67);
  g.tap(180); let quiet = true; lastN = 0; let merged = false;
  for (let k = 0; k < 2400 && quiet; k++) {
    g.step(16.67); if (k % 30 === 10) g.tap(40 + Math.random() * 310);
    const q = g.dbg(); if (q.n < lastN) merged = true; lastN = q.n;
    if (q.parts > 0 || q.squashed > 0 || q.maxScale > 1.0001 || q.timeScale !== 1 || q.ghosts > 0) quiet = false;
    if (q.state === 'over') break;
  }
  check(quiet && merged, 'with prefers-reduced-motion nothing pops, squashes or spawns particles, and time never slows');

  // settings sheet and persisted options
  const os = new Map();
  g = boot(os); await settle(); g.step(16.67);
  let q = g.dbg();
  check(q.opt.mute === false && q.opt.sfx && q.opt.music && q.opt.haptics && q.opt.aim && q.opt.mode === 'casual', 'options default to everything on, casual mode');
  check(q.switches === 'music=true sfx=true haptics=true aim=true', 'the settings sheet shows four switches, all on');
  g.fire('scores:click'); g.step(16.67); g.fire('settings:click'); g.step(16.67); q = g.dbg();
  check(q.optsOpen && !q.boardOpen && q.paused === true, 'Settings opens from the scores sheet and pauses play');
  g.fire('optsclose:click'); g.step(16.67);
  check(g.dbg().optsOpen === false && g.dbg().paused === false, 'closing settings unpauses');
  for (let k = 0; k < 15; k++) g.step(16.67);
  g.tap(180); const vibesBefore = g.vibes.length;
  for (let k = 0; k < 90; k++) g.step(16.67);
  check(g.vibes.length > vibesBefore, 'with haptics on, a landing vibrates (' + (g.vibes.length - vibesBefore) + ' calls)');
  g.window.__setOpt('haptics', false); const vibesOff = g.vibes.length;
  for (let k = 0; k < 40; k++) g.step(16.67); g.tap(120); for (let k = 0; k < 90; k++) g.step(16.67);
  check(g.vibes.length === vibesOff, 'with haptics off, nothing vibrates');
  g.fire('sound:click', { stopPropagation() {} }); g.step(16.67); q = g.dbg();
  check(q.opt.mute === true && q.soundOff, 'the sound button is a master mute');
  g.window.__setOpt('aim', false); g.window.__setOpt('music', false); await settle();
  check(JSON.parse(os.get('orbfall_v2')).opt.aim === false, 'option changes are persisted at once');
  g = boot(os); await settle(); g.step(16.67); q = g.dbg();
  check(q.opt.mute && !q.opt.haptics && !q.opt.aim && !q.opt.music && q.soundOff && q.switches === 'music=false sfx=true haptics=false aim=false', 'a reload restores every option and the switches show them');
  os.set('orbfall_v2', JSON.stringify(Object.assign(JSON.parse(os.get('orbfall_v2')), { opt: { mute: 'yes', mode: 'turbo', sfx: false } })));
  g = boot(os); await settle(); g.step(16.67); q = g.dbg();
  check(q.opt.mute === false && q.opt.mode === 'casual' && q.opt.sfx === false, 'malformed option values fall back to defaults, valid ones are kept');

  // music: the sequencer is pure and the layers follow the run
  g = boot(new Map()); await settle(); g.step(16.67);
  const LM = g.window.__L, ev = (s, m, p) => g.window.__music(s, m, p || 0);
  check(ev(0, 0).length === 0 && ev(0, LM.bass).some(e => e.v === 'bass' && e.n === 45) && ev(0, LM.bass).some(e => e.v === 'kick'), 'bass on A2 and the kick are the floor of the track');
  check(!ev(4, LM.bass).some(e => e.v === 'snare') && ev(4, LM.bass | LM.drums).some(e => e.v === 'snare'), 'the snare arrives with the drums layer on beat two');
  check(!ev(0, LM.bass | LM.drums).some(e => e.v === 'lead') && ev(0, LM.bass | LM.drums | LM.lead).some(e => e.v === 'lead' && e.n === 81), 'the lead arrives with its layer and opens on A5');
  let arpOk = true, tenseOk = true, bassBars = new Set();
  for (let s = 0; s < 128; s++) { if (!ev(s, LM.arp).some(e => e.v === 'arp')) arpOk = false; if (!ev(s, LM.tense).some(e => e.v === 'tense')) tenseOk = false; ev(s, LM.bass).forEach(e => { if (e.v === 'bass') bassBars.add(e.n % 12); }); }
  check(arpOk && tenseOk, 'arp and tension layers hammer every sixteenth');
  check(bassBars.has(9) && bassBars.has(5) && bassBars.has(0) && bassBars.has(7), 'the bass walks the A minor, F, C, G progression');
  check(JSON.stringify(ev(66, LM.lead, 0)) !== JSON.stringify(ev(66, LM.lead, 1)) && JSON.stringify(ev(2, LM.lead, 0)) === JSON.stringify(ev(2, LM.lead, 1)), 'the second pass varies the lead in the back half only');
  check(g.window.__musicLayers() === LM.bass && g.dbg().music === false, 'a fresh run starts with bass only, and nothing plays without an audio context');
  let sawLead = false, sawTense = false, sawDrums = false;
  for (let i = 0; i < 12000 && g.dbg().state !== 'over'; i++) { g.step(16.67); if (i % 30 === 10) g.tap(40 + Math.random() * 310); const m = g.window.__musicLayers(); if (m & LM.lead) sawLead = true; if (m & LM.tense) sawTense = true; if (m & LM.drums) sawDrums = true; }
  check(sawDrums && sawLead && sawTense && g.window.__musicLayers() === 0, 'drums, lead and the tension line arrive as the run builds, and game over silences the layers');

  // Rush mode: a shot clock that tightens with score, mode-aware records and boards
  const rsv = new Map();
  g = boot(rsv); await settle(); g.step(16.67);
  check(g.window.__clockFor(0) === 3 && g.window.__clockFor(1500) === 2.25 && g.window.__clockFor(9000) === 1.5, 'the shot clock shrinks from 3 s to 1.5 s by 3,000 points');
  check(g.dbg().modeUI === 'casual* rush casual* rush', 'the mode pair on the card and in settings shows Casual');
  for (let k = 0; k < 400; k++) g.step(16.67);
  check(g.dbg().drops === 0 && g.dbg().runMode === 'casual', 'Casual never drops for you');
  g.window.__setOpt('mode', 'rush'); g.step(16.67);
  check(g.dbg().runMode === 'rush' && g.dbg().opt.mode === 'rush' && g.dbg().modeUI === 'casual rush* casual rush*', 'switching to Rush before the first drop applies to this run');
  let autoAt = -1; for (let k = 0; k < 300 && autoAt < 0; k++) { g.step(16.67); if (g.dbg().drops === 1) autoAt = k; }
  check(autoAt > 120 && autoAt < 240, 'Rush drops the piece for you when the clock runs out (frame ' + autoAt + ')');
  g.fire('scores:click'); g.step(16.67); const dropsAtOpen = g.dbg().drops; for (let k = 0; k < 300; k++) g.step(16.67);
  check(g.dbg().drops === dropsAtOpen, 'the clock pauses while a sheet is open');
  g.fire('close:click'); autoAt = -1; for (let k = 0; k < 300 && autoAt < 0; k++) { g.step(16.67); if (g.dbg().drops === dropsAtOpen + 1) autoAt = k; }
  check(autoAt > 0, 'and resumes when it closes');
  o = await playToGameOver(g); await settle();
  sv = JSON.parse(rsv.get('orbfall_v2'));
  check(sv.runs[sv.runs.length - 1].m === 'rush' && sv.modes.rush.games === 1 && sv.modes.casual.games === 0 && sv.modes.rush.best === o.score, 'a Rush run is recorded as Rush with its own best and count');
  g.fire('scores:click'); g.step(16.67);
  check(g.dbg().boardMode === 'rush' && g.els.rows._html.includes(o.score.toLocaleString('en-US')), 'the board opens on the mode being played and shows the run');
  g.fire('modechips:click', { target: { getAttribute: () => 'casual' } });
  check(g.els.rows._html.includes('No runs here yet'), 'the Casual board does not show Rush runs');
  g.fire('close:click'); g.step(16.67);
  g.fire('again:click'); g.step(16.67); for (let k = 0; k < 15; k++) g.step(16.67); g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67);
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  g = boot(rsv); await settle(); g.step(16.67);
  check(g.dbg().runMode === 'rush' && g.dbg().n >= 1 && g.dbg().clock > 0 && g.dbg().startBest === o.score, 'a live Rush run restores as Rush with a fresh clock and the Rush best');
  const legacy = new Map([['orbfall_v2', JSON.stringify({ best: 500, bestTier: 6, games: 2, sum: 800, top: [{ s: 500, t: 6, d: 1, u: 0 }], runs: [{ s: 500, t: 6, d: 1, u: 0 }, { s: 300, t: 5, d: 2, u: 0 }] })]]);
  g = boot(legacy); await settle(); g.step(16.67);
  check(g.dbg().modes.casual.best === 500 && g.dbg().modes.casual.games === 2 && g.dbg().modes.rush.games === 0 && g.dbg().startBest === 500, 'a save from before modes migrates into Casual');

  // safety net: a thrown error pauses the run behind a card and the restart clears it
  g = boot(new Map()); await settle(); for (let k = 0; k < 20; k++) g.step(16.67); g.tap(180); for (let k = 0; k < 10; k++) g.step(16.67);
  g.window.__breakRender(); for (let k = 0; k < 5; k++) g.step(16.67); q = g.dbg();
  check(q.faulted && q.faultShown && q.paused && q.n === 1 && q.faultCount >= 1, 'a throwing frame shows the fault card and pauses instead of killing the loop (' + q.faultCount + ' caught)');
  g.window.__fixRender(); g.fire('faultbtn:click'); g.step(16.67); q = g.dbg();
  check(!q.faulted && !q.faultShown && !q.paused && q.state === 'play' && q.n === 0, 'Restart run clears the fault and starts a fresh run');
  g.fire('win:error', { message: 'handler blew up' }); q = g.dbg();
  check(q.faulted && q.faultShown, 'an error outside the loop reaches the same card');

  done('functional');
})().catch(e => { console.error(e); process.exit(1); });
