import { getDb } from './client';

/**
 * Initial migration SQL - PostgreSQL compatible
 */
const MIGRATION_001_INITIAL = `
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, version_number)
);

CREATE TABLE IF NOT EXISTS phase_graph_versions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  version_number INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, version_number)
);

CREATE TABLE IF NOT EXISTS prompt_bundle_versions (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  version_number INTEGER NOT NULL,
  planner_md TEXT NOT NULL,
  generator_md TEXT NOT NULL,
  generator_intimacy_md TEXT NOT NULL DEFAULT '',
  emotion_appraiser_md TEXT NOT NULL DEFAULT '',
  extractor_md TEXT NOT NULL,
  reflector_md TEXT NOT NULL,
  ranker_md TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, version_number)
);

CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  channel TEXT NOT NULL DEFAULT 'prod',
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rollback_of_release_id TEXT REFERENCES releases(id)
);

CREATE INDEX IF NOT EXISTS idx_releases_character_channel ON releases(character_id, channel);

CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  canonical_thread_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, character_id)
);

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
  last_emotion_updated_at TIMESTAMPTZ,
  appraisal_json TEXT NOT NULL,
  open_thread_count INTEGER NOT NULL DEFAULT 0,
  last_transition_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_turns (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  thread_id TEXT NOT NULL,
  user_message_text TEXT NOT NULL,
  assistant_message_text TEXT NOT NULL,
  planner_json TEXT,
  ranker_json TEXT,
  trace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_turns_pair ON chat_turns(pair_id, created_at DESC);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_events_pair ON memory_events(pair_id, created_at DESC);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_pair ON memory_facts(pair_id, status);
CREATE INDEX IF NOT EXISTS idx_memory_facts_subject ON memory_facts(subject, predicate);

CREATE TABLE IF NOT EXISTS memory_observations (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  summary TEXT NOT NULL,
  retrieval_keys_json TEXT NOT NULL,
  salience REAL NOT NULL,
  quality_score REAL,
  window_start_at TIMESTAMPTZ NOT NULL,
  window_end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_observations_pair ON memory_observations(pair_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_open_threads (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id),
  key TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  opened_by_event_id TEXT REFERENCES memory_events(id),
  resolved_by_event_id TEXT REFERENCES memory_events(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pair_id, key)
);

CREATE INDEX IF NOT EXISTS idx_memory_open_threads_pair ON memory_open_threads(pair_id, status);

CREATE TABLE IF NOT EXISTS memory_usage (
  id TEXT PRIMARY KEY,
  memory_item_type TEXT NOT NULL,
  memory_item_id TEXT NOT NULL,
  turn_id TEXT NOT NULL REFERENCES chat_turns(id),
  was_selected INTEGER NOT NULL,
  was_helpful INTEGER,
  score_delta REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenario_sets (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenario_cases (
  id TEXT PRIMARY KEY,
  scenario_set_id TEXT NOT NULL REFERENCES scenario_sets(id),
  title TEXT NOT NULL,
  input_json TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  scenario_set_id TEXT NOT NULL REFERENCES scenario_sets(id),
  character_version_id TEXT NOT NULL REFERENCES character_versions(id),
  model_registry_snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  summary_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_case_results (
  id TEXT PRIMARY KEY,
  eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
  scenario_case_id TEXT NOT NULL REFERENCES scenario_cases(id),
  scores_json TEXT NOT NULL,
  passed INTEGER NOT NULL,
  failure_reasons_json TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  coe_extraction_json TEXT,
  emotion_trace_json TEXT,
  legacy_comparison_json TEXT,
  memory_threshold_decisions_json TEXT,
  coe_contributions_json TEXT,
  plan_json TEXT NOT NULL,
  candidates_json TEXT NOT NULL,
  winner_index INTEGER NOT NULL,
  memory_writes_json TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turn_traces_pair ON turn_traces(pair_id, created_at DESC);

CREATE TABLE IF NOT EXISTS working_memory (
  pair_id TEXT PRIMARY KEY REFERENCES pairs(id),
  data_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/**
 * Migration 002: Workspace tables for draft authoring
 */
const MIGRATION_002_WORKSPACES = `
CREATE TABLE IF NOT EXISTS character_workspaces (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id),
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_character ON character_workspaces(character_id);

