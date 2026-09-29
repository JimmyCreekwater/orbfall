# Orbfall — project brief for Claude Code

Single-file HTML5 merge-drop game (portrait, one-thumb, mobile browser). The owner is James;
he plays it himself and wants a game with a real skill ceiling, not a cozy idle loop. Treat this
file as the design record: it captures decisions already made so they don't get re-litigated.

## Ground rules
- `index.html` is the whole game: inline CSS + JS, no build step, no framework, no assets.
  The only files beside it are the PWA shell (`manifest.webmanifest`, `sw.js`, `icons/`), the
  script that drew the icons (`tools/icons.js`, run by hand, output checked in) and the tests.
  Keep it that way; a bundler is not welcome.
- Canvas 2D at 60 fps on a mid-range phone is the performance bar. Orbs are drawn from one
  pre-lit sprite per tier and the table and pocket are static layers, all rebuilt in `resize()`;
  the contact shadow under every orb and the glow of the top two tiers are baked into the
  sprites at build time, the felt grain and the star field into the layers. Don't add per-frame
  shadows, filters, gradients, or DOM per ball.
- Run `npm test` before and after any change to physics, scoring, persistence, input, or the
  PWA shell. The three suites (physics, functional, pwa) are headless Node (no deps) and take
  a few seconds. The harness seeds `Math.random` (`SEED`, default 1), so a run of the suite is
  the same run every time; `SEED=7 npm test` explores another sequence.
- Ship with `npm run release` (tools/release.js): it bumps the version into the worker's cache
  name, refuses the placeholder domain in the Open Graph tags, runs the tests and prints the git
  commands. Never edit the cache name in `sw.js` by hand. PUBLISHING.md is the owner's runbook.
- Labels are sentence case ("best", "next", "undo"), no middle-dot metadata strings, no
  all-caps (the pixel wordmark is a mark, not a label). Ambient life has a small budget and
  nothing else idles: `MOTES` motes drifting up the pocket, fourteen twinkling stars, the twinkle
  of the top three tiers, and the held piece's breathing; everything else moves only in response
  to play; merges shed drifting motes as well (`popMotes`, capped at `DRIFT_MAX`, drawn with the
  ambient layer, scattered by their own `driftRnd` so cosmetics never disturb the `Math.random`
  stream the seeded tests replay). `prefers-reduced-motion` switches all of that off, plus shake,
  particles, squash, pop, flash, slow motion, ghosts, the restart sweep, the chain wash, the counting
  card score and the rolling counter, and keeps the colour cues (danger outlines, reveal text).
- The tuning constants are knobs, not settled values — the owner adjusts them from feel.

## Map of index.html
Sections in order, each marked with a `/* ---------- name ---------- */` comment:
tuning knobs → feel knobs → world/layout → TIERS → physics constants → state → persistence →
sound → music → game flow → undo + revive + reward hook → bottom bar → scoreboard →
settings sheet → home menu + pause sheet (with the name gate, the seed box and the share box) →
online board (with the name filter and the seed board) → share + install nudge → simulation →
rendering (static layers, sprites, identity, tier signatures, ambient life, effects) →
layout & input → pwa → safety net → loop. Seeds live beside `roll()` in the state section; the
rescue chooser beside the undo code.

## Rules of the game (current)
- 11 tiers (Mote … Sun). Two touching orbs of the same tier merge into the next tier at their
  midpoint. Score for a merge = triangular number of the *pair's* tier: 1, 3, 6, 10 … 66.
  Sun + Sun vanish for +200. Merges within 0.9 s of each other chain: bonus = base × 0.5 × (n−1).
- Spawns are tiers 0–4 with weights `SPAWN_W=[28,26,20,15,11]`. Drop cooldown 0.42 s.
- Loss: an orb older than 0.7 s whose top is above `LINE_Y` for more than 1.0 s continuous.
  The owner said the loss "was visible 30 s ahead" — that legibility is intentional; keep it.
- Difficulty calibration (from headless sims, random play at 2 drops/s, uniform x):
  random reaches tier 7–8 and 1–3k points. The owner reached Nova (tier 9) and 3.2k in five
  rounds — only modestly above random. Backlog #5 exists to widen that gap.

