-- Orbfall online board: one row per player (cid) and mode; the best score is kept, with the seed of that best run
-- (empty for free play) and its badges: u = moves undone, v = clears. (Columns added 2026-09-29; a board created
-- before that needs its tables dropped and this file run again, or an ALTER TABLE ... ADD COLUMN for each.)
CREATE TABLE IF NOT EXISTS scores (
  cid   TEXT    NOT NULL,
  mode  TEXT    NOT NULL,
  name  TEXT    NOT NULL,
  score INTEGER NOT NULL,
  tier  INTEGER NOT NULL,
  seed  TEXT,
  u     INTEGER NOT NULL DEFAULT 0,
  v     INTEGER NOT NULL DEFAULT 0,
  ts    INTEGER NOT NULL,
  PRIMARY KEY (cid, mode)
);
CREATE INDEX IF NOT EXISTS scores_mode_score ON scores (mode, score DESC);

-- the seed board: one row per seed, mode and player; the best score is kept. Today's seed and challenge seeds both
-- live here, keyed by the code.
CREATE TABLE IF NOT EXISTS seeds (
  seed  TEXT    NOT NULL,
  mode  TEXT    NOT NULL,
  cid   TEXT    NOT NULL,
  name  TEXT    NOT NULL,
  score INTEGER NOT NULL,
  tier  INTEGER NOT NULL,
  u     INTEGER NOT NULL DEFAULT 0,
  v     INTEGER NOT NULL DEFAULT 0,
  ts    INTEGER NOT NULL,
  PRIMARY KEY (seed, mode, cid)
);
CREATE INDEX IF NOT EXISTS seeds_seed_mode_score ON seeds (seed, mode, score DESC);

-- hashed IPs of recent submissions, kept two minutes, for rate limiting only
CREATE TABLE IF NOT EXISTS hits (
  ip TEXT    NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hits_ip_ts ON hits (ip, ts);
