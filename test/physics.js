// Physics stays bounded, merges happen, runs end. Random play at 2 drops/s, uniform x.
'use strict';
const { boot, settle, check, done, SEED } = require('./env.js');
(async () => {
  const g = boot(new Map()); await settle(); g.step(16.67);
  const FRAMES = 12000; let games = 0, merges = 0, lastN = 0, floorLeak = 0, launches = 0, popcorn = 0, overSpeed = 0;
  const finals = [];
  for (let i = 0; i < FRAMES; i++) {
    g.step(16.67);
    const d = g.dbg();
    if (d.n < lastN) merges++; lastN = d.n;
    if (d.n) {
      if (d.maxY > d.FLOOR + 0.5) floorLeak++;
      if (d.minY < 0) launches++;
      if (d.maxUp > 5.6) popcorn++;
      if (d.maxSpeed > d.MAXV * 2.5) overSpeed++;
    }
    if (d.state === 'over') { games++; finals.push(d); g.step(400); g.fire('again:click'); lastN = 0; }
    else if (i % 30 === 10) g.tap(40 + Math.random() * 310);
  }
  console.log('physics (seed ' + SEED + '): ' + games + ' runs ended, ' + merges + ' merge events, finals ' +
    finals.map(d => d.score + '/tier' + d.tier).join(' '));
  check(games >= 1, 'at least one run reached game over within ' + FRAMES + ' frames');
  check(merges > 20, 'merges occur under random play');
  check(floorLeak === 0, 'no orb ever sank below the floor (frames: ' + floorLeak + ')');
  check(launches === 0, 'no orb left the top of the screen (frames: ' + launches + ')');
  check(popcorn === 0, 'upward velocity cap held, no merge popcorn (frames: ' + popcorn + ')');
  check(overSpeed === 0, 'no velocity blow-ups (frames over 2.5x cap: ' + overSpeed + ')');
  check(finals.every(d => d.tier <= 9), 'random play did not reach the Sun (skill ceiling intact)');
  done('physics');
})().catch(e => { console.error(e); process.exit(1); });
