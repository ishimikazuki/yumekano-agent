-- Initial database schema for Yumekano Agent
-- Based on DATA_MODEL.md specification

-- ============================================
-- 1. Versioned authoring entities
-- ============================================

-- Stable character identity
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Immutable character versions
CREATE TABLE IF NOT EXISTS character_versions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  persona_json TEXT NOT NULL,
  style_json TEXT NOT NULL,
  autonomy_json TEXT NOT NULL,
  emotion_json TEXT NOT NULL,
  memory_policy_json TEXT NOT NULL,
  phase_graph_version_id TEXT NOT NULL,
  prompt_bundle_version_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(character_id, version_number)
);

-- Immutable phase graph versions
CREATE TABLE IF NOT EXISTS phase_graph_versions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  version_number INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(character_id, version_number)
);

-- Immutable prompt bundle versions
CREATE TABLE IF NOT EXISTS prompt_bundle_versions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  version_number INTEGER NOT NULL,
  planner_md TEXT NOT NULL,
  generator_md TEXT NOT NULL,
  extractor_md TEXT NOT NULL,
  reflector_md TEXT NOT NULL,
  ranker_md TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(character_id, version_number)
);

-- Release records
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  channel TEXT NOT NULL DEFAULT 'prod',
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  rollback_of_release_id TEXT REFERENCES releases(id)
);

CREATE INDEX IF NOT EXISTS idx_releases_character_channel ON releases(character_id, channel);

-- ============================================
-- 2. Runtime state
-- ============================================

-- User x Character pairs
CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  canonical_thread_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, character_id)
);

-- Mutable pair state
CREATE TABLE IF NOT EXISTS pair_state (
  pair_id TEXT PRIMARY KEY REFERENCES pairs(id),
  active_character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  active_phase_id TEXT NOT NULL,
  affinity REAL NOT NULL DEFAULT 50,
  trust REAL NOT NULL DEFAULT 50,
  intimacy_readiness REAL NOT NULL DEFAULT 0,
  conflict REAL NOT NULL DEFAULT 0,
  pad_json TEXT NOT NULL,
  pad_fast_json TEXT,
  pad_slow_json TEXT,
  pad_combined_json TEXT,
  last_emotion_updated_at TEXT,
  appraisal_json TEXT NOT NULL,
  open_thread_count INTEGER NOT NULL DEFAULT 0,
  last_transition_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chat turn records
CREATE TABLE IF NOT EXISTS chat_turns (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  thread_id TEXT NOT NULL,
  user_message_text TEXT NOT NULL,
  assistant_message_text TEXT NOT NULL,
  planner_json TEXT,
  ranker_json TEXT,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_turns_pair ON chat_turns(pair_id, created_at DESC);

-- ============================================
-- 3. Memory entities
-- ============================================

-- Episodic events
CREATE TABLE IF NOT EXISTS memory_events (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  source_turn_id TEXT REFERENCES chat_turns(id),
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  salience REAL NOT NULL,
  retrieval_keys_json TEXT NOT NULL,
  emotion_signature_json TEXT,
  participants_json TEXT NOT NULL,
  quality_score REAL,
  supersedes_event_id TEXT REFERENCES memory_events(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_events_pair ON memory_events(pair_id, created_at DESC);

-- Graph facts
CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'disputed')),
  supersedes_fact_id TEXT REFERENCES memory_facts(id),
  source_event_id TEXT REFERENCES memory_events(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_pair ON memory_facts(pair_id, status);
CREATE INDEX IF NOT EXISTS idx_memory_facts_subject ON memory_facts(subject, predicate);

-- Observation blocks
CREATE TABLE IF NOT EXISTS memory_observations (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  summary TEXT NOT NULL,
  retrieval_keys_json TEXT NOT NULL,
  salience REAL NOT NULL,
  quality_score REAL,
  window_start_at TEXT NOT NULL,
  window_end_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memory_observations_pair ON memory_observations(pair_id, created_at DESC);

-- Open threads
CREATE TABLE IF NOT EXISTS memory_open_threads (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  key TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  opened_by_event_id TEXT REFERENCES memory_events(id),
  resolved_by_event_id TEXT REFERENCES memory_events(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pair_id, key)
);

CREATE INDEX IF NOT EXISTS idx_memory_open_threads_pair ON memory_open_threads(pair_id, status);

-- Memory usage analytics
CREATE TABLE IF NOT EXISTS memory_usage (
  id TEXT PRIMARY KEY,
  memory_item_type TEXT NOT NULL,
  memory_item_id TEXT NOT NULL,
  turn_id TEXT NOT NULL REFERENCES chat_turns(id),
  was_selected INTEGER NOT NULL,
  was_helpful INTEGER,
  score_delta REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 4. Evaluation entities
-- ============================================

-- Scenario sets
CREATE TABLE IF NOT EXISTS scenario_sets (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scenario cases
CREATE TABLE IF NOT EXISTS scenario_cases (
  id TEXT PRIMARY KEY,
  scenario_set_id TEXT NOT NULL REFERENCES scenario_sets(id),
  title TEXT NOT NULL,
  input_json TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eval runs
CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  scenario_set_id TEXT NOT NULL REFERENCES scenario_sets(id),
  character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  model_registry_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  summary_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Eval case results
CREATE TABLE IF NOT EXISTS eval_case_results (
  id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
  scenario_case_id TEXT NOT NULL REFERENCES scenario_cases(id),
  scores_json TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failure_reasons_json TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- 5. Trace entities
-- ============================================

-- Turn traces for inspection
CREATE TABLE IF NOT EXISTS turn_traces (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  prompt_bundle_version_id TEXT NOT NULL REFERENCES prompt_bundle_versions(id),
  model_ids_json TEXT NOT NULL,
  phase_id_before TEXT NOT NULL,
  phase_id_after TEXT NOT NULL,
  emotion_before_json TEXT NOT NULL,
  emotion_after_json TEXT NOT NULL,
  emotion_state_before_json TEXT,
  emotion_state_after_json TEXT,
  relationship_before_json TEXT,
  relationship_after_json TEXT,
  relationship_deltas_json TEXT,
  phase_transition_evaluation_json TEXT,
  prompt_assembly_hashes_json TEXT,
  appraisal_json TEXT NOT NULL,
  retrieved_memory_ids_json TEXT NOT NULL,
  memory_threshold_decisions_json TEXT,
  coe_contributions_json TEXT,
  plan_json TEXT NOT NULL,
  candidates_json TEXT NOT NULL,
  winner_index INTEGER NOT NULL,
  memory_writes_json TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_turn_traces_pair ON turn_traces(pair_id, created_at DESC);

-- ============================================
-- 6. Working memory (stored as JSON in pair_state)
-- This table is for explicit working memory persistence if needed
-- ============================================

CREATE TABLE IF NOT EXISTS working_memory (
  pair_id TEXT PRIMARY KEY REFERENCES pairs(id),
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