CREATE TABLE IF NOT EXISTS workspace_draft_state (
  workspace_id TEXT PRIMARY KEY REFERENCES character_workspaces(id),
  identity_json TEXT NOT NULL,
  persona_json TEXT NOT NULL,
  style_json TEXT NOT NULL,
  autonomy_json TEXT NOT NULL,
  emotion_json TEXT NOT NULL,
  memory_policy_json TEXT NOT NULL,
  phase_graph_json TEXT NOT NULL,
  planner_md TEXT NOT NULL,
  generator_md TEXT NOT NULL,
  generator_intimacy_md TEXT NOT NULL DEFAULT '',
  emotion_appraiser_md TEXT NOT NULL DEFAULT '',
  extractor_md TEXT NOT NULL,
  reflector_md TEXT NOT NULL,
  ranker_md TEXT NOT NULL,
  base_version_id TEXT REFERENCES character_versions(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_autosaves (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES character_workspaces(id),
  section TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autosaves_workspace ON workspace_autosaves(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_editor_context (
  workspace_id TEXT PRIMARY KEY REFERENCES character_workspaces(id),
  context_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playground_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES character_workspaces(id),
  user_id TEXT NOT NULL,
  is_sandbox INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playground_sessions_workspace ON playground_sessions(workspace_id);

CREATE TABLE IF NOT EXISTS playground_turns (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES playground_sessions(id),
  user_message_text TEXT NOT NULL,
  assistant_message_text TEXT NOT NULL,
  trace_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playground_turns_session ON playground_turns(session_id, created_at);

CREATE TABLE IF NOT EXISTS sandbox_pair_state (
  session_id TEXT PRIMARY KEY REFERENCES playground_sessions(id),
  active_phase_id TEXT NOT NULL,
  affinity REAL NOT NULL DEFAULT 50,
  trust REAL NOT NULL DEFAULT 50,
  intimacy_readiness REAL NOT NULL DEFAULT 0,
  conflict REAL NOT NULL DEFAULT 0,
  pad_json TEXT NOT NULL,
  pad_fast_json TEXT,
  pad_slow_json TEXT,
  pad_combined_json TEXT,
  last_emotion_updated_at TIMESTAMPTZ,
  appraisal_json TEXT NOT NULL,
  open_thread_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sandbox_working_memory (
  session_id TEXT PRIMARY KEY REFERENCES playground_sessions(id),
  data_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
`;

/**
 * Migration 003: Version labels and parent tracking for git-like versioning
 */
const MIGRATION_003_VERSION_LABELS = `
ALTER TABLE character_versions ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE character_versions ADD COLUMN IF NOT EXISTS parent_version_id TEXT REFERENCES character_versions(id);
CREATE INDEX IF NOT EXISTS idx_character_versions_parent ON character_versions(parent_version_id);
`;

/**
 * Migration 004: Intimacy-specific generator prompt variant
 * SUPERSEDED: generator_intimacy_md is now in MIGRATION_001 (prompt_bundle_versions)
 * and MIGRATION_002 (workspace_draft_state) as part of the canonical schema.
 * Kept as no-op to preserve _migrations tracking.
 */
const MIGRATION_004_GENERATOR_INTIMACY_PROMPT = `
SELECT 1
`;

/**
 * Migration 005: Runtime emotion layers and richer trace payloads
 */
const MIGRATION_005_RUNTIME_EMOTION_AND_TRACE = `
ALTER TABLE pair_state ADD COLUMN IF NOT EXISTS pad_fast_json TEXT;
ALTER TABLE pair_state ADD COLUMN IF NOT EXISTS pad_slow_json TEXT;
ALTER TABLE pair_state ADD COLUMN IF NOT EXISTS pad_combined_json TEXT;
ALTER TABLE pair_state ADD COLUMN IF NOT EXISTS last_emotion_updated_at TEXT;
UPDATE pair_state
SET
  pad_fast_json = COALESCE(pad_fast_json, pad_json),
  pad_slow_json = COALESCE(pad_slow_json, pad_json),
  pad_combined_json = COALESCE(pad_combined_json, pad_json),
  last_emotion_updated_at = COALESCE(last_emotion_updated_at, CAST(updated_at AS TEXT));

ALTER TABLE sandbox_pair_state ADD COLUMN IF NOT EXISTS pad_fast_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN IF NOT EXISTS pad_slow_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN IF NOT EXISTS pad_combined_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN IF NOT EXISTS last_emotion_updated_at TEXT;
UPDATE sandbox_pair_state
SET
  pad_fast_json = COALESCE(pad_fast_json, pad_json),
  pad_slow_json = COALESCE(pad_slow_json, pad_json),
  pad_combined_json = COALESCE(pad_combined_json, pad_json),
  last_emotion_updated_at = COALESCE(last_emotion_updated_at, CAST(updated_at AS TEXT));

ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS emotion_state_before_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS emotion_state_after_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS relationship_before_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS relationship_after_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS relationship_deltas_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS phase_transition_evaluation_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS prompt_assembly_hashes_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS coe_extraction_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS emotion_trace_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS legacy_comparison_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS memory_threshold_decisions_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS coe_contributions_json TEXT;
`;

/**
 * Migration 006: Sandbox durable memory parity
 * SUPERSEDED: All sandbox_memory_* tables are now created in MIGRATION_002_WORKSPACES
 * as part of the canonical schema. Kept as no-op to preserve _migrations tracking.
 */
const MIGRATION_006_SANDBOX_MEMORY_PARITY = `
SELECT 1
`;

const MIGRATION_007_EVAL_ACTIVE_LOCK = `
UPDATE eval_runs
SET status = 'failed'
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY character_version_id
        ORDER BY created_at DESC, id DESC
      ) AS row_num
    FROM eval_runs
    WHERE status IN ('pending', 'running')
  ) ranked_active_runs
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_runs_one_active_per_version
ON eval_runs(character_version_id)
WHERE status IN ('pending', 'running');
`;

/**
 * Migration 008: Canonical prompt bundle parity for emotion appraiser prompt
 * SUPERSEDED: emotion_appraiser_md is now in MIGRATION_001 (prompt_bundle_versions)
 * and MIGRATION_002 (workspace_draft_state) as part of the canonical schema.
 * Kept as no-op to preserve _migrations tracking.
 */
const MIGRATION_008_PROMPT_BUNDLE_PARITY = `
SELECT 1
`;

/**
 * Run all migrations.
 */
export async function runMigrations() {
  const db = getDb();

  // Create migrations tracking table with portable SQL
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get applied migrations
  const applied = await db.execute('SELECT name FROM _migrations');
  const appliedNames = new Set(applied.rows.map((r) => r.name as string));

  // Helper to run a migration
  const runMigration = async (name: string, sql: string) => {
    if (!appliedNames.has(name)) {
      console.log(`Running migration: ${name}`);

      // Remove comments and split by semicolon
      const cleanedSql = sql
        .split('\n')
        .map((line) => {
          const commentIndex = line.indexOf('--');
          return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
        })
        .join('\n')
        .replaceAll('DEFAULT now()', 'DEFAULT CURRENT_TIMESTAMP');

      const statements = cleanedSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        console.log(`Executing: ${statement.slice(0, 50)}...`);

        const addColumnIfMissingMatch = statement.match(
          /^ALTER TABLE\s+(\S+)\s+ADD COLUMN IF NOT EXISTS\s+(\S+)\s+(.+)$/i
        );
        const addColumnMatch =
          addColumnIfMissingMatch ??
          statement.match(/^ALTER TABLE\s+(\S+)\s+ADD COLUMN\s+(\S+)\s+(.+)$/i);

        if (addColumnMatch) {
          const [, tableName, columnName, columnDefinition] = addColumnMatch;
          const tableInfo = await db.execute(`PRAGMA table_info(${tableName})`);
          const hasColumn = tableInfo.rows.some(
            (row) => String(row.name) === columnName
          );

          if (!hasColumn) {
            await db.execute(
              `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
            );
          }

          continue;
        }

        await db.execute(statement);
      }

      await db.execute({
        sql: 'INSERT INTO _migrations (name) VALUES (?)',
        args: [name],
      });

      console.log(`Migration ${name} completed`);
    } else {
      console.log(`Migration ${name} already applied`);
    }
  };

  // Run migrations in order
  await runMigration('001_initial.sql', MIGRATION_001_INITIAL);
  await runMigration('002_workspaces.sql', MIGRATION_002_WORKSPACES);
  await runMigration('003_version_labels.sql', MIGRATION_003_VERSION_LABELS);
  await runMigration(
    '004_generator_intimacy_prompt.sql',
    MIGRATION_004_GENERATOR_INTIMACY_PROMPT
  );
  await runMigration(
    '005_runtime_emotion_and_trace.sql',
    MIGRATION_005_RUNTIME_EMOTION_AND_TRACE
  );
  await runMigration(
    '006_sandbox_memory_parity.sql',
    MIGRATION_006_SANDBOX_MEMORY_PARITY
  );
  await runMigration(
    '007_eval_active_lock.sql',
    MIGRATION_007_EVAL_ACTIVE_LOCK
  );
  await runMigration(
    '008_prompt_bundle_parity.sql',
    MIGRATION_008_PROMPT_BUNDLE_PARITY
  );

  console.log('All migrations completed');
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
