# Orbfall

A single-file, one-thumb merge-drop game for mobile browsers: an orrery on a card table, with
celestial orbs falling through a night-sky pocket framed in brass. Open `index.html` on a phone
(or serve the folder and open it on one) and play. Drag to aim, release to drop; two of a kind
merge; stack past the line and the run ends. One revive per run clears the smallest orbs and
lets you carry on.

## Run
Any static host works. Locally: `npx serve .` then open the URL on your phone, or just open
`index.html` in a desktop browser (arrow keys aim, space drops, z undoes, r revives at game
over, s opens scores, m mutes, Escape pauses). Scores and the in-progress run are saved in the
browser's localStorage.

The first launch asks for a name (it goes on the boards; clearly offensive names are refused, ordinary
words like Glass pass). Then the game opens on a menu: Play, the mode, Play today (everyone gets the same
pieces on the day's seed, which rolls over at midnight UTC), Other seed (type any word or number, or take a
random code; friends on the same seed get the same pieces), Scores, Settings and Challenge. The brass mark at the top of the play screen is
the pause button. Challenge shares a link with the seed; whoever opens it plays the same sequence of pieces, and the
board's Seed and Today tabs (Online) show everyone's best on that seed. Where there is no share sheet,
Share and Challenge show the text with a Copy button. At game over, Rescue this run offers Undo 1 (free
once), Undo 5 (an ad), Undo 10 (two ads) and Clear the smallest orbs; a run gets two rescues, then the
button is struck through; runs finished without any rescue wear a ✦ on the board.

Served over http(s) it is an installable web app: Android Chrome offers "Install app" (or
Add to Home screen), iOS uses Share → Add to Home Screen. The app shell is cached by `sw.js`,
so it opens offline. After changing `index.html`, bump `CACHE` in `sw.js` or installed copies
keep the old build. Opening the file from disk still works but skips the service worker.

Settings sit behind the scores sheet: music, sound effects, haptics, the aim guide, the mode and
a name for the online board. Casual is endless; Rush adds a shot clock that tightens as you
score and keeps its own board. The soundtrack is generated in the page, no files, and starts
after the first tap.

## Publish
`PUBLISHING.md` walks through hosting the game on GitHub Pages, standing up the online
scoreboard on Cloudflare (`server/`), and the release routine: `npm run release`, then the git
commands it prints. Link previews need your real address in the two `og:` tags in `index.html`;
the release script refuses to ship the placeholder.

## Test
`npm test` — headless Node checks (no dependencies): physics stays bounded and merges/game
overs occur; runs are recorded; scoreboard filters render; free and ad-gated undo work; an
in-progress run restores after a reload; a reload never wipes the save; the storage adapter
works with localStorage alone (and survives one that throws); the revive clears the smallest
orbs once per run, free first then ad-gated, and marks the run; the feel pass (sprites, landing
squash and dust, merge pop and flash, tier reveals, score roll, chain wash, slow motion, revive
ghosts, the particle cap) works and switches off under reduced motion; settings persist and
the master mute works; the music sequencer and its layers; Rush's shot clock, its pauses, its
records and boards; seeds deal the same pieces, survive undo and reload, start from links and
land on the Today board; the menu and pause sheet keep the game paused behind them; the rescue
chooser's ring, ad counts, caps, the two-rescue limit and the clean badge; the name gate and filter; typed
and random seeds; the share box; the seed board; merge motes; the crash card catches a throwing frame;
sharing, the landscape card and
the install nudge; the online board posts a best score once and renders the shared top; the
manifest, icons and service worker hold together (shell precached, stale caches dropped,
cache-first offline). The suite is seeded, so it is the same run every time.

`npm run icons` redraws `icons/` from `tools/icons.js` (the brass orb over a star field, and the
link-preview image with the pixel wordmark). Only needed if the mark changes; the PNGs are
checked in.

## Working on it with Claude Code
`CLAUDE.md` holds the design record, the physics notes, the persistence schema and an ordered
backlog (items 1–4 and 7 shipped). A good next prompt: "Read CLAUDE.md, run npm test, then do
backlog item 5, keeping the tests green."
