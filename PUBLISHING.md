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
   This is what makes a shared link show a picture and a description. (The empty `.nojekyll` file in the
   folder tells Pages to serve the files exactly as they are; keep it.)
5. **Release.** Every time you change anything, run:

   ```bash
   npm run release
   ```
   It bumps the version, writes it into the service worker so installed copies update, runs the tests, and
   prints the four git commands to run next (add, commit, tag, push). Run them. GitHub Pages picks up the push
   within a minute or two. A device that already has the game picks the new build up in the background and
   switches to it by itself the next time it is on the home screen; the foot of the Settings sheet says which
   build a device is running, so check there before deciding an update did not arrive.
6. **Check it on a phone.** Open the address in Chrome on Android and Safari on iPhone. Play a run. Use
   "Add to home screen" (Android offers it after two runs; on iPhone use Share → Add to Home Screen). Open the
   installed icon and check the run resumed.

Own domain later: buy one, add it under **Settings** → **Pages** → **Custom domain**, then update the two
address lines from step 4 and release again.

## Part 2: the online scoreboard (Cloudflare)

The board is a tiny program (`server/worker.js`) and a tiny database that live on Cloudflare's free plan.
Players send their best score per mode, and their best on each seed they play (today's seed, a challenge, a
typed seed); the board's **Online ranking** shows the top 20, and its **Today** and **Seed** tabs the top 20 on that
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
   `PASTE-THE-ID-PRINTED-BY-wrangler-d1-create`.
4. **Create the tables.** Run this again whenever `server/schema.sql` changes; it only adds what is missing.

   ```bash
   wrangler d1 execute orbfall-board --remote --file=schema.sql
   ```
5. **Put the program online.**

   ```bash
   wrangler deploy
   ```
   The last line is the address, like `https://orbfall-board.NAME.workers.dev`. Copy it.
6. **Give it its salt.** The board hashes visitors' addresses for rate limiting, mixed with a salt that lives on
   Cloudflare as a secret, never in this folder:

   ```bash
   wrangler secret put SALT
   ```
   It asks for a value; type any random words and press Enter. Once is enough.
7. **Connect the game to it.** Open `index.html`, find `var BOARD_URL='';` (in the tuning knobs near the top)
   and put the address between the quotes. Then `npm run release` and the git commands, as in Part 1.
8. **Try it.** In the game: Settings → type a name → play a run → open Scores → **Online ranking**. Your score should be
   there. From a second phone, another name and score should appear on both.

Changing the board later: edit `server/worker.js`, run `wrangler deploy` again; if `schema.sql` changed, run
step 4 first. The game does not need a new release for that. To wipe the boards:
`wrangler d1 execute orbfall-board --remote --command "DELETE FROM scores; DELETE FROM seeds"`.

**Deployed the board before 2026-09-29?** The tables gained columns (the seed and the badges of each best run),
and `schema.sql` cannot add columns to tables that already exist. From `orbfall/server`, drop the two score tables
(this forgets every score on the board), then run step 4 and step 5 again:

```bash
wrangler d1 execute orbfall-board --remote --command "DROP TABLE scores; DROP TABLE seeds"
```

## Part 3: before you tell people

- Play on the weakest phone you can borrow and watch for dropped frames during a big merge; if it stutters,
  lower `PARTS_MAX` in `index.html`.
- Listen to the track and the effects on a real speaker and with earbuds; every level was set by ear from
  nothing. The Music and Sound effects switches are in Settings.
- Try the Share button from a game-over card; the link it sends should unfurl with the picture.
- Keep the release routine: `npm run release`, then the git commands it prints. Never edit `sw.js` by hand.

## Part 4: ads (rewarded only)

The game never forces an ad. An undo or a rescue past the free ones asks "Watch an ad?", and only a watched ad
unlocks it. The ads come from Google's AdSense programme for HTML5 games. All of it is built and switched off
until the steps below are done. To see the whole flow today with Google's sample ads, add `?adtest` to the game's
address, for example `https://NAME.github.io/orbfall/?adtest`.

This is the one part that costs money: a domain, about 10 dollars a year. Google will not take a github.io
address, because the `ads.txt` file below has to sit at the very top of a site you own.

1. **Get a domain and point it at the game.** Buy one at any registrar, with privacy protection on so your name
   is not in the public record. In the repository on GitHub: **Settings** → **Pages** → **Custom domain**, type
   the domain, save, and add the DNS records GitHub shows at your registrar. Tick **Enforce HTTPS** when it is
   offered. Then put the new address in the two `og:` lines of `index.html` (Part 1, step 4), and set
   `ALLOWED_ORIGIN` in `server/wrangler.toml` to it and run `wrangler deploy`, so the scoreboard accepts it.
   One cost of moving: scores a player's browser kept under the old address do not follow to the new one. The
   online ranking is not affected. Move early, while few people play.
2. **Open an AdSense account** at adsense.google.com with that domain as your site. Google asks for your real
   name and address for payments; that stays between you and Google. In **Account** → **Settings** → **Account
   information**, set **Seller information visibility** to **Confidential**, so the public sellers list shows a
   number and no name.
3. **Copy your publisher id** from the same page. It looks like `ca-pub-1234567890123456`.
4. **Put it in four places** (or hand the id to Claude Code and say "switch the ads on in test mode"):
   - `index.html`, in the tuning knobs: `var AD_CLIENT='ca-pub-1234567890123456';` Leave `AD_TEST=true`.
   - `index.html`, inside `<head>`: `<meta name="google-adsense-account" content="ca-pub-1234567890123456">`
   - a new file `ads.txt` next to `index.html`, holding one line (your number, without the `ca-`):
     `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0`
   - `privacy.html`: replace `CONTACT-EMAIL-HERE` (twice, on one line) with an address people can write to,
     such as `hello@yourdomain`. Most registrars, and Cloudflare, forward such an address to your inbox for free.

   Then `npm run release` and the git commands. The release script refuses to ship if any of the four is
   missing. From here players see Google's sample ad in place of the old placeholder, and still get their
   reward; Settings gains a Privacy link.
5. **Switch on the consent message.** In AdSense: **Privacy & messaging** → **European regulations** → create a
   message, choose your site, publish. Do the same under **US state regulations**. Google's own code shows it
   to the players it applies to; nothing changes in the game.
6. **Wait for Google to approve the site, then apply for H5 Games Ads.** The form is linked from
   https://developers.google.com/ad-placement/docs/signup. Both are reviews by Google, can take days to weeks,
   and are Google's decision.
7. **Go live.** When the H5 Games Ads approval arrives: `var AD_TEST=false;` in `index.html`, then
   `npm run release` and the git commands. Real ads from here on.

House rules that keep the account safe: never tap your own ads, and do not ask friends to. To look at the flow,
use `?adtest`: it shows sample ads and counts for nothing.

## What the game stores and where

On the phone: scores, settings and the run in progress, in the browser's local storage. On the board (only if
connected and a name is set): player id, name, best score and size reached per mode, and the same per seed
played. There are no accounts,
no analytics and no cookies of the game's own. Ads are built in but off until Part 4 is done; once on,
Google's ad service uses cookies or similar identifiers, which is what `privacy.html` tells players.
