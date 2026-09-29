// Orbfall online board: a Cloudflare Worker over two D1 (SQLite) tables. One row per player and mode on the
// overall board, and one row per player, mode and seed on the seed board; the best score wins. Nothing but a player
// id the game made up, a name they typed, a score, a tier, the seed of that best run and its badges (u = moves
// undone, v = clears) is stored. IPs are hashed with SALT and kept for two minutes, only to slow down floods.
// Names must pass the same filter the game uses.
//
//   GET  /top?mode=casual|rush                      -> { rows: [{ cid, name, score, tier, seed, u, v, ts }] }   the top 20
//   POST /score  { cid, mode, name, score, tier, seed?, u?, v? }         -> { ok: true, rank }
//   GET  /seed?seed=CODE&mode=casual|rush           -> { rows: [{ cid, name, score, tier, seed, u, v, ts }] }   the top 20 on that seed
//   POST /seed   { cid, mode, seed, name, score, tier, u?, v? }          -> { ok: true, rank }
//
// Six posts a minute per IP across both. Deploy: see PUBLISHING.md. Anti-cheat is plausibility only (score and tier
// ranges); a determined cheater can post a fake score, which is the trade-off of a board with no accounts.
const BAD_ANY = ['fuck', 'nigg', 'faggot', 'kike'];
const BAD_WORD = ['shit', 'bitch', 'cunt', 'asshole', 'pussy', 'twat', 'whore', 'slut', 'bastard', 'ass', 'retard', 'spic', 'chink', 'wetback', 'tranny', 'dyke', 'fag', 'rapist', 'nazi', 'hitler'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
function nameOK(s) {
  const n = String(s || '').toLowerCase().replace(/[0134578@$!|]/g, c => LEET[c]);
  const joined = n.replace(/[^a-z]/g, ''), squashed = joined.replace(/(.)\1+/g, '$1');
  if (BAD_ANY.some(w => joined.includes(w) || squashed.includes(w))) return false;
  const words = n.split(/[^a-z]+/).filter(Boolean).concat([joined, squashed]);
  return !words.some(w => BAD_WORD.includes(w) || BAD_WORD.includes(w.replace(/(.)\1+/g, '$1')));
}
const cleanName = s => String(s || '').replace(/[^\w .'-]/g, '').trim().slice(0, 12);
const ROW = 'cid, name, score, tier, seed, u, v, ts';

export default {
  async fetch(req, env) {
    const cors = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store'
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const modeOf = s => { const m = String(s || '').toLowerCase(); return m === 'casual' || m === 'rush' ? m : null; };
    const seedOf = s => { const c = String(s || '').toUpperCase(); return /^[A-Z0-9]{1,12}$/.test(c) ? c : null; };
    const count = x => { const n = Math.floor(Number(x)); return n >= 0 && n <= 9999 ? n : 0; };
    try {
      if (req.method === 'GET' && url.pathname === '/top') {
        const mode = modeOf(url.searchParams.get('mode'));
        if (!mode) return json({ error: 'mode must be casual or rush' }, 400);
        const { results } = await env.DB.prepare(`SELECT ${ROW} FROM scores WHERE mode = ? ORDER BY score DESC, ts ASC LIMIT 20`).bind(mode).all();
        return json({ rows: results });
      }
      if (req.method === 'GET' && url.pathname === '/seed') {
        const mode = modeOf(url.searchParams.get('mode')), seed = seedOf(url.searchParams.get('seed'));
        if (!mode || !seed) return json({ error: 'seed and mode needed' }, 400);
        const { results } = await env.DB.prepare(`SELECT ${ROW} FROM seeds WHERE seed = ? AND mode = ? ORDER BY score DESC, ts ASC LIMIT 20`).bind(seed, mode).all();
        return json({ rows: results });
      }
      if (req.method === 'POST' && (url.pathname === '/score' || url.pathname === '/seed')) {
        const ip = await hash((req.headers.get('cf-connecting-ip') || 'unknown') + (env.SALT || ''));
        const now = Date.now();
        const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE ip = ? AND ts > ?').bind(ip, now - 60000).first('n');
        if (recent >= 6) return json({ error: 'slow down' }, 429);
        let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
        const mode = modeOf(b.mode), cid = String(b.cid || ''), name = cleanName(b.name);
        const score = Math.floor(Number(b.score)), tier = Math.floor(Number(b.tier)), u = count(b.u), v = count(b.v);
        if (!/^[a-f0-9]{16}$/.test(cid) || !mode || !name || !(score >= 1 && score <= 200000) || !(tier >= 0 && tier <= 10)) return json({ error: 'bad score' }, 400);
        if (!nameOK(name)) return json({ error: 'name' }, 400);
        const isSeed = url.pathname === '/seed', seed = seedOf(b.seed);
        if (isSeed && !seed) return json({ error: 'bad seed' }, 400);
        // on a better score the seed and badges of that run replace the old ones; on a tie the old run stands
        const upsert = isSeed
          ? env.DB.prepare('INSERT INTO seeds (seed, mode, cid, name, score, tier, u, v, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(seed, mode, cid) DO UPDATE SET name = excluded.name, tier = MAX(seeds.tier, excluded.tier), ' +
            'u = CASE WHEN excluded.score > seeds.score THEN excluded.u ELSE seeds.u END, ' +
            'v = CASE WHEN excluded.score > seeds.score THEN excluded.v ELSE seeds.v END, ' +
            'ts = CASE WHEN excluded.score > seeds.score THEN excluded.ts ELSE seeds.ts END, score = MAX(seeds.score, excluded.score)')
            .bind(seed, mode, cid, name, score, tier, u, v, now)
          : env.DB.prepare('INSERT INTO scores (cid, mode, name, score, tier, seed, u, v, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(cid, mode) DO UPDATE SET name = excluded.name, tier = MAX(scores.tier, excluded.tier), ' +
            'seed = CASE WHEN excluded.score > scores.score THEN excluded.seed ELSE scores.seed END, ' +
            'u = CASE WHEN excluded.score > scores.score THEN excluded.u ELSE scores.u END, ' +
            'v = CASE WHEN excluded.score > scores.score THEN excluded.v ELSE scores.v END, ' +
            'ts = CASE WHEN excluded.score > scores.score THEN excluded.ts ELSE scores.ts END, score = MAX(scores.score, excluded.score)')
            .bind(cid, mode, name, score, tier, seed, u, v, now);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO hits (ip, ts) VALUES (?, ?)').bind(ip, now),
          env.DB.prepare('DELETE FROM hits WHERE ts < ?').bind(now - 120000),
          upsert
        ]);
        const rank = isSeed
          ? await env.DB.prepare('SELECT COUNT(*) + 1 AS r FROM seeds WHERE seed = ? AND mode = ? AND score > (SELECT score FROM seeds WHERE seed = ? AND mode = ? AND cid = ?)').bind(seed, mode, seed, mode, cid).first('r')
          : await env.DB.prepare('SELECT COUNT(*) + 1 AS r FROM scores WHERE mode = ? AND score > (SELECT score FROM scores WHERE cid = ? AND mode = ?)').bind(mode, cid, mode).first('r');
        return json({ ok: true, rank });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500);
    }
  }
};

async function hash(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('');
}
