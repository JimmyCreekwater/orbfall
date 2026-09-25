// Orbfall online board: a Cloudflare Worker over one D1 (SQLite) table. One row per player and mode; the best
// score wins. Nothing but a player id the game made up, a name they typed, a score and a tier is stored. IPs are
// hashed with SALT and kept for two minutes, only to slow down floods.
//
//   GET  /top?mode=casual|rush                     -> { rows: [{ cid, name, score, tier, ts }] }   the top 20
//   POST /score  { cid, mode, name, score, tier }  -> { ok: true, rank }                            6 per minute per IP
//
// Deploy: see PUBLISHING.md. Anti-cheat is plausibility only (score and tier ranges); a determined cheater can post
// a fake score, which is the trade-off of a board with no accounts.
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
    try {
      if (req.method === 'GET' && url.pathname === '/top') {
        const mode = (url.searchParams.get('mode') || '').toLowerCase();
        if (mode !== 'casual' && mode !== 'rush') return json({ error: 'mode must be casual or rush' }, 400);
        const { results } = await env.DB.prepare('SELECT cid, name, score, tier, ts FROM scores WHERE mode = ? ORDER BY score DESC, ts ASC LIMIT 20').bind(mode).all();
        return json({ rows: results });
      }
      if (req.method === 'POST' && url.pathname === '/score') {
        const ip = await hash((req.headers.get('cf-connecting-ip') || 'unknown') + (env.SALT || ''));
        const now = Date.now();
        const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE ip = ? AND ts > ?').bind(ip, now - 60000).first('n');
        if (recent >= 6) return json({ error: 'slow down' }, 429);
        let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
        const mode = String(b.mode || '').toLowerCase();
        const cid = String(b.cid || ''), name = String(b.name || '').replace(/[^\w .'-]/g, '').trim().slice(0, 12);
        const score = Math.floor(Number(b.score)), tier = Math.floor(Number(b.tier));
        if (!/^[a-f0-9]{16}$/.test(cid) || (mode !== 'casual' && mode !== 'rush') || !name || !(score >= 1 && score <= 200000) || !(tier >= 0 && tier <= 10)) return json({ error: 'bad score' }, 400);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO hits (ip, ts) VALUES (?, ?)').bind(ip, now),
          env.DB.prepare('DELETE FROM hits WHERE ts < ?').bind(now - 120000),
          env.DB.prepare('INSERT INTO scores (cid, mode, name, score, tier, ts) VALUES (?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(cid, mode) DO UPDATE SET name = excluded.name, tier = MAX(scores.tier, excluded.tier), ' +
            'ts = CASE WHEN excluded.score > scores.score THEN excluded.ts ELSE scores.ts END, score = MAX(scores.score, excluded.score)')
            .bind(cid, mode, name, score, tier, now)
        ]);
        const rank = await env.DB.prepare('SELECT COUNT(*) + 1 AS r FROM scores WHERE mode = ? AND score > (SELECT score FROM scores WHERE cid = ? AND mode = ?)').bind(mode, cid, mode).first('r');
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
