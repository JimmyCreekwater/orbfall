# Publishing Orbfall

Plain-language steps. Each part is independent: the game can go live without the online board, and the
board can be added later. Everything here is free at this size.

## Part 1: put the game on the internet (GitHub Pages)

You need: a free GitHub account, and this folder as it is (it is already a git repository).

1. **Make an empty home for it on GitHub.** Sign in at github.com, click the **+** at the top right,
   choose **New repository**, name it `orbfall`, leave everything else alone, click **Create repository**.
2. **Send this folder up.** In a terminal inside the `orbfall` folder, run the three lines GitHub shows under
   "push an existing repository", which look like this (your username instead of `NAME`):

   ```bash
   git remote add origin https://github.com/NAME/orbfall.git
   ```
   ```bash
   git push -u origin main
   ```
   GitHub will ask you to sign in the first time.
3. **Switch on Pages.** On the repository page: **Settings** → **Pages** → under "Build and deployment" set
   **Source** to *Deploy from a branch*, **Branch** to `main` and the folder to `/ (root)`, then **Save**.
   After a minute the page shows your address: `https://NAME.github.io/orbfall/`.
4. **Tell the game its own address.** Open `index.html`, find the two lines that say `https://orbfall.example`
   (they are near the top, `og:url` and `og:image`) and replace that part with your address, keeping the rest,
   for example `https://NAME.github.io/orbfall/` and `https://NAME.github.io/orbfall/icons/share.png`.
   This is what makes a shared link show a picture and a description.
5. **Release.** Every time you change anything, run:

   ```bash
   npm run release
   ```
   It bumps the version, writes it into the service worker so installed copies update, runs the tests, and
   prints the four git commands to run next (add, commit, tag, push). Run them. GitHub Pages picks up the push
   within a minute or two.
6. **Check it on a phone.** Open the address in Chrome on Android and Safari on iPhone. Play a run. Use
   "Add to home screen" (Android offers it after two runs; on iPhone use Share → Add to Home Screen). Open the
   installed icon and check the run resumed.

Own domain later: buy one, add it under **Settings** → **Pages** → **Custom domain**, then update the two
address lines from step 4 and release again.

## Part 2: the online scoreboard (Cloudflare)

The board is a tiny program (`server/worker.js`) and a tiny database that live on Cloudflare's free plan.
Players send their best score per mode, and their best on each seed they play (today's seed, a challenge, a
typed seed); the board's **Online** tab shows the top 20, and its **Today** and **Seed** tabs the top 20 on that
seed. Nothing else is collected: a random player id the game makes up, the name, the score, the size reached
and the seed. Names are checked for slurs on the phone and again by the worker.
Visitors' addresses are hashed and forgotten after two minutes; they only slow down floods.

You need: a free Cloudflare account, and Node (you have it, the tests use it).

1. **Sign up** at cloudflare.com (free plan). Nothing else to set up on the site.
2. **Install the Cloudflare tool once** and sign in with it. In a terminal:

   ```bash
   npm install -g wrangler
   ```
   ```bash
   wrangler login
   ```
   A browser tab opens; allow it.
3. **Create the database.** From inside the `orbfall/server` folder:

   ```bash
   wrangler d1 create orbfall-board
   ```
   It prints a block with a `database_id = "…"` line. Open `server/wrangler.toml` and paste that id in place of
   `PASTE-THE-ID-PRINTED-BY-wrangler-d1-create`. While you are there, change `SALT` to any random words.
4. **Create the tables.** Run this again whenever `server/schema.sql` changes; it only adds what is missing.

   ```bash
   wrangler d1 execute orbfall-board --remote --file=schema.sql
   ```
5. **Put the program online.**

   ```bash
   wrangler deploy
   ```
   The last line is the address, like `https://orbfall-board.NAME.workers.dev`. Copy it.
6. **Connect the game to it.** Open `index.html`, find `var BOARD_URL='';` (in the tuning knobs near the top)
   and put the address between the quotes. Then `npm run release` and the git commands, as in Part 1.
7. **Try it.** In the game: Settings → type a name → play a run → open Scores → **Online**. Your score should be
   there. From a second phone, another name and score should appear on both.

Changing the board later: edit `server/worker.js`, run `wrangler deploy` again; if `schema.sql` changed, run
step 4 first. The game does not need a new release for that. To wipe the boards:
`wrangler d1 execute orbfall-board --remote --command "DELETE FROM scores; DELETE FROM seeds"`.

**Deployed the board before 2026-09-25?** The seed board needs the new table and the new worker: from
`orbfall/server`, run step 4 and step 5 again.

## Part 3: before you tell people

- Play on the weakest phone you can borrow and watch for dropped frames during a big merge; if it stutters,
  lower `PARTS_MAX` in `index.html`.
- Listen to the track and the effects on a real speaker and with earbuds; every level was set by ear from
  nothing. The Music and Sound effects switches are in Settings.
- Try the Share button from a game-over card; the link it sends should unfurl with the picture.
- Keep the release routine: `npm run release`, then the git commands it prints. Never edit `sw.js` by hand.

## What the game stores and where

On the phone: scores, settings and the run in progress, in the browser's local storage. On the board (only if
connected and a name is set): player id, name, best score and size reached per mode, and the same per seed
played. There are no accounts,
no cookies, no analytics and no ads in this build. If you add ads later (the reward hook in `index.html` is
the place), most ad networks will ask you to publish a privacy page saying so.
