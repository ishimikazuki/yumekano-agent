CREATE TABLE IF NOT EXISTS sandbox_memory_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  source_turn_id TEXT REFERENCES playground_turns(id),
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  salience REAL NOT NULL,
  retrieval_keys_json TEXT NOT NULL,
  emotion_signature_json TEXT,
  participants_json TEXT NOT NULL,
  quality_score REAL,
  supersedes_event_id TEXT REFERENCES sandbox_memory_events(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sandbox_memory_events_session
  ON sandbox_memory_events(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sandbox_memory_facts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'disputed')),
  supersedes_fact_id TEXT REFERENCES sandbox_memory_facts(id),
  source_event_id TEXT REFERENCES sandbox_memory_events(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sandbox_memory_facts_session
  ON sandbox_memory_facts(session_id, status);
CREATE INDEX IF NOT EXISTS idx_sandbox_memory_facts_subject
  ON sandbox_memory_facts(session_id, subject, predicate);

CREATE TABLE IF NOT EXISTS sandbox_memory_observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  summary TEXT NOT NULL,
  retrieval_keys_json TEXT NOT NULL,
  salience REAL NOT NULL,
  quality_score REAL,
  window_start_at TEXT NOT NULL,
  window_end_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sandbox_memory_observations_session
  ON sandbox_memory_observations(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sandbox_memory_open_threads (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  key TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  opened_by_event_id TEXT REFERENCES sandbox_memory_events(id),
  resolved_by_event_id TEXT REFERENCES sandbox_memory_events(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, key)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_memory_open_threads_session
  ON sandbox_memory_open_threads(session_id, status);

CREATE TABLE IF NOT EXISTS sandbox_memory_usage (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  memory_item_type TEXT NOT NULL,
  memory_item_id TEXT NOT NULL,
  turn_id TEXT NOT NULL REFERENCES playground_turns(id),
  was_selected INTEGER NOT NULL,
  was_helpful INTEGER,
  score_delta REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
