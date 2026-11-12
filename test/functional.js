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
  const store = new Map(); let q;
  let g = boot(store); await settle(); g.step(16.67);

  const over = await playToGameOver(g);
  check(over.state === 'over' && over.games === 1 && over.runs === 1 && over.top === 1, 'game over records exactly one run');

  g.fire('scores:click'); g.step(16.67);
  const scoreText = over.score.toLocaleString('en-US');
  check(g.dbg().paused === true, 'physics pause while the board is open');
  check(g.els.rows._html.includes(scoreText) && g.els.rows._html.includes('class="you"'), 'all-time board shows and highlights the run');
  check(g.els.rows._html.includes('<b class="pn">You') && g.els.rows._html.includes('class="pt">' + scoreText + '<') && g.els.rows._html.includes('<span>just now</span>'), 'a row carries the name, the score and the moment of scoring');
  g.fire('chips:click', { target: { getAttribute: () => 'day' } });
  check(g.els.rows._html.includes(scoreText), 'day filter includes the run');
  g.fire('chips:click', { target: { getAttribute: () => 'month' } });
  check(g.els.stats.textContent.indexOf('1 run') === 0, 'stats line reads "1 run…" (' + g.els.stats.textContent + ')');
  g.fire('close:click'); g.step(16.67);
  check(g.dbg().paused === false, 'board close unpauses');

  g.fire('revive:click'); g.fire('r1:click'); g.step(16.67);
  let d = g.dbg();
  check(d.state === 'play' && d.games === 0 && d.runs === 0 && d.undosFree === 0 && d.undosUsed === 1, 'free undo from game over restores play and unrecords the run');

  g.tap(180); g.step(16.67);
  check(g.dbg().snap === true, 'a drop creates an undo snapshot');
  g.fire('undo:click'); g.step(16.67);
  check(g.dbg().paused === true && g.els.rwbox.classList.contains('show'), 'second undo is gated behind the ad placeholder');
  for (let k = 0; k < 200; k++) g.step(16.67);
  d = g.dbg();
  check(d.paused === false && d.undosUsed === 2 && !g.els.rwbox.classList.contains('show'), 'placeholder ad completes and grants the undo');

  g.fire('undo:click'); g.step(16.67);
  if (g.els.rwbox.classList.contains('show')) { g.fire('rwno:click'); g.step(16.67); }
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
  g.fire('revive:click'); q = g.dbg();
  check(o.state === 'over' && q.rescueOn && q.rescue.split('|')[3] === 'Free', 'at game over the rescue chooser offers the clear, free the first time (' + q.rescue + ')');
  g.fire('rclear:click'); g.step(16.67);
  d = g.dbg();
  const kept = d.tiers.slice().sort((a, b) => a - b);
  check(d.state === 'play' && d.games === 0 && d.n === before - Math.min(8, before), 'revive resumes the run, unrecords it and removes 8 orbs (' + before + ' -> ' + d.n + ')');
  check(kept.length === 0 || kept[0] >= smallest[smallest.length - 1], 'the removed orbs were the smallest ones');
  check(d.revivesUsed === 1 && d.revives === 1 && d.snap === false, 'revive counted for the run and for the lifetime total, undo snapshot cleared');
  check(g.dbg().reviveLeft === false && !g.dbg().rescueOn, 'a second revive in the same run is not offered and the chooser closed');
  g.fire('revive:click'); g.step(16.67);
  check(g.dbg().state === 'play' && g.dbg().revivesUsed === 1, 'revive during play is a no-op');
  o = await playToGameOver(g); await settle();
  let sv = JSON.parse(rs.get('orbfall_v2'));
  check(o.games === 1 && sv.runs[0].v === 1 && sv.top[0].v === 1 && sv.revives === 1, 'the finished run carries v=1 and the lifetime count is persisted');
  g.fire('scores:click'); g.step(16.67);
  check(g.els.rows._html.includes('\u21bb1'), 'the board marks the revived run');
  g.fire('close:click'); g.step(16.67);
  g.fire('revive:click'); check(g.dbg().rescue.split('|')[3] === 'Used(off)', 'the clear stays used up at the second game over of the run'); g.fire('rescueback:click');

  g.fire('again:click'); g.step(16.67);
  await playToGameOver(g);
  g.fire('revive:click'); check(g.dbg().rescue.split('|')[3] === 'Ad', 'next run: the clear is offered again, now ad-gated'); g.fire('rescueback:click');
  g.fire('win:keydown', { key: 'r' }); g.step(16.67);
  check(g.dbg().paused === true && g.els.rwbox.classList.contains('show') && g.dbg().state === 'over', 'the r key asks for the reward first');
  g.fire('rwno:click'); g.step(16.67);
  check(g.dbg().state === 'over' && g.dbg().revivesUsed === 0 && g.dbg().revives === 1, 'cancelling the placeholder ad grants no revive');
  g.fire('revive:click'); g.fire('rclear:click'); g.step(16.67);
  for (let k = 0; k < 300; k++) g.step(16.67);
  d = g.dbg();
  check(d.state === 'play' && d.revivesUsed === 1 && d.revives === 2 && !g.els.rwbox.classList.contains('show'), 'placeholder ad completes and grants the revive');
  for (let k = 0; k < 30; k++) g.step(16.67);
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  sv = JSON.parse(rs.get('orbfall_v2'));
  g = boot(rs); await settle(); g.step(16.67);
  check(sv.live && sv.live.v === 1 && g.dbg().revivesUsed === 1 && g.dbg().revives === 2, 'a reload restores the run with its revive already spent');

  // the feel pass
  g = boot(new Map()); await settle(); g.step(16.67);
  check(g.dbg().sprites === 12, 'one painted surface per tier plus the brass orb of the wordmark is built at boot');
  check(g.dbg().baked, 'and with them the shared shading, the contact shadow, the three halos, the corona and the black hole');
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
      if (ghostsOk === null) { g.fire('revive:click'); g.fire('rclear:click'); ghostsOk = g.dbg().ghosts === 8; for (let k = 0; k < 40; k++) g.step(16.67); ghostsGone = g.dbg().ghosts === 0; }
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
  q = g.dbg();
  check(q.opt.mute === false && q.opt.sfx && q.opt.music && q.opt.haptics && q.opt.aim && q.opt.mode === 'casual', 'options default to everything on, casual mode');
  check(q.switches === 'music=true sfx=true haptics=true aim=true online=true', 'the settings sheet shows five switches, all on');
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
  check(q.opt.mute && !q.opt.haptics && !q.opt.aim && !q.opt.music && q.soundOff && q.switches === 'music=false sfx=true haptics=false aim=false online=true', 'a reload restores every option and the switches show them');
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
  check(g.dbg().modeUI === 'casual* rush casual* rush casual* rush', 'the mode pair on the card, in settings and on the menu shows Casual');
  for (let k = 0; k < 15; k++) g.step(16.67); g.tap(180); for (let k = 0; k < 400; k++) g.step(16.67);
  check(g.dbg().drops === 1 && g.dbg().runMode === 'casual', 'Casual never drops for you');
  g.reset(); g.step(16.67);   // a fresh run without the title moment, before its first drop
  g.window.__setOpt('mode', 'rush'); g.step(16.67);
  check(g.dbg().runMode === 'rush' && g.dbg().opt.mode === 'rush' && g.dbg().modeUI === 'casual rush* casual rush* casual rush*', 'switching to Rush before the first drop applies to this run');
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

  // share, landscape hint, install nudge
  const iv = new Map();
  g = boot(iv); await settle(); g.step(16.67);
  o = await playToGameOver(g);
  g.fire('send:click'); await settle();
  check(g.shares.length === 1 && g.shares[0].title === 'Orbfall' && g.shares[0].text.includes(o.score.toLocaleString('en-US')) && !g.shares[0].url, 'Share hands the score to the system share sheet (no link when there is no http address)');
  check(g.dbg().installShown === false && g.dbg().iosHintShown === false, 'no install nudge after one run');
  g.fire('win:beforeinstallprompt', { preventDefault() {}, prompt() { g.prompted = true; } });
  g.fire('again:click'); g.step(16.67); await playToGameOver(g); g.step(16.67);
  check(g.dbg().installShown === true, 'after two runs the Android install prompt is offered on the card');
  g.fire('install:click');
  check(g.prompted === true && g.dbg().installShown === false, 'tapping it shows the browser prompt and the button goes away');
  g.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)';
  g.fire('again:click'); g.step(16.67); await playToGameOver(g); g.step(16.67);
  check(g.dbg().iosHintShown === true, 'on an iPhone with no prompt, the Home Screen hint appears instead');
  g.fire('iosok:click'); await settle();
  check(g.dbg().iosHintShown === false && JSON.parse(iv.get('orbfall_v2')).hintedInstall === true, 'Got it hides the hint for good');
  g.fire('again:click'); for (let k = 0; k < 20; k++) g.step(16.67);
  g.window.innerWidth = 800; g.window.innerHeight = 400; g.window.ontouchstart = null; g.fire('win:resize'); g.step(16.67);
  const dropsBefore = g.dbg().drops; g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); q = g.dbg();
  check(q.rotated && q.rotateShown && q.drops === dropsBefore, 'a phone held sideways sees the turn-upright card and drops are ignored');
  g.window.innerWidth = 390; g.window.innerHeight = 844; g.fire('win:resize'); g.step(16.67);
  g.tap(180); g.step(16.67); q = g.dbg();
  check(!q.rotated && !q.rotateShown && q.drops === dropsBefore + 1, 'turning back resumes play');

  // online board: off until connected, then best-per-player submissions and a shared top list
  const ob = new Map();
  g = boot(ob); await settle(); g.step(16.67);
  check(/^[a-f0-9]{16}$/.test(g.dbg().cid), 'a random player id is made on first load');
  check(g.window.__cleanName("<b>Jim!!</b> the great one") === 'bJimb the gr', 'names are stripped to safe characters and twelve letters');
  g.fire('scores:click'); g.step(16.67); g.fire('modechips:click', { target: { getAttribute: () => 'online' } });
  check(g.dbg().boardOnline === true && g.els.rows._html.includes('not connected'), 'without a board address the Online tab says so');
  g.window.__setBoard('https://board.test/'); g.fire('modechips:click', { target: { getAttribute: () => 'online' } });
  check(g.els.rows._html.includes('Add a name'), 'with a board but no name it asks for one');
  g.fire('close:click'); g.step(16.67);
  g.window.__setOpt('name', 'Jim'); await settle();
  check(g.dbg().onlineOn && g.fetchLog.length === 0, 'nothing is sent before a run is finished');
  o = await playToGameOver(g); await settle(); await settle();
  let post = g.fetchLog.find(f => f.url === 'https://board.test/score'), body = post && JSON.parse(post.init.body);
  check(post && post.init.method === 'POST' && body.mode === 'casual' && body.name === 'Jim' && body.score === o.score && body.cid === g.dbg().cid, 'a finished run posts the best score with the name and the player id');
  check(body.u === 0 && body.v === 0 && body.seed === null, 'and the badges and seed of that run ride along (none here)');
  sv = JSON.parse(ob.get('orbfall_v2'));
  check(sv.sent.casual === o.score && sv.cid === body.cid && g.dbg().floats.some(t => t.indexOf('Online rank') === 0), 'what was sent is remembered and the rank is announced');
  const cid = body.cid;
  g.fetchReply = (url) => url.indexOf('/top?mode=casual') >= 0 ? { status: 200, body: { rows: [{ cid: 'ffffffffffffffff', name: 'Ada <b>', score: 9000, tier: 8, seed: 'K7Q2ZD', u: 3, v: 1, ts: Date.now() - 3 * 86400000 }, { cid, name: 'Jim', score: o.score, tier: 5, ts: Date.now() }] } } : url.indexOf('/top') >= 0 ? { status: 500, body: { error: 'server' } } : { status: 200, body: { ok: true, rank: 2 } };
  g.fire('scores:click'); g.step(16.67);
  check(g.dbg().boardOnline === true, 'connected and named, the sheet opens on Online ranking without a tap');
  await settle(); await settle();
  const rows = g.els.rows._html;
  check(rows.includes('Ada') && rows.includes('class="you"') && rows.indexOf('Ada') < rows.indexOf('Jim'), 'the Online ranking lists the shared top with your own row highlighted');
  const srcLabels = g.els.srcchips.children.map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|');
  const hidden = f => (g.els.chips.children.find(b => b.getAttribute('data-f') === f) || {}).style.display === 'none';
  check(srcLabels === 'My scores|Online ranking*' && hidden('day') && hidden('week') && hidden('month') && !hidden('today') && !hidden('all'), 'the source pair reads My scores / Online ranking, and the rolling windows hide under the ranking (' + srcLabels + ')');
  g.fire('chips:click', { target: { getAttribute: () => 'week' } }); await settle();
  check(g.dbg().filter === 'all', 'a rolling window asked for while online falls back to All');
  g.fire('srcchips:click', { target: { getAttribute: (k) => k === 'data-src' ? 'local' : null } }); g.step(16.67);
  check(!g.dbg().boardOnline && !hidden('week') && g.els.srcchips.children[0].classList.contains('on'), 'My scores brings the windows back');
  g.fire('modechips:click', { target: { getAttribute: () => 'online' } }); await settle(); await settle();
  check(rows.includes('<b class="pn">Ada &lt;b&gt;<small class="bd">↶3 ↻1</small></b>') && rows.includes('<span>seed K7Q2ZD</span>') && rows.includes('class="pt">9,000<') && !rows.includes('class="you"><span class="rk">1<') && (rows.match(/class="clean"/g) || []).length === 1, 'online rows show the escaped name, the badges, the seed and the score; the clean badge only where no rescue was used');
  check(/<span>[A-Z][a-z]{2} \d{1,2}<\/span>/.test(rows), 'a score older than a day shows its date');
  g.fire('modechips:click', { target: { getAttribute: () => 'rush' } }); await settle(); await settle();
  check(g.els.rows._html.includes('Could not reach'), 'a failing board shows a message instead of breaking');
  g.fire('close:click'); g.step(16.67);
  const postsBefore = g.fetchLog.filter(f => f.url.endsWith('/score')).length;
  g.fire('again:click'); g.step(16.67); await playToGameOver(g); await settle(); await settle();
  const postsAfter = g.fetchLog.filter(f => f.url.endsWith('/score')).length;
  check(g.dbg().score <= o.score ? postsAfter === postsBefore : postsAfter === postsBefore + 1, 'a lower run posts nothing, a new best posts once');
  g.window.__setOpt('online', false); g.fire('scores:click'); g.step(16.67); g.fire('modechips:click', { target: { getAttribute: () => 'online' } });
  check(g.els.rows._html.includes('Turn on the online board'), 'switching the board off in settings stops it');

  // identity: the wordmark glyphs, the card mark, and the title moment on a fresh start
  const wm = g.window.__wm();
  check(['r', 'b', 'f', 'a', 'l'].every(k => wm[k].length === 7 && wm[k].every(row => row.length === 5)), 'the wordmark has five glyphs of 5 by 7 pixels');
  const svg = g.window.__wmSvg(3);
  check(svg.startsWith('<svg') && (svg.match(/<rect /g) || []).length > 60 && svg.includes('<circle') && g.els.wm._html === g.window.__wmSvg(3, 'o') && g.els.wmhome._html.startsWith('<svg') && g.els.wmpause._html === g.window.__wmSvg(3, 'p') && g.els.wmname._html.includes('id="wmgn"') && g.els.wm._html !== g.els.wmpause._html, 'the card, the menu, the pause sheet and the name card carry the mark as inline SVG, each with its own gradient id');

  // home menu and pause sheet: cold launches, Play / Continue / New run / Play today, the mark as the pause button
  const hm = new Map();
  g = boot(hm, { home: true }); await settle(); g.step(16.67); q = g.dbg();
  check(q.homeOn && q.paused && q.playLabel === 'Play' && !q.newRunShown && q.todayLabel.indexOf('Play today ') === 0, 'a cold launch opens the home menu on Play');
  for (let k = 0; k < 15; k++) g.step(16.67); g.tap(180); g.step(16.67);
  check(g.dbg().drops === 0, 'taps do nothing behind the menu');
  g.fire('play:click'); g.step(16.67); q = g.dbg();
  check(!q.homeOn && !q.paused && q.state === 'play' && q.seed === null, 'Play starts a free run');
  for (let k = 0; k < 15; k++) g.step(16.67); g.tap(180); for (let k = 0; k < 20; k++) g.step(16.67);
  const mark = () => g.fire('c:pointerdown', { clientX: g.dbg().offX + 180 * g.dbg().scl, clientY: g.dbg().offY + 40 * g.dbg().scl, pointerId: 1 });
  mark(); g.step(16.67); q = g.dbg();
  check(q.pauseOn && q.paused && q.drops === 1, 'tapping the mark pauses behind a sheet instead of dropping');
  g.fire('resume:click'); g.step(16.67);
  check(!g.dbg().pauseOn && !g.dbg().paused, 'Continue resumes');
  mark(); g.fire('pausescores:click'); g.step(16.67);
  check(g.dbg().boardOpen && g.dbg().paused, 'Scores opens over the pause sheet');
  g.fire('close:click'); g.step(16.67);
  check(g.dbg().pauseOn && g.dbg().paused && !g.dbg().boardOpen, 'Done returns to the pause sheet, still paused');
  g.fire('pausehome:click'); g.step(16.67); q = g.dbg();
  check(q.homeOn && !q.pauseOn && q.paused && q.playLabel === 'Continue' && q.newRunShown, 'Home from the pause sheet shows Continue and New run for the live run');
  g.fire('homesettings:click'); g.step(16.67); check(g.dbg().optsOpen && g.dbg().paused, 'Settings opens over the menu');
  g.fire('optsclose:click'); g.step(16.67); check(g.dbg().homeOn && g.dbg().paused, 'and closing it leaves the menu up and the game paused');
  g.fire('play:click'); g.step(16.67);
  check(!g.dbg().homeOn && !g.dbg().paused && g.dbg().drops === 1, 'Continue keeps the run');
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  g = boot(hm, { home: true }); await settle(); g.step(16.67); q = g.dbg();
  check(q.homeOn && q.playLabel === 'Continue' && q.n >= 1, 'a relaunch with a saved run offers Continue');
  g.fire('newrun:click'); g.step(16.67);
  check(!g.dbg().homeOn && g.dbg().drops === 0 && g.dbg().n === 0, 'New run starts over');
  const todayNow = g.window.__daily(new Date().getUTCFullYear() + '-' + (new Date().getUTCMonth() + 1) + '-' + new Date().getUTCDate());
  mark(); g.fire('pausehome:click'); g.fire('today:click'); g.step(16.67); q = g.dbg();
  check(!q.homeOn && q.seed === todayNow, 'Play today starts a run on the daily seed');
  mark(); g.fire('restart:click'); g.step(16.67); q = g.dbg();
  check(!q.pauseOn && !q.paused && q.drops === 0 && q.seed === todayNow, 'Restart starts the same seed over');
  g.fire('win:keydown', { key: 'Escape' }); check(g.dbg().pauseOn, 'Escape pauses'); g.fire('win:keydown', { key: 'Escape' }); check(!g.dbg().pauseOn, 'and unpauses');
  g = boot(new Map(), { home: true, location: { hash: '#s=abcdef&m=rush', protocol: 'https:', href: 'https://orb.test/#s=abcdef', pathname: '/', search: '' } }); await settle(); g.step(16.67);
  check(!g.dbg().homeOn && g.dbg().seed === 'ABCDEF', 'a challenge link skips the menu and goes straight into its run');
  await playToGameOver(g); g.fire('home2:click'); q = g.dbg();
  check(q.homeOn && q.playLabel === 'Play' && !q.newRunShown, 'Home from the card offers a new run');
  g.fire('play:click'); g.step(16.67); check(g.dbg().state === 'play' && g.dbg().seed === null, 'and Play there starts fresh');

  // transitions and ambient life: the swept board, the counting score, the new-best burst, motes and twinkle
  g = boot(new Map()); await settle(); g.step(16.67);
  q = g.dbg();
  check(q.motes === 14 && q.sky === 14, 'fourteen motes and fourteen twinkling stars live in the pocket');
  const moteY0 = q.moteY; for (let k = 0; k < 30; k++) g.step(16.67);
  check(g.dbg().moteY !== moteY0, 'the motes drift');
  o = await playToGameOver(g);
  check(g.dbg().fs === '0' && g.dbg().pbPulse === true && g.dbg().parts >= 60 && g.dbg().chaincap.indexOf('Reached ') === 0, 'the card opens on 0 with the new-best label pulsing, a gold burst behind it, and the sizes captioned (' + g.dbg().chaincap + ')');
  for (let k = 0; k < 70; k++) g.step(16.67);
  check(g.dbg().fs === o.score.toLocaleString('en-US'), 'the score counts up to the real number');
  const orbsBefore = g.dbg().n;
  g.fire('again:click'); q = g.dbg();
  check(q.n === 0 && q.fallingGhosts === orbsBefore && orbsBefore > 0, 'Play again sends the old board falling away (' + orbsBefore + ' orbs)');
  for (let k = 0; k < 90; k++) g.step(16.67);
  check(g.dbg().ghosts === 0, 'and it is gone within a second and a half');
  g = boot(new Map(), { reduced: true }); await settle(); g.step(16.67);
  const my0 = g.dbg().moteY; for (let k = 0; k < 30; k++) g.step(16.67);
  await playToGameOver(g); q = g.dbg();
  check(g.dbg().moteY === my0 && q.fs !== '0' && q.parts === 0, 'under reduced motion the motes hold still, the score lands at once and nothing bursts');
  g.fire('again:click');
  check(g.dbg().fallingGhosts === 0, 'and the board clears without the sweep');

  // seeds: one code, one sequence; undo and restore keep it; links start it; the daily is stable; Today lists it
  const sd = new Map();
  g = boot(sd); await settle(); g.step(16.67);
  const P = (s, n) => g.window.__pieces(s, n).join('');
  check(P('K7Q2ZD', 12) === P('K7Q2ZD', 12) && P('K7Q2ZD', 12) !== P('K7Q2ZE', 12) && /^[0-4]+$/.test(P('K7Q2ZD', 12)), 'a seed fixes the piece sequence, another seed changes it, and every piece is a spawnable tier');
  const daily = g.window.__daily('2026-09-25');
  check(/^[A-HJKMNP-TV-Z2-9]{6}$/.test(daily) && daily === g.window.__daily('2026-09-25') && daily !== g.window.__daily('2026-09-26'), 'the daily seed is six safe letters, stable for a date and different the next day (' + daily + ')');
  g.window.__setSeed('K7Q2ZD'); g.reset(); for (let k = 0; k < 15; k++) g.step(16.67);
  const dealt = []; for (let d = 0; d < 6; d++) { dealt.push(g.dbg().curT); g.tap(60 + d * 40); for (let k = 0; k < 30; k++) g.step(16.67); }
  check(g.dbg().seed === 'K7Q2ZD' && dealt.join('') === P('K7Q2ZD', 6), 'a seeded run deals the pieces in order (' + dealt.join('') + ')');
  g.fire('undo:click'); g.step(16.67); q = g.dbg();
  check(q.curT === g.window.__pieces('K7Q2ZD', 7)[5] && q.nxtT === g.window.__pieces('K7Q2ZD', 7)[6] && q.seqN === 7, 'undo hands back the same piece and the same next piece');
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  g = boot(sd); await settle(); g.step(16.67); q = g.dbg();
  check(q.seed === 'K7Q2ZD' && q.seqN === 7 && q.n >= 1, 'a restored run keeps its seed and its place in the sequence');
  g = boot(new Map(), { location: { hash: '#s=abcdef&m=rush', protocol: 'https:', href: 'https://orb.test/play/#s=abcdef&m=rush', pathname: '/play/', search: '' } }); await settle(); g.step(16.67); q = g.dbg();
  check(q.seed === 'ABCDEF' && q.runMode === 'rush' && q.opt.mode === 'casual' && g.replaced === '/play/', 'a challenge link starts a Rush run on its seed without changing the saved mode, and the link is cleared');
  g.fire('challenge:click'); await settle();
  check(g.shares.length === 1 && g.shares[0].url === 'https://orb.test/play/#s=ABCDEF&m=rush' && g.shares[0].text.includes('ABCDEF'), 'Challenge shares the seed as a link');
  const dl = new Map();
  g = boot(dl); await settle(); g.step(16.67);
  g.window.__setSeed(g.window.__daily(new Date().getUTCFullYear() + '-' + (new Date().getUTCMonth() + 1) + '-' + new Date().getUTCDate())); g.reset(); g.step(16.67);
  o = await playToGameOver(g); await settle();
  sv = JSON.parse(dl.get('orbfall_v2'));
  check(sv.runs[0].sd === g.dbg().seed && sv.runs[0].sd.length === 6, 'a run on today’s seed is recorded with the seed');
  g.fire('scores:click'); g.step(16.67); g.fire('chips:click', { target: { getAttribute: () => 'today' } });
  check(g.dbg().filter === 'today' && g.els.rows._html.includes(o.score.toLocaleString('en-US')), 'the Today board shows it');
  g.fire('close:click'); g.step(16.67); g.window.__setSeed(null); g.fire('again:click'); g.step(16.67);
  await playToGameOver(g); await settle(); const free = g.dbg().score;
  g.fire('scores:click'); g.step(16.67); g.fire('chips:click', { target: { getAttribute: () => 'today' } });
  check(!g.els.rows._html.includes('>' + free.toLocaleString('en-US') + '<') || free === o.score, 'a free run does not land on the Today board');
  g.fire('close:click'); g.step(16.67); g.fire('challenge:click'); await settle(); q = g.dbg();
  check(q.activeSeed && q.activeSeed.length === 6 && g.shares[g.shares.length - 1].text.includes(q.activeSeed) && q.floats.some(t => t.indexOf('Next run plays seed') === 0), 'Challenge after a free run makes a seed for the next run and shares it');

  // rescue chooser: a ten-move snapshot ring, undo 5 for an ad, undo 10 for two, each once per run, and the clean badge
  const rq = new Map();
  g = boot(rq); await settle(); g.step(16.67);
  for (let k = 0; k < 15; k++) g.step(16.67);
  for (let d = 0; d < 12; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  check(g.dbg().snaps === 10 && g.dbg().drops === 12, 'the ring keeps the last ten pre-drop snapshots');
  o = await playToGameOver(g);
  g.fire('revive:click'); q = g.dbg();
  check(q.rescueOn && q.paused && q.rescue === 'Free|Ad|2 ads|Free', 'the chooser lists undo 1 free, undo 5 for an ad, undo 10 for two, and the clear free (' + q.rescue + ')');
  const dropsAtOver = q.drops;
  g.fire('r5:click'); g.step(16.67);
  check(!g.dbg().rescueOn && g.els.rwbox.classList.contains('show') && g.dbg().adk === '', 'Undo 5 asks for one ad');
  for (let k = 0; k < 400; k++) g.step(16.67); q = g.dbg();
  check(q.state === 'play' && q.drops === dropsAtOver - 5 && q.undosUsed === 5 && q.used5 && q.rescueLeft === 1, 'after the ad five moves are undone, one rescue left');
  for (let d = 0; d < 6; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  await playToGameOver(g); g.fire('revive:click'); q = g.dbg();
  check(q.rescue.split('|')[1] === 'Used(off)' && q.rescue.split('|')[2] === '2 ads', 'undo 5 is spent for this run, undo 10 still offered');
  const dropsAtOver2 = q.drops;
  g.fire('r10:click'); g.step(16.67);
  check(g.els.rwbox.classList.contains('show') && g.dbg().adk === 'Ad 1 of 2', 'Undo 10 asks for two ads, counted on the placeholder');
  for (let k = 0; k < 330; k++) g.step(16.67);
  check(g.els.rwbox.classList.contains('show') && g.dbg().adk === 'Ad 2 of 2' && g.dbg().state === 'over', 'the second ad follows the first before anything is granted');
  g.fire('rwno:click'); g.step(16.67); q = g.dbg();
  check(q.state === 'over' && !q.used10 && q.drops === dropsAtOver2, 'cancelling the second ad grants nothing');
  g.fire('revive:click'); g.fire('r10:click'); for (let k = 0; k < 700; k++) g.step(16.67); q = g.dbg();
  check(q.state === 'play' && q.drops === dropsAtOver2 - 10 && q.used10 && q.undosUsed === 15 && q.rescueLeft === 0, 'two full ads undo ten moves, and that was the second rescue');
  await playToGameOver(g); await settle(); q = g.dbg();
  check(q.rescueBtn === 'No rescues left(off)' && q.rescueCap === 'Both rescues used this run', 'after two rescues the card says so and the button is crossed out');
  g.fire('scores:click'); g.step(16.67);
  check(!g.els.rows._html.includes('class="clean"') && g.els.rows._html.includes('↶15'), 'a rescued run carries no clean badge, only its undo count');
  g.fire('close:click'); g.step(16.67); g.fire('again:click'); g.step(16.67);
  await playToGameOver(g); await settle(); q = g.dbg();
  check(q.cleanShown, 'a run finished without rescues shows Clean run on the card');
  g.fire('scores:click'); g.step(16.67);
  check((g.els.rows._html.match(/class="clean"/g) || []).length === 1, 'and wears the badge on the board');

  // names: clearly offensive words are refused, ordinary words that contain them are not
  const ok = g.window.__nameOK;
  check(ok('Glass') && ok('Cassandra') && ok('Scunthorpe') && ok('assassin') && ok('Dick') && ok('Grape Nuts') && ok('Kumar'), 'ordinary names pass, including ones that contain a swear as letters');
  check(!ok('Ass') && !ok('sh1t') && !ok('F u c k') && !ok('fuckface') && !ok('Nigger') && !ok('b1tch') && !ok('SLUT99') && !ok('cunt'), 'clear swears and slurs are refused, with leetspeak and spacing undone');
  const nb = new Map();
  g = boot(nb, { home: true, nameGate: true, location: { hash: '', protocol: 'https:', href: 'https://orb.test/', pathname: '/', search: '' } }); await settle(); g.step(16.67); q = g.dbg();
  check(q.nameOn && !q.homeOn && q.paused, 'a first launch asks for a name before the menu');
  g.els.namein.value = 'Ass'; g.fire('namego:click'); q = g.dbg();
  check(q.nameOn && q.nameWarn === 'Pick another name.', 'an offensive name is refused with a hint');
  g.els.namein.value = ''; g.fire('namego:click'); check(g.dbg().nameWarn === 'A name, please.', 'an empty name is refused');
  g.els.namein.value = 'Glass'; g.fire('namego:click'); await settle(); q = g.dbg();
  check(!q.nameOn && q.homeOn && q.opt.name === 'Glass' && JSON.parse(nb.get('orbfall_v2')).opt.name === 'Glass', 'Glass passes, is saved, and the menu opens');
  g = boot(nb, { home: true, nameGate: true, location: { hash: '', protocol: 'https:', href: 'https://orb.test/', pathname: '/', search: '' } }); await settle(); g.step(16.67);
  check(!g.dbg().nameOn && g.dbg().homeOn, 'a later launch with a name goes straight to the menu');
  check(!g.els.namekeep.classList.contains('show'), 'in an ordinary browser the gate carries no storage warning');
  const nk = boot(new Map(), { home: true, nameGate: true, storage: false, localStorage: new Map(), localStorageThrows: true }); await settle(); nk.step(16.67);
  check(nk.dbg().nameOn && nk.dbg().store === 'memory' && nk.els.namekeep.classList.contains('show') && nk.els.namekeep.textContent.indexOf('blocking site storage') > 0, 'with storage blocked the gate says the name cannot be kept');
  const ia = boot(new Map(), { home: true, nameGate: true }); ia.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Instagram 400.0'; await settle(); ia.step(16.67);
  check(ia.dbg().nameOn && ia.els.namekeep.classList.contains('show') && ia.els.namekeep.textContent.indexOf('inside another app') > 0, 'inside another app’s browser the gate says to open the real browser');

  // seeds by hand: the box opens on today, Random makes a code, typed seeds are cleaned, and the run plays it
  const daily2 = g.window.__daily(new Date().getUTCFullYear() + '-' + (new Date().getUTCMonth() + 1) + '-' + new Date().getUTCDate());
  g.fire('seedother:click'); q = g.dbg();
  check(q.seedBoxOn && q.paused && q.seedIn === daily2, 'Other seed opens a box preset to today');
  g.fire('seedrandom:click'); q = g.dbg();
  check(/^[A-HJKMNP-TV-Z2-9]{6}$/.test(q.seedIn) && q.seedIn !== daily2, 'Random fills a fresh six-letter code');
  g.els.seedin.value = ''; g.fire('seedgo:click'); check(g.dbg().seedBoxOn && g.dbg().floats.some(t => t.indexOf('Type a seed') === 0), 'an empty seed is not played');
  g.els.seedin.value = 'pizza 42!'; g.fire('seedgo:click'); g.step(16.67); q = g.dbg();
  check(!q.seedBoxOn && !q.homeOn && q.seed === 'PIZZA42' && q.state === 'play', 'a typed seed is cleaned to letters and digits and the run starts on it');
  check(g.window.__cleanSeed('  hello-world.2026  ') === 'HELLOWORLD20', 'seeds are uppercased and cut to twelve');

  // share box: without a share sheet, Share and Challenge show the text with a Copy button
  delete g.navigator.share;
  g.fire('send:click'); q = g.dbg();
  check(q.shareOn && q.paused && q.shareText.indexOf('I scored') === 0 && q.shareText.includes('PIZZA42'), 'Share without a share sheet opens the text box');
  g.fire('sendcopy:click'); await settle(); q = g.dbg();
  check(g.copied === q.shareText && !q.shareOn, 'Copy puts the text on the clipboard and closes the box');
  g.fire('challenge:click'); q = g.dbg();
  check(q.shareOn && q.shareText.includes('seed PIZZA42') && q.shareText.includes('#s=PIZZA42'), 'Challenge does the same with the seed link');
  g.fire('senddone:click'); check(!g.dbg().shareOn && !g.dbg().paused, 'Done closes it');

  // the seed board: a seeded run posts to the seed table, the Seed and Today chips read from it
  const sb = new Map();
  g = boot(sb); await settle(); g.step(16.67);
  g.window.__setBoard('https://board.test/'); g.window.__setOpt('name', 'Jim'); g.window.__setSeed('K7Q2ZD'); g.reset(); g.step(16.67);
  o = await playToGameOver(g); await settle(); await settle();
  const seedPost = g.fetchLog.find(f => f.url === 'https://board.test/seed');
  check(seedPost && JSON.parse(seedPost.init.body).seed === 'K7Q2ZD' && JSON.parse(seedPost.init.body).score === o.score && JSON.parse(seedPost.init.body).u === 0 && JSON.parse(sb.get('orbfall_v2')).seedSent['K7Q2ZD|casual'] === o.score, 'a seeded run posts its best to the seed board, with its badges, and remembers it');
  g.fetchReply = (url) => url.indexOf('/seed?seed=K7Q2ZD') >= 0 ? { status: 200, body: { rows: [{ cid: 'ffffffffffffffff', name: 'Ada', score: 9000, tier: 8, ts: Date.now() }, { cid: g.dbg().cid, name: 'Jim', score: o.score, tier: 5, ts: Date.now() }] } } : { status: 200, body: { rows: [], ok: true, rank: 1 } };
  g.fire('scores:click'); g.step(16.67); q = g.dbg();
  check(q.viewSeed === 'K7Q2ZD', 'the board knows the run’s seed');
  g.fire('chips:click', { target: { getAttribute: () => 'seed' } }); g.fire('modechips:click', { target: { getAttribute: () => 'online' } }); await settle(); await settle();
  check(g.fetchLog.some(f => f.url === 'https://board.test/seed?seed=K7Q2ZD&mode=casual') && g.els.rows._html.includes('Ada') && g.els.rows._html.includes('class="you"') && g.els.stats.textContent.indexOf('Seed K7Q2ZD') === 0, 'Seed + Online shows both players on that seed with your row highlighted');
  g.fire('chips:click', { target: { getAttribute: () => 'today' } }); await settle(); await settle();
  check(g.fetchLog.some(f => f.url === 'https://board.test/seed?seed=' + daily2 + '&mode=casual'), 'Today + Online reads today’s seed board');

  // merge motes: every pop sheds motes that drift up and fade into the sky
  g = boot(new Map()); await settle(); g.step(16.67);
  let sawDrift = 0;
  for (let i = 0; i < 1500 && g.dbg().state !== 'over'; i++) { g.step(16.67); if (i % 30 === 10) g.tap(40 + Math.random() * 310); const q2 = g.dbg(); if (q2.drift > sawDrift) sawDrift = q2.drift; }
  check(sawDrift > 0, 'a merge sheds drifting motes (' + sawDrift + ' at most)');
  for (let k = 0; k < 700; k++) g.step(16.67);
  check(g.dbg().drift === 0, 'they fade away within twelve seconds');
  g = boot(new Map(), { reduced: true }); await settle(); g.step(16.67);
  for (let i = 0; i < 1500 && g.dbg().state !== 'over'; i++) { g.step(16.67); if (i % 30 === 10) g.tap(40 + Math.random() * 310); }
  check(g.dbg().drift === 0, 'and none appear under reduced motion');

  // the help legend: a question mark in the HUD opens the rules and the merge ladder, paused behind it
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67); q = g.dbg();
  const ladder = g.els.ladder._html;
  check(q.ladder === 11 && ladder.indexOf('<b>Mote<span>two make a Pip</span></b><small>+1</small>') > 0 && ladder.includes('<b>Nova<span>two make a Sun</span></b><small>+55</small>') && ladder.includes('<b>Sun<span>two vanish</span></b><small>+200</small>'), 'the ladder lists all eleven sizes with what two of them make and the points');
  check(ladder.indexOf('Mote') < ladder.indexOf('Pip') && ladder.indexOf('Star') < ladder.indexOf('Nova') && (ladder.match(/radial-gradient/g) || []).length === 11, 'in merge order, each with its colour');
  check((ladder.match(/<canvas [^>]*data-t="\d+"/g) || []).length === 11, 'and a canvas each, where the real body is painted when the card opens');
  const helpTap = () => g.fire('c:pointerdown', { clientX: q.offX + q.helpX * q.scl, clientY: q.offY + q.helpY * q.scl, pointerId: 1 });
  const dropsBeforeHelp = q.drops; helpTap(); g.fire('c:pointerup', { clientX: q.offX + q.helpX * q.scl, pointerId: 1 }); g.step(16.67); q = g.dbg();
  check(q.helpOn && q.paused && q.drops === dropsBeforeHelp && g.els.help.classList.contains('show'), 'tapping the question mark opens the legend and pauses instead of dropping');
  g.fire('helpok:click'); g.step(16.67); q = g.dbg();
  check(!q.helpOn && !q.paused && !g.els.help.classList.contains('show'), 'Got it closes it and play resumes');
  g.fire('win:keydown', { key: 'h' }); check(g.dbg().helpOn, 'h on a keyboard opens it');
  g.fire('win:keydown', { key: 'Escape' }); check(!g.dbg().helpOn && !g.dbg().pauseOn, 'Escape closes it without opening the pause sheet');

  // the black hole: every 5,000 points the next piece is a black hole that eats the board and bursts
  const bh = new Map();
  g = boot(bh); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  for (let d = 0; d < 8; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  for (let k = 0; k < 60; k++) g.step(16.67);
  g.window.__score(4999); g.window.__chain(); g.step(16.67); q = g.dbg();
  check(q.score >= 5000 && q.nxtT === -1 && q.holesDue === 0 && q.floats.some(t => t === 'Black hole next'), 'crossing 5,000 makes the next piece a black hole');
  g.tap(180); for (let k = 0; k < 40; k++) g.step(16.67); q = g.dbg();
  check(q.curT === -1 && q.nxtT >= 0, 'it comes into the hand after the piece in play, with a normal piece behind it');
  const orbs = q.n, sc0 = q.score;
  g.tap(180); for (let k = 0; k < 6; k++) g.step(16.67); q = g.dbg();
  check(q.hole && q.hole.phase === 'fall' && q.n === orbs + 1 && q.drops === 10, 'dropped, it falls like an orb');
  g.tap(120); g.step(16.67); check(g.dbg().drops === 10, 'nothing else drops while it is on the board');
  g.document.hidden = true; g.fire('doc:visibilitychange'); await settle();
  const liveHole = JSON.parse(bh.get('orbfall_v2')).live, bhCopy = new Map(bh);
  check(liveHole && liveHole.b.some(a => a[4] === -1 && a.length === 7), 'the live save carries the black hole');
  g.document.hidden = false;
  let fed = 0, maxSuck = 0, warned = false;
  for (let k = 0; k < 1200 && g.dbg().hole; k++) { g.step(16.67); const qq = g.dbg(); if (qq.hole && qq.hole.phase === 'feed') fed++; if (qq.sucking > maxSuck) maxSuck = qq.sucking; if (qq.warn > 0) warned = true; }
  for (let k = 0; k < 30; k++) g.step(16.67); q = g.dbg();
  check(fed > 20 && !q.hole && q.n === 0 && q.state === 'play' && maxSuck >= 1, 'landed, it wakes, pulls the orbs in one by one and bursts, leaving an empty board (' + fed + ' frames feeding)');
  check(q.score > sc0 && q.floats.some(t => t === 'Board cleared') && !warned, 'every orb eaten scored, the burst is announced, and the line never threatened');
  g.fire('undo:click'); g.step(16.67); q = g.dbg();
  check(q.n === orbs && q.curT === -1 && q.score === sc0 && q.sucking === 0, 'undo brings the board and the black hole in the hand back');
  g = boot(bhCopy); await settle(); g.step(16.67); q = g.dbg();   // the save as it was when the app was hidden, hole on the board
  check(q.hole && q.hole.phase === 'fall' && q.n === orbs + 1, 'a restored run gets its black hole back and it carries on');
  const sd2 = new Map();
  g = boot(sd2); await settle(); g.window.__setSeed('K7Q2ZD'); g.reset(); for (let k = 0; k < 15; k++) g.step(16.67);
  const P2 = g.window.__pieces('K7Q2ZD', 3);
  g.window.__score(4999); g.window.__chain(); g.step(16.67); q = g.dbg();
  check(q.nxtT === -1 && q.seqN === 1 && q.curT === P2[0], 'on a seed the displaced piece is handed back to the sequence');
  g.tap(180); for (let k = 0; k < 40; k++) g.step(16.67); q = g.dbg();
  check(q.curT === -1 && q.nxtT === P2[1] && q.seqN === 2, 'the hole is dealt and the displaced piece follows it, so the seed stays in step');
  g = boot(new Map(), { reduced: true }); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  for (let d = 0; d < 5; d++) { g.tap(60 + d * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  g.window.__score(4999); g.window.__chain(); g.tap(180); for (let k = 0; k < 40; k++) g.step(16.67); g.tap(180);
  maxSuck = 0; for (let k = 0; k < 900 && g.dbg().hole; k++) { g.step(16.67); if (g.dbg().sucking > maxSuck) maxSuck = g.dbg().sucking; }
  check(!g.dbg().hole && g.dbg().n === 0 && maxSuck === 0 && g.dbg().holeFlash === 0, 'under reduced motion it still clears the board, without the pull or the flash');

  // triples: three of a kind touching at once make the size two up, for double the next pair's points
  g = boot(new Map()); await settle(); g.step(16.67);
  const F = g.dbg().FLOOR;
  g.window.__place(100, F - 15, 0); g.window.__place(140, F - 15, 0); g.step(16.67); q = g.dbg();
  check(q.n === 2 && q.score === 0, 'two Motes resting apart do not merge');
  g.window.__place(120, F - 15 - 21, 0); for (let k = 0; k < 3; k++) g.step(16.67); q = g.dbg();
  check(q.n === 1 && q.tiers[0] === 2 && q.score === 6 && q.floats.some(t => t === 'triple') && q.tier === 2, 'a third Mote touching both makes a Bead at once, for double the Pip pair (' + q.score + ')');
  for (let k = 0; k < 80; k++) g.step(16.67);   // let the chain window close and the triple caption fade
  g.window.__place(220, F - 15, 0); g.window.__place(248, F - 15, 0); for (let k = 0; k < 3; k++) g.step(16.67); q = g.dbg();
  check(q.n === 2 && q.tiers.indexOf(1) >= 0 && q.score === 7 && !q.floats.some(t => t === 'triple'), 'a plain pair still makes a Pip for one point');
  g = boot(new Map()); await settle(); g.step(16.67);
  g.window.__place(130, 350, 9); g.window.__place(230, 350, 9); g.window.__place(180, 270, 9); g.step(16.67); q = g.dbg();
  check(q.n === 1 && q.tiers[0] === 10 && q.score === 132 && q.tier === 10, 'three Novas make a Sun and score double the Sun pair (' + q.score + ')');
  g = boot(new Map()); await settle(); g.step(16.67);
  g.window.__place(130, 380, 10); g.window.__place(230, 380, 10); g.window.__place(180, 300, 10); g.step(16.67); q = g.dbg();
  check(q.n === 0 && q.score === 300, 'three Suns vanish for 300 (' + q.score + ')');

  // real ads: Google's Ad Placement API behind the reward hook (a prompt first; viewed, dismissed, no ad, two ads, no answer)
  const adCalls = [], rewardCall = () => adCalls.filter(c => c.type === 'reward').slice(-1)[0];
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  g.window.__setAdApi(o => adCalls.push(o));
  check(adCalls.some(c => c.sound === 'on'), 'the game tells the ad API it has sound');
  g.fire('sound:click', { stopPropagation() {} }); check(adCalls[adCalls.length - 1].sound === 'off', 'and tells it again when the sound is muted');
  g.fire('sound:click', { stopPropagation() {} });
  for (let d = 0; d < 12; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  await playToGameOver(g); await settle();
  let dropsAd = g.dbg().drops, played = 0;
  g.fire('revive:click'); g.fire('r5:click'); g.step(16.67); q = g.dbg(); let rw = rewardCall();
  check(rw && rw.name === 'undo5' && q.adBusy && q.paused && q.adH === 'Finding an ad' && !q.adWatch, 'Undo 5 asks the API for a rewarded ad and waits, paused');
  rw.beforeReward(() => { played++; }); q = g.dbg();
  check(q.adH === 'Watch an ad?' && q.adWatch && q.adP.includes('5 moves') && played === 0, 'when an ad is ready the box asks first, and nothing plays until the player taps');
  g.fire('rwgo:click'); rw.beforeAd(); q = g.dbg();
  check(played === 1 && q.adShowing && q.paused && !q.adWatch, 'Watch the ad starts it, with the game paused underneath');
  rw.adViewed(); rw.afterAd(); rw.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === 'play' && q.drops === dropsAd - 5 && q.used5 && q.rescueLeft === 1, 'a watched ad grants the five-move rewind and counts the rescue');
  await playToGameOver(g); await settle(); dropsAd = g.dbg().drops;
  g.fire('revive:click'); g.fire('r10:click'); g.step(16.67); rw = rewardCall();
  check(rw.name === 'undo10' && g.dbg().adk === 'Ad 1 of 2', 'Undo 10 counts its two ads');
  rw.beforeReward(() => {}); g.fire('rwgo:click'); rw.beforeAd(); rw.adDismissed(); rw.afterAd(); rw.adBreakDone({ breakStatus: 'dismissed' }); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === 'over' && q.drops === dropsAd && !q.used10 && q.rescueLeft === 1, 'an ad closed early grants nothing and spends nothing');
  g.fire('revive:click'); g.fire('r10:click'); g.step(16.67); rw = rewardCall();
  rw.beforeReward(() => {}); g.fire('rwgo:click'); rw.beforeAd(); rw.adViewed(); rw.afterAd(); rw.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67); q = g.dbg();
  const rw2 = rewardCall();
  check(rw2 !== rw && q.adBusy && q.adk === 'Ad 2 of 2' && q.state === 'over', 'after the first ad the second is asked for');
  rw2.beforeReward(() => {}); g.fire('rwgo:click'); rw2.beforeAd(); rw2.adViewed(); rw2.afterAd(); rw2.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === 'play' && q.drops === dropsAd - 10 && q.used10 && q.rescueLeft === 0, 'both ads watched grant the ten-move rewind');
  g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67);
  if (g.dbg().undosFree > 0) { g.fire('undo:click'); g.step(16.67); g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); }
  const st0 = g.dbg().state, undos0 = g.dbg().undosUsed;
  g.fire('undo:click'); g.step(16.67); rw = rewardCall();
  rw.adBreakDone({ breakStatus: 'frequencyCapped' }); g.step(16.67); q = g.dbg();
  check(rw.name === 'undo' && q.adBusy && q.adH === 'No ad right now' && !q.adWatch && q.undosUsed === undos0, 'with no ad available the box says so and nothing is used');
  g.fire('rwno:click'); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === st0 && !q.adWatch, 'OK closes it');
  g.fire('undo:click'); g.step(16.67);
  for (let k = 0; k < 400; k++) g.step(16.67); q = g.dbg();
  check(q.adBusy && q.adH === 'No ad right now', 'an ad API that never answers (an ad blocker) times out to the same message');
  g.fire('win:keydown', { key: 'Escape' }); check(!g.dbg().adBusy, 'Escape closes it');
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  adCalls.length = 0; g.window.__setAdApi(o => adCalls.push(o));
  for (let d = 0; d < 12; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  await playToGameOver(g); await settle(); dropsAd = g.dbg().drops;
  g.fire('revive:click'); g.fire('r10:click'); g.step(16.67); rw = rewardCall();
  rw.beforeReward(() => {}); g.fire('rwgo:click'); rw.beforeAd(); rw.adViewed(); rw.afterAd(); rw.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67);
  rewardCall().adBreakDone({ breakStatus: 'frequencyCapped' }); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === 'play' && q.drops === dropsAd - 10 && q.used10, 'if the second ad never comes, the first one watched still earns the reward');
  g = boot(new Map(), { location: { search: '?adtest', hash: '', protocol: 'https:', href: 'https://orb.test/?adtest', pathname: '/' } }); await settle(); g.step(16.67);
  const adTag = (g.appended || []).find(n => /adsbygoogle\.js/.test(n.src || ''));
  check(adTag && adTag.src.includes('client=ca-pub-0000000000000000') && adTag.getAttribute('data-adbreak-test') === 'on' && g.window.adsbygoogle.some(c => c.preloadAdBreaks === 'on'), '?adtest loads the Google ad library in test mode, mock ads only');
  g = boot(new Map()); await settle(); g.step(16.67);
  check(!(g.appended || []).length && !g.window.adsbygoogle, 'without a publisher id or ?adtest no ad code loads at all');

  // the loader: a real publisher id, the privacy link, a failed load and its retry
  for (let k = 0; k < 15; k++) g.step(16.67);
  check(!g.dbg().privacyShown, 'without ads configured the settings sheet has no privacy link');
  g.window.__adsInit('ca-pub-1234567890123456'); q = g.dbg();
  const libs = () => (g.appended || []).filter(n => /adsbygoogle\.js/.test(n.src || ''));
  check(libs().length === 1 && libs()[0].src.includes('client=ca-pub-1234567890123456') && libs()[0].getAttribute('data-ad-client') === 'ca-pub-1234567890123456' && libs()[0].getAttribute('data-adbreak-test') === 'on' && libs()[0].getAttribute('data-ad-frequency-hint') === '30s' && q.privacyShown, 'a publisher id loads the Google library for it, in test mode until AD_TEST is off, and shows the privacy link');
  libs()[0].onerror(); check(g.dbg().adFail && g.window.adsbygoogle.length === 0, 'a failed load (offline, an ad blocker) is remembered and the queue emptied');
  g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); g.fire('undo:click'); g.step(16.67);   // the free undo
  g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); g.fire('undo:click'); g.step(16.67); q = g.dbg();
  check(libs().length === 2 && q.adBusy && q.adH === 'Finding an ad' && !q.adFail, 'the next reward asks for the library again');
  libs()[1].onerror(); q = g.dbg();
  check(q.adBusy && q.adH === 'No ad right now' && q.adFail, 'and when it fails again the box says so at once instead of waiting');
  g.fire('rwno:click'); g.step(16.67); check(!g.dbg().adBusy && g.dbg().state === 'play', 'OK returns to the run');

  // the live setting: AD_TEST off loads the library without the test attribute
  g = boot(new Map()); await settle(); g.step(16.67);
  g.window.__adsInit('ca-pub-1234567890123456', false);
  const liveTag = (g.appended || []).find(n => /adsbygoogle\.js/.test(n.src || ''));
  check(liveTag && liveTag.getAttribute('data-ad-client') === 'ca-pub-1234567890123456' && liveTag.getAttribute('data-adbreak-test') === null && g.dbg().privacyShown, 'with AD_TEST off the library loads for real ads, with no test attribute');

  // "not yet" is asked again: straight after an ad the library is still fetching the next one
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  adCalls.length = 0; g.window.__setAdApi(o => adCalls.push(o));
  const rewards = () => adCalls.filter(c => c.type === 'reward').length;
  for (let d = 0; d < 12; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  await playToGameOver(g); await settle(); dropsAd = g.dbg().drops;
  g.fire('revive:click'); g.fire('r10:click'); g.step(16.67);
  let asked = rewards(); rewardCall().adBreakDone({ breakStatus: 'noAdPreloaded' }); g.step(16.67); q = g.dbg();
  check(rewards() === asked + 1 && q.adBusy && q.adH === 'Finding an ad', 'an answer of "no ad ready yet" is asked again instead of giving up');
  rw = rewardCall(); rw.beforeReward(() => {}); check(g.dbg().adH === 'Watch an ad?', 'and the prompt appears when the ad arrives');
  g.fire('rwgo:click'); rw.beforeAd(); rw.adViewed(); rw.afterAd(); asked = rewards(); rw.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67); q = g.dbg();
  check(rewards() === asked + 1 && q.adBusy && q.adk === 'Ad 2 of 2' && q.adH === 'Finding an ad' && q.state === 'over', 'the second ad is asked for after the first');
  asked = rewards(); rewardCall().adBreakDone({ breakStatus: 'noAdPreloaded' }); g.step(16.67);
  check(rewards() === asked + 1 && g.dbg().adBusy && g.dbg().state === 'over', 'and asked again while the library fetches it, with nothing granted yet');
  rw = rewardCall(); rw.beforeReward(() => {}); g.fire('rwgo:click'); rw.beforeAd(); rw.adViewed(); rw.afterAd(); rw.adBreakDone({ breakStatus: 'viewed' }); g.step(16.67); q = g.dbg();
  check(!q.adBusy && q.state === 'play' && q.drops === dropsAd - 10 && q.used10, 'two ads watched, with a wait in between, grant the ten-move rewind');
  await playToGameOver(g); await settle();
  g.fire('revive:click'); g.fire('r5:click'); g.step(16.67);
  for (let k = 0; k < 400; k++) g.step(16.67);
  asked = rewards(); rewardCall().adBreakDone({ breakStatus: 'noAdPreloaded' }); g.step(16.67); q = g.dbg();
  check(rewards() === asked && q.adBusy && q.adH === 'No ad right now', 'once the wait is up a late "not yet" is not asked again');
  g.fire('rwno:click'); g.step(16.67);

  // a blocked or offline player is told why, and is not made to wait twice
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  g.window.__adsInit('ca-pub-1234567890123456');
  const cfg = g.window.adsbygoogle.find(c => c.preloadAdBreaks === 'on');
  check(cfg && typeof cfg.onReady === 'function' && !g.dbg().adAlive, 'the library is asked to say when it is ready, and is not assumed alive before it does');
  adCalls.length = 0; g.window.__setAdApi(o => adCalls.push(o));   // from here a stand-in that never answers, like a blocker's
  g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); g.fire('undo:click'); g.step(16.67);   // the free undo
  g.tap(180); for (let k = 0; k < 30; k++) g.step(16.67); g.fire('undo:click'); g.step(16.67);
  check(g.dbg().adH === 'Finding an ad', 'the first reward waits for the library');
  for (let k = 0; k < 400; k++) g.step(16.67); q = g.dbg();
  check(q.adH === 'No ad right now' && q.adP.indexOf('An ad blocker may be stopping it') > 0 && q.adDead, 'a library that never answers ends in a message that names the likely cause');
  g.fire('rwno:click'); g.step(16.67);
  asked = rewards(); g.fire('undo:click'); g.step(16.67); q = g.dbg();
  check(q.adBusy && q.adH === 'No ad right now' && rewards() === asked, 'the next reward says so at once, without asking or waiting again');
  g.fire('rwno:click'); g.step(16.67);
  cfg.onReady(); check(g.dbg().adAlive, 'when the library reports ready it counts as alive');
  g.fire('undo:click'); g.step(16.67); q = g.dbg();
  check(q.adH === 'Finding an ad' && rewards() === asked + 1, 'and rewards are asked for again');
  rewardCall().adBreakDone({ breakStatus: 'frequencyCapped' }); g.step(16.67);
  check(g.dbg().adP === 'Nothing was used. Try again in a minute.', 'a live library with no ad gives the plain message');
  g.fire('rwno:click'); g.step(16.67);
  g.navigator.onLine = false; g.fire('undo:click'); g.step(16.67); rewardCall().adBreakDone({ breakStatus: 'frequencyCapped' }); g.step(16.67);
  check(g.dbg().adP === 'You are offline. Nothing was used.', 'and offline it says offline');
  g.fire('rwno:click'); g.step(16.67); g.navigator.onLine = true;

  // nothing restarts the run under a reward in progress
  g = boot(new Map()); await settle(); for (let k = 0; k < 15; k++) g.step(16.67);
  adCalls.length = 0; g.window.__setAdApi(o => adCalls.push(o));
  for (let d = 0; d < 6; d++) { g.tap(60 + (d % 5) * 50); for (let k = 0; k < 30; k++) g.step(16.67); }
  await playToGameOver(g); await settle(); for (let k = 0; k < 40; k++) g.step(16.67);
  const dropsOver = g.dbg().drops;
  g.fire('revive:click'); g.fire('r5:click'); g.step(16.67);
  g.fire('win:keydown', { key: ' ', preventDefault() {} }); g.fire('again:click'); g.step(16.67); q = g.dbg();
  check(q.adBusy && q.state === 'over' && q.drops === dropsOver, 'while a reward is in progress neither the keyboard nor Play again restarts the run');
  g.fire('rwno:click'); g.step(16.67);
  g.fire('win:keydown', { key: ' ', preventDefault() {} }); g.step(16.67);
  check(g.dbg().state === 'play' && g.dbg().drops === 0, 'and afterwards the keyboard restarts as before');

  // the painted bodies: one of every tier on the board draws without a fault (kept last: it spends the seeded dice)
  g = boot(new Map()); await settle(); g.step(16.67);
  for (let t = 0; t <= 10; t++) g.window.__place(30 + t * 28, 300 + (t % 3) * 60, t);
  for (let k = 0; k < 20; k++) g.step(16.67);
  check(!g.dbg().faulted && g.dbg().n >= 6, 'every tier draws without a fault (' + g.dbg().n + ' bodies on the board)');

  done('functional');
})().catch(e => { console.error(e); process.exit(1); });
