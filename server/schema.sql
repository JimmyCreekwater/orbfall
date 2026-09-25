-- Orbfall online board: one row per player (cid) and mode; the best score is kept.
CREATE TABLE IF NOT EXISTS scores (
  cid   TEXT    NOT NULL,
  mode  TEXT    NOT NULL,
  name  TEXT    NOT NULL,
  score INTEGER NOT NULL,
  tier  INTEGER NOT NULL,
  ts    INTEGER NOT NULL,
  PRIMARY KEY (cid, mode)
);
CREATE INDEX IF NOT EXISTS scores_mode_score ON scores (mode, score DESC);

-- hashed IPs of recent submissions, kept two minutes, for rate limiting only
CREATE TABLE IF NOT EXISTS hits (
  ip TEXT    NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hits_ip_ts ON hits (ip, ts);