## Physics (don't change casually)
Fixed step `DT=1/120` with an accumulator (max 6 steps/frame). Verlet integration, gravity
`G=2400` logical px/s², air damping `DAMP=.997`, per-step speed cap `MAXV=14`. Six constraint
iterations per step: pairwise circle overlap resolved positionally, mass-weighted by r²;
walls/floor are resolved *after* the pair pass each iteration (this order fixed a floor-sink
bug). After the iterations, upward velocity is capped at 5 px/step and horizontal at 6 to stop
merge "popcorn" launches. A merged orb starts at the parent radius and grows to its target
over ~10 steps (`b.r` → `b.tr`) so neighbours are pushed gradually. Rotation is visual only.
World is 360×676 logical units, letterboxed to the viewport; box interior is 336×476.
The merge branch of `physStep` is also where the effect hooks live (`addScore`, `fx`, `sfxMerge`,
`vib`, `ghost`, `reveal`, and a born orb's pop and flash fields); those lines are effects, not
physics, and the integration and constraint code is unchanged from the original build.

Known intermittent test failure (seen 2026-09-24; pre-existing, the simulation was untouched
by the storage/PWA/revive work): `test/physics.js` fails "no velocity blow-ups" in roughly one
run in ten (1 of 12 in a row, plus one earlier). Diagnosed with a scratch harness: on a merge
frame the new, heavier orb overlaps a neighbouring Mote and the mass-weighted positional pass
shoves the Mote about 45 px straight down in one step (recorded speed ≈ 35 px/step against
the 14 cap, just over the test's 2.5× line). The post-iteration clamps cover upward (5) and
horizontal (6) pushes but not downward ones. Candidate one-line fix, after the horizontal
clamp: `if(b.y-b.py>MAXV)b.py=b.y-MAXV;` — a physics change, so the owner's call; run the
physics suite ten times after it. Random play uses `Math.random`, so the suite is not
deterministic; backlog #4's seeded RNG could make it so.
A second, rarer random failure: "no orb left the top of the screen", seen twice in about 140
runs on 2026-09-24. The caught case was a Pip whose top edge reached 0.2 px above the screen
for 4 frames, with the time scale at 1 (slow motion not active) and the loss timer at 0.55 s:
the same family as the shove above, only upward, and only just over the test's edge. Measured
in 20-run batches the same day: the pre-feel build had 1 blow-up and no launch, the feel build
0 failures, the feel build with slow motion disabled 4 blow-ups; over 60 more runs the feel
build had 7 blow-ups and that 1 launch. The feel pass is not the cause; if the downward clamp
is added, an upward displacement clamp probably belongs beside it.

## Persistence
Schema v2, one JSON blob under key `orbfall_v2`:
`{best, bestTier, games, sum, revives, modes, opt, cid, sent, hintedInstall, top:[rec…],
runs:[rec…≤400], live}` where `cid` is the random 16-hex player id for the online board, `sent`
is the best score already posted per mode, `seedSent` the best posted per seed and mode (keys
`SEED|mode`, the newest 50 kept), `hintedInstall` says the iPhone hint was dismissed,
`rec = {s:score, t:bestTier, d:epochMs, u:undosUsed, v:revivesUsed, m?:'rush', sd?:seed}` (no
`m` means Casual; `sd` is the seed of a seeded run, six letters when generated, up to twelve when
typed; `u` counts every move undone by any rescue), `revives` is the lifetime revive count (it decides whether the next revive is free),
`modes = {casual:{best,bestTier,games,sum}, rush:{…}}` holds the per-mode stats (`best`, `games`
and `sum` at the top level stay as the overall figures; a save without `modes` migrates into
Casual), `top` keeps 20 entries per mode, `opt` is the settings block
(`{mute, sfx, music, haptics, aim, mode, online, name}`; unknown or mistyped values fall back to
defaults),
and `live` is the in-progress run (`{b:[[x,y,px,py,t]…], s, n, c, bt, d, u, uf, v, m, sd, q, x5,
x10, rs}`, where `sd`/`q` are the seed and how many pieces it has dealt, `x5`/`x10` whether the paid
rewinds are spent and `rs` how many rescues the run has taken), flushed every 2.5 s while dirty and on
`visibilitychange`/`pagehide`, restored on load. `persist()` is a no-op until the load has
finished (`loaded` flag) — this prevents the boot `reset()` from wiping the save. Keep that.
All reads and writes go through the `store` adapter (`store.get(key)` → Promise of the stored
string or null, `store.set(key, val)` → Promise, neither ever rejects; `store.kind` says which
backend won). Order: `window.storage` when present (Claude.ai artifacts), else `localStorage`
(probed with a write at startup because Safari private mode used to throw on `setItem`), else
memory. Every write is mirrored in memory, so a later `localStorage` failure (quota) costs
nothing within the session. Same schema on every backend, no migration. A loaded blob is
validated before use: unparsable JSON, non-array `top`/`runs`, or a malformed `live.b` entry
is ignored rather than allowed to break the boot. The `orbfall_save_v1` read is the last
remaining bridge for pre-v2 artifact saves.

## PWA
`manifest.webmanifest` (Orbfall, standalone, portrait, felt theme and background) + `sw.js` +
`icons/` (192/512 `any` on a rounded felt tile, 192/512 `maskable` full-bleed with the orb inside
the 80 % safe zone, 180 `apple-touch-icon`). `sw.js` precaches the shell on install (`./`,
manifest, icons, fetched with `cache:'reload'`) and serves it cache-first; every navigation
inside the scope is answered with the cached `./`, so hosts with clean URLs that redirect
`/index.html` can never poison the cache. **Bump `CACHE` in `sw.js` with every shipped change**
— installed players only get a new build when that file changes. The old cache is deleted on
activate, `skipWaiting` + `clients.claim` make the next launch the new build, and there is no
forced reload (an update must never interrupt a run). Registration lives in the `pwa` section
of index.html and is skipped on `file:` URLs and wherever `navigator.serviceWorker` is absent
(artifacts). Icons are drawn by `tools/icons.js` with the same palette and highlight geometry
as `drawBall`; `npm run icons` regenerates them (deterministic output). Verified 2026-09-24 in
desktop Chromium: manifest parses, worker installs and controls the page, the game reloads
with the server stopped, a run restores from `localStorage`. Not yet done on a phone: the
Android Chrome install prompt and the iOS 26 Home Screen install — do both once it is hosted.

## Undo, the rescue chooser, revive and the reward hook
The bar's undo rewinds one drop: free once per run (`UNDO_FREE_PER_RUN`), then ad-gated. Every
drop pushes a pre-drop snapshot (balls, score, combo, next piece, the seed's place) onto a ring
of `SNAPS_KEEP` (10); `doUndo(n)` restores the nth from the end, resets the line timers and adds
`n` to `u`. `requestReward(grant, placement, count)` is the seam where a real rewarded-ad SDK
goes: `placement` names the reward (`undo`, `undo5`, `undo10`, `revive`) so the SDK can pick an
ad unit, `count` is how many ads it costs, and `grant()` runs only after the last one. Today it
shows a cancelable placeholder countdown per placement (`AD_STUB`, seconds), with "Ad 1 of 2" on
the box for a two-ad reward. Nothing else in the file knows about ads.

**Rescue chooser (shipped 2026-09-25).** The game-over card's gold "Rescue this run" opens a
chooser with four rows and their cost: Undo 1 move (free once, then an ad), Undo 5 moves (an
ad), Undo 10 moves (two ads), Clear the smallest orbs (free the first time ever, then an ad).
The paid rewinds and the clear are once per run each (`used5`, `used10`, `revivesUsed`, saved
with the live run); rows are disabled when spent or when the ring is too short. Every rescue
marks the run: ↶ with the moves undone, ↻ for the clear. A run finished with none of them is a
**clean run**: ✦ on the board and a "Clean run" line on the card. Design note from testing:
undoing one drop at game over rarely saves a run because the losing position was set several
drops earlier; five or ten moves do, and the clear is the other rescue.

**Two rescues per run (shipped 2026-09-25).** `RESCUES_PER_RUN` (2) caps rescues of any kind, counted in
`rescuesUsed` by `rescueDone()` when a rescue is applied (a cancelled ad counts nothing) and saved with the
live run (`rs`). The card's button reads "Rescue this run", then "Rescue this run (1 left)", then
"No rescues left" struck through (`.used`), with a caption under it (`#rescuecap`) saying how many are
left; the chooser's note says the same and all its rows disable at zero. Every chooser row goes through
`rescueUndo()` / `rescueClear()` (the `r` key too), so `tryUndo` and `tryRevive` stay the bar's and the
keyboard's in-play paths.

**Revive** (shipped 2026-09-24). On the game-over card, "Clear the smallest orbs" removes the
`REVIVE_CLEAR` (8) smallest orbs by tier (ties: the higher one goes first), zeroes every orb's
line timer, un-records the run and resumes it; `r` on a keyboard does the same. It is capped
at `REVIVE_PER_RUN` (1) per run — the button is disabled at a second game over of the same run,
so a run can be rescued once and the skill ceiling holds. The first `REVIVE_FREE` (1) revives
ever are free; after that every revive goes through `requestReward`, which is what makes it
the rewarded item. That count lives in the save (`revives`), not the run, so it survives
reloads. A revive clears the undo snapshot (undo must not resurrect the cleared orbs), marks
the run with `v` and shows ↻ on the board next to ↶. The spec said "once per run; ad-gated
after the first free one"; this is the reading taken — set `REVIVE_PER_RUN=0` and raise
`REVIVE_FREE` if the owner wants it looser. Verified 2026-09-24 in desktop Chromium as well
as the harness. One limitation seen there: the revive does not guarantee a rescue. In a run
stacked against a wall the top of the pile was Moons and Marbles, the eight smallest orbs
sat lower down, and the run ended again within a second of reviving. Under random play the
smallest orbs are the recent drops at the top, so it rescues. If it feels hollow in real
play, the owner's call is "clear the highest N" or "clear everything above the line" — both
are one-line changes to the sort in `doRevive`.

## Scoreboard
Bottom sheet, time filters All (default) / Day / Week / Month (rolling 24 h / 7 d / 30 d) /
Today (runs on today's seed only) / Seed (the run's seed, shown only when there is one), a Casual / Rush
pair, and a My scores / Online ranking pair on its own row above the filters (renamed from Here / Online on
2026-09-29 because the owner found those opaque; the rolling windows hide under the ranking, which has All,
Today and Seed), top
10 rows, run count and average, latest run highlighted (or appended with its rank if it's
outside the top 10). Physics pause while it's open.
Every row (since 2026-09-29, both boards, built by `rowHTML`) reads: place, the name in ivory with its badges
(✦ clean, ↶ moves undone, ↻ clears), then a small line with the size reached, the seed ("today X" or
"seed X", nothing for free play) and the moment of scoring (`when()`: relative within a day, then the date,
with the year once it differs), and the score at the right. Local rows carry the device's own name (or
"You"); online rows carry what the worker stored, escaped.

## Seeds, the daily and challenges (shipped 2026-09-25)
A generated seed is six letters from `SEED_AB` (no I, L, O, U, 0, 1); a typed one is any one to twelve
letters or digits (below). Piece n of a seeded run is
`pieceAt(seed, n)`, a pure function (fnv1a of `seed:n` into mulberry32, then the spawn
weights), so undo, revive and a restored run keep dealing the same pieces and two players on
one seed face the same sequence. `runSeed` is frozen at `reset()` from `activeSeed` (null for
free play); `seqN` counts pieces dealt and rides in snapshots and the live save. Today's seed is
`dailySeed()`, the **UTC** date hashed, so the whole world rolls over at the same moment and the client
and the worker agree without a round trip (a `/daily` override on the worker is the natural step if a
curated daily is ever wanted). A challenge link is `#s=SEED&m=MODE`: `parseLink()` at
load starts that run at once (the link's mode applies to the run only, the saved preference is
untouched), then `clearLink()` drops the hash so a reload resumes normally. `challenge()` on the
card and the menu shares the run's seed as a link with the score to beat, or, after a free run,
makes a fresh seed for the next run. The HUD shows "seed X" or "today X" under the best score.
Seeded runs are ordinary records with `sd`; the Today filter shows the current day's seed only, the Seed
filter the seed of the run being played (`viewSeed`).

**Typed seeds and the seed box (shipped 2026-09-25).** The daily, Random and Challenge-after-a-free-run stay
six letters; a typed seed is any one to twelve letters or digits (`cleanSeed()` uppercases and strips the
rest, `seedOK()` checks `[A-Z0-9]{1,12}`, the link regex matches the same). Play today keeps the daily as
the default; Other seed beside it opens the seed box (`#seedbox`), preset to today's code, with Random and
Play this seed. Two players who type the same word get the same pieces, and the seed board compares them.

## Home menu and pause sheet (shipped 2026-09-25)
Every cold launch opens the home menu (`openHome()`), never an app switch: the mark, a
tagline, Play (Continue when a run is live, with a New run beside it), the Casual / Rush pair,
Play today with the daily code beside Other seed, and Scores / Settings / Challenge. A challenge link skips
the menu. A player with no valid name meets the name gate first (see Names below); on a link run the gate
sits over the paused run. The mark in the HUD is the pause button (`menuHit`): Continue, Scores, Settings, Restart,
Home; Escape pauses and unpauses on a keyboard. Pausing has one rule: `updatePause()` sets
`paused` from every overlay flag (home, pause, rescue, sheets, the ad box, the fault card), so a
sheet closed over the menu never unpauses the game behind it. The harness boots with
`__skipHome` unless a test asks for the menu.

## Names and the name filter (shipped 2026-09-25)
The first launch (and any launch with no valid name) opens the name gate (`#namebox`) before the menu: a
name is required, up to twelve characters through `cleanName()`, and must pass `nameOK()`. The filter is
deliberately narrow: whole words are checked after undoing leetspeak (`normName`: 0→o, 1→i, 3→e, 4→a, 5→s,
7→t, 8→b, @→a, $→s, !→i) and doubled letters, plus the letters joined without spaces, against `BAD_WORD`;
the few unambiguous slurs in `BAD_ANY` are refused as substrings. So Glass, Cassandra, Scunthorpe and
assassin pass; Ass, sh1t, "f u c k" and SLUT99 do not. The settings name field applies the same rule with a
toast. `server/worker.js` carries identical lists and answers 400 to a failing name; extend both together.
The harness boots past the gate (`__skipName`, set alongside `__skipHome`, and for `home: true` tests
unless they pass `nameGate: true`).

## Backlog, in order
1. ~~**Storage adapter.**~~ Shipped 2026-09-24 — see Persistence. Functional tests cover a
   localStorage-only boot, reload, live-run restore, a localStorage that throws, and precedence.
2. ~~**PWA.**~~ Shipped 2026-09-24 — see PWA. Still owed: an on-device install check on
   Android Chrome and iOS 26 once the game is hosted somewhere.
3. ~~**Revive.**~~ Shipped 2026-09-24 — see Undo, revive and the reward hook. Knobs:
   `REVIVE_CLEAR`, `REVIVE_PER_RUN`, `REVIVE_FREE`. Tested: removal picks the smallest, once
   per run, first free then ad-gated (grant and cancel), `v` on the record and ↻ on the board,
   survives reload.
4. ~~**Daily seed.**~~ Shipped 2026-09-25 as seeds, the daily and challenge links — see that
   section. The per-seed online board followed the same day.
5. **Difficulty ramp.** Every ~1,000 points shift `SPAWN_W` toward larger pieces (cap at a
   sane ceiling). Re-run `test/physics.js` and report random-play tier/score; target: random
   tops out at tier 7, Sun reachable only with deliberate play.
6. **Hold/swap** the next piece (optional — changes the skill profile; ask the owner first).
7. ~~**Settings**~~ Shipped 2026-09-24 (music, effects, haptics, aim guide, mode). Left/right-handed
   bar order is still open.
8. **Ad SDK** behind `requestReward` only when there is real inventory (a portal SDK such as
   Poki/CrazyGames, or Google's H5 game ads). Not before.
9. **Time attack** as a third mode (score as much as you can in two minutes): comparable runs,
   a natural end, and the obvious daily challenge once #4 exists.

## Visual system
The theme, resolved on 2026-09-25: **an orrery on a card table**. Outside the pocket is the
table: felt `#10231e` with baked grain, a warm lamp pool from above, two faint brass orbit
tracks behind the pocket. Inside the pocket is the night the celestial tiers fall through: a
sky from `#0b1c22` to `#07120f`, a sage and a brass nebula wash, a seeded star field, framed by a
lit brass rim (`#dcc08a` light, `#b8955a`, `#7a6136` dark, two rivets). Brass `#b8955a`, ivory
`#f3ecdc`, sage `#8fa59a`, coral `#ff6b57` (danger), gold `#ffb020` (achievement / ad-gated).
Type: `ui-rounded`, "SF Pro Rounded", Segoe UI, Roboto, system-ui. Score numerals 800 weight,
tight tracking, tabular figures. Orb palette lives in `TIERS`.

**Identity.** The wordmark is a brass orb for the O followed by "rbfall" in a 5×7 pixel font
(`WM` in index.html; `tools/icons.js` carries the same rows for `icons/share.png`; keep them in
step). `drawWordmark` draws it on canvas, `wordmarkSVG(px, key)` gives the cards the same mark as inline SVG;
`key` makes each copy's gradient id unique, because `url(#id)` resolves to the first id in the document
and one inside a hidden card paints nothing (the pause sheet's O was invisible until 2026-09-25). A fresh start (no run to resume) shows the title moment: the mark over the
pocket with "Tap to play"; the first tap both dismisses it and plays, the Rush clock waits for
it, and it fades in a third of a second (none under reduced motion).

**Aesthetic pass two (shipped 2026-09-25).** Depth: a contact shadow baked under every orb
sprite, felt grain and lamp on the table layer, the sky in the pocket. Transitions: Play again
sweeps the old board away as falling ghosts (`sweep()`), the card's score counts up
(`countUp()`), a new best pulses its label and fires a gold burst that glows through the card's
blur (`celebrate()`). Ambient life within the budget above (`initAmbient`, `drawAmbient`, the
`tw` twinkle factor in `decorate`, the breathing held piece in `drawAim`); since 2026-09-25 every merge
also sheds motes in the tier's highlight colour (`popMotes` → `drift`, drawn in `drawAmbient` behind the
orbs, fading over three to seven seconds, `3 + 2·tier` of them plus eight for a Sun pair, `DRIFT_MAX` 80). Chrome: brass-lit bar
buttons, a felt-grain overlay and a brass top edge on the card and sheets (pure CSS, an inline
SVG noise), the chain captioned with the size reached, a brass slot behind the next piece, a
landing shadow under the aim guide, a heavier danger line.

## Feel (shipped 2026-09-24)
Showy was the brief. Everything below sits behind the `feel knobs` block and is off under
`prefers-reduced-motion`.
- **Merge**: the born orb starts at 1 − `POP_OVERSHOOT` of full size and springs past it (damped
  cosine, settled in about a second), flashes white for a tenth of a second, and neighbours are
  still pushed by the existing radius growth. Particles mix the tier colour with its highlight;
  from Planet up some are streaks. Shake is `SHAKE_BASE · SHAKE_GROW^tier`, so Motes tremble and
  Giants thump. The "+N" float pops in and drifts with an ease-out. Chains: the ×n in the HUD
  pulses, every link raises the merge pitch a semitone, and from `WASH_FROM` links the pocket
  edge washes in the merge colour.
- **Landing**: detected in `updateFx` from the vertical speed collapsing between frames, nothing
  in the constraint loop: a `SQUASH` squash, a sage dust puff, a thud pitched by tier, a 4 ms
  tick. Release plays a soft tick instead of the old thud.
- **Progression**: the first time a run reaches a tier, `reveal()` floats its name in the tier
  colour with a slow ring and an arpeggio. Tier signatures live in `decorate()`: plain to Bead,
  a swirl on Marble, a band on Orb, craters from Moon, seas on Giant, a four-point sparkle on
  Star, a halo on Nova, a corona on Sun; Planet has a ring drawn behind and in front of the body.
- **Danger**: `drawDanger` outlines every orb over the line in coral, stronger as its timer runs;
  a soft tick every quarter second past 0.45 s; and `timeScale` eases towards `SLOW_TO` as the
  timer passes `SLOW_FROM`. Physics time slows, so the loss takes longer in real time and snaps
  back the moment the orb settles.
- **Score**: the counter rolls (`ROLL`); passing the old best mid-run floats a gold "New best"
  once (skipped when there is no old best yet).
- **Game over and revive**: a coral flash inside the box at the moment of loss; cleared orbs
  become `ghosts` that shrink out, with a gold sweep ring from the floor.
- **Sound**: one `DynamicsCompressor` on the output, a one-second noise buffer for `puff()`
  (thuds, dust, the rush of big merges, the revive sweep), arpeggios for reveal and best, a
  danger tick. Sounds that can fire without a gesture (a restored run landing) wait for
  `armed()`, so no AudioContext is created before the first tap.
- **Haptics**: patterns per event (big merge, reveal, best, game over, revive); 4 ms on landing.
  `vib()` waits for a real gesture (`gestured`, plus `navigator.userActivation` where it exists):
  browsers block and log vibrate calls before user activation, and a restored run can land
  before the first tap.
- **Chrome**: press feedback on every button; the highlighted board row slides in.
The harness checks each mechanism and that reduced motion turns them off. Not measured on a
phone yet: if a mid-range device drops frames, lower `PARTS_MAX` first, then the streak share
and particle counts in `fx`.

## Settings (shipped 2026-09-24)
A second bottom sheet, opened from the scores sheet header. Switches for music, sound effects,
haptics and the aim guide, plus the Casual / Rush pair, all in `opt` and persisted with the
save. The bar's sound button is a master mute (`opt.mute`) over both music and effects; `m` on
a keyboard toggles it. `setOpt(k, v)` → `applyOpts()` → `persist()` is the only write path;
`applyOpts` also starts or stops the music and, before the first drop of a run, applies a mode
change to the current run. Sheets pause physics and the Rush clock. Reduced motion drops the
switch animation.

## Music (shipped 2026-09-24)
A generated chiptune, no assets: eight bars in A minor at 150 BPM, two passes with a different
lead in the back half, in the `music` section. Notes are A-minor scale degrees in the pattern
strings ('0' is A4, '7' is A5, letters climb from there); `deg()` turns them into MIDI. Voices:
triangle bass, a 25 % pulse lead (a `PeriodicWave`), square arps, kick / snare / hat from the
noise buffer. Layers follow the run in `musicLayers()`: bass and kick always, snare and hats at
150 points or 8 drops, the lead at 400, chord arps from the first Planet, and a hammered
tension line past 0.3 s of danger, when a low-pass on the whole track also closes and opens
with the loss timer. `musicEvents(step, mask, pass)` is pure; `musicTick` is a 25 ms lookahead
scheduler on the audio clock that queues 150 ms ahead. `duck()` dips the track under big
merges, reveals and the revive; game over fades it and plays a short A minor to E cadence;
Play again restarts it from the top; a hidden tab stops it and a visible one resumes in place.
It starts only after the first gesture (from `audio()`), and only while `opt.music` and the
master mute allow. Verified 2026-09-24 in desktop Chromium by counting scheduled nodes: bass
and kick at the expected rate from the first tap, the drum layer arriving with the drops, no
console errors; a hidden page stops the track by design (the pane had to be made visible to
the page for the check). Not yet heard through a real speaker; the harness checks the
sequencer and the layer gating, not the sound.

## Rush mode (shipped 2026-09-24)
Casual is the original game. Rush adds a shot clock per piece: `RUSH_CLOCK` seconds at score
0 shrinking linearly to `RUSH_CLOCK_MIN` by `RUSH_CLOCK_BY` points; when it runs out the piece
drops where it is aimed (`drop(aimX)`), so play never stalls. The clock runs on real time
(`realDt`, unscaled by slow motion), pauses with any sheet or the ad overlay, is drawn as an
arc around the hover piece that turns coral for the last 30 %, and ticks in the last 0.8 s.
`runMode` is the run's mode (frozen at `reset()` from `opt.mode`, so a switch on the game-over
card or in settings applies to the next run, or at once before the first drop); it is saved in
`live.m` so a restored run keeps it. Records carry `m:'rush'`; the scoreboard has a Casual /
Rush segment (`boardMode`, opening on the mode being played) with per-mode all-time lists,
counts, averages and bests, and a small "rush" tag sits under the best score in the HUD. Rush
is the difficulty ramp backlog #5 asked for, by another route; time attack was considered and
left as a later mode on the same switch.

## Online board (shipped 2026-09-24)
`server/worker.js` is a Cloudflare Worker over one D1 table (`server/schema.sql`,
`server/wrangler.toml`): `GET /top?mode=` returns the top 20 best-per-player rows, `POST /score`
upserts `{cid, mode, name, score, tier}` keeping the higher score, rate limited to six posts a
minute per hashed IP, with plausibility checks only (no accounts, so a determined cheater can
post a fake score; that is the trade-off). The client side sits in the `online board` section:
`BOARD_URL` (a knob; empty keeps everything local; since 2026-09-29 it is the deployed worker,
`https://orbfall-board.jimmycreekwater.workers.dev`, on the owner's Cloudflare account with the D1 database
`orbfall-board`, `ALLOWED_ORIGIN` set to the GitHub Pages origin and `SALT` stored as a Wrangler secret rather
than in `wrangler.toml`), `onlineOn()` needs the
address, the `online` switch and a name; `syncOnline()` posts a mode's best in the background
when it beats `save.sent`, after `recordRun()` and when the board opens, and announces the rank
as a toast (the post carries the seed and the badges of the record behind that best, `bestRec()`, and
the worker keeps them in `seed`/`u`/`v` columns on both tables, replaced only by a higher score; the
columns arrived 2026-09-29 and the live tables were dropped and recreated for them); the board's Online chip renders `loadOnline()`, cached a minute per mode, with the
own row highlighted by `cid` and every message state covered (not connected, no name, off,
loading, unreachable, empty). Names pass `cleanName()` (safe characters, twelve letters) on both
ends and are escaped when rendered. The game never waits on the network. The harness stubs
`fetch` (`g.fetchLog`, `g.fetchReply`).

**The seed board (shipped 2026-09-25).** A second table, `seeds` (one row per seed, mode and player, the
best score kept), behind `GET /seed?seed=&mode=` and `POST /seed`, with the same rate limit, checks and
name filter. `syncSeed()` posts a seeded run's best after `recordRun()` and when the board opens,
remembering what was sent in `save.seedSent`; `loadOnline(mode, seed)` reads it, cached a minute per seed;
the board's Today and Seed chips under Online show it. Today's seed is the UTC date on both sides, so no
call is needed to agree on it. A deployed board needs `schema.sql` run again and a redeploy (PUBLISHING.md).

## Share, previews, landscape, install nudge (shipped 2026-09-24)
`share()` uses the Web Share API with the score, the mode, the seed and the page address; without a share
sheet (desktop browsers, some webviews) `shareOut()` opens the share box (`#sharebox`) with the text and a
Copy button (async clipboard, else select-and-copy), so Share and Challenge always do something visible. Open Graph and Twitter tags plus `icons/share.png` (drawn by tools/icons.js) give
link previews; since 2026-09-28 they carry the live address, `https://jimmycreekwater.github.io/orbfall/`
(GitHub Pages from the `main` branch of github.com/JimmyCreekwater/orbfall, with a `.nojekyll` marker),
and the release script still refuses the old placeholder. A touch device held sideways (`vw > vh`, short height) pauses behind a
"turn your phone" card via the `rotated` flag, which gates drops, physics and the Rush clock.
After two finished runs the game-over card offers the deferred Android install prompt when the
browser gave one, or a one-time iPhone Home Screen hint (`save.hintedInstall`), never when
already standalone. The first-run hint gained a third line about Rush.

## Safety net (shipped 2026-09-24)
`frame()` wraps `frameBody()` in try/catch and keeps requesting frames; `window` error and
unhandled-rejection listeners feed the same `fault()`, which pauses the run, stops the music and
shows the "Something broke" card whose only button calls `reset()`. The harness can break and
repair `render` to test it.

## Do-not-break list
one-tap restart · run resume after app switch · save survives reload · undo marks on board ·
sound stays off until the first gesture (WebAudio unlock) · body `touch-action:none` with the
scoreboard list opting back into `pan-y` · revive capped per run, marked ↻ on the board, and
it clears the undo snapshot · `window.storage` stays first in the store adapter
(artifact saves must remain readable) · `CACHE` in `sw.js` bumped with every release ·
`apple-mobile-web-app-*` meta tags and the `apple-touch-icon` link stay · sprites and layers
rebuilt in `resize()` · `PARTS_MAX` cap · reduced motion switches every feel effect off ·
every option write goes through `setOpt` · `top` keeps 20 per mode · the Rush clock runs on
real time and pauses with the sheets · music starts only from a gesture · `BOARD_URL` empty
keeps the board local and the game never waits on the network · release through the script ·
the wordmark rows in index.html and tools/icons.js stay identical · the ambient budget is the
list in the ground rules · pausing goes through `updatePause()` · the ring keeps ten
snapshots and the paid rescues are once per run · the clean badge means `u` and `v` are both
zero · a seeded run deals from `pieceAt` only · the menu opens on cold launches, not app
switches · the daily seed is the UTC date on the client and the worker · rescues cap at
`RESCUES_PER_RUN` per run and every chooser row counts one · `BAD_ANY`/`BAD_WORD` stay identical in
index.html and server/worker.js · merge motes roll `driftRnd`, never `Math.random` · every inline
wordmark has its own gradient id.
