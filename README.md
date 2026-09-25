# Orbfall

A single-file, one-thumb merge-drop game for mobile browsers. Open `index.html` on a phone
(or serve the folder and open it on one) and play. Drag to aim, release to drop; two of a kind
merge; stack past the line and the run ends. One revive per run clears the smallest orbs and
lets you carry on.

## Run
Any static host works. Locally: `npx serve .` then open the URL on your phone, or just open
`index.html` in a desktop browser (arrow keys aim, space drops, z undoes, r revives at game
over, s opens scores, m mutes). Scores and the in-progress run are saved in the browser's
localStorage.

Served over http(s) it is an installable web app: Android Chrome offers "Install app" (or
Add to Home screen), iOS uses Share → Add to Home Screen. The app shell is cached by `sw.js`,
so it opens offline. After changing `index.html`, bump `CACHE` in `sw.js` or installed copies
keep the old build. Opening the file from disk still works but skips the service worker.

Settings sit behind the scores sheet: music, sound effects, haptics, the aim guide and the
mode. Casual is endless; Rush adds a shot clock that tightens as you score and keeps its own
board. The soundtrack is generated in the page, no files, and starts after the first tap.

## Test
`npm test` — headless Node checks (no dependencies): physics stays bounded and merges/game
overs occur; runs are recorded; scoreboard filters render; free and ad-gated undo work; an
in-progress run restores after a reload; a reload never wipes the save; the storage adapter
works with localStorage alone (and survives one that throws); the revive clears the smallest
orbs once per run, free first then ad-gated, and marks the run; the feel pass (sprites, landing
squash and dust, merge pop and flash, tier reveals, score roll, chain wash, slow motion, revive
ghosts, the particle cap) works and switches off under reduced motion; settings persist and
the master mute works; the music sequencer and its layers; Rush's shot clock, its pauses, its
records and boards; the manifest, icons and service worker hold together (shell precached,
stale caches dropped, cache-first offline).

`npm run icons` redraws `icons/` from `tools/icons.js` (the brass orb on felt). Only needed if
the mark changes; the PNGs are checked in.

## Working on it with Claude Code
`CLAUDE.md` holds the design record, the physics notes, the persistence schema and an ordered
backlog (items 1–3 shipped). A good next prompt: "Read CLAUDE.md, run npm test, then do
backlog item 4, keeping the tests green and adding one for the daily seed."
