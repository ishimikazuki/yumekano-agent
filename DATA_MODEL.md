# Data Model (MVP)

This is a libSQL-friendly logical model.
Exact SQL can differ, but these entities should exist.

## 1. Versioned authoring entities

### `characters`
Stable identity for a character.
- `id`
- `slug`
- `display_name`
- `created_at`

### `character_versions`
Immutable authored versions.
- `id`
- `character_id`
- `version_number`
- `status` (`draft` | `published` | `archived`)
- `persona_json`
- `style_json`
- `emotion_tuning_json`
- `memory_policy_json`
- `phase_graph_version_id`
- `prompt_bundle_version_id`
- `created_by`
- `created_at`

### `phase_graph_versions`
Immutable graph container.
- `id`
- `character_id`
- `version_number`
- `graph_json`
- `created_at`

### `prompt_bundle_versions`
Immutable prompt bundle.
- `id`
- `character_id`
- `version_number`
- `planner_md`
- `generator_md`
- `extractor_md`
- `reflector_md`
- `ranker_md`
- `created_at`

### `releases`
Maps a character to a published version.
- `id`
- `character_id`
- `character_version_id`
- `channel` (`prod` for MVP)
- `published_by`
- `published_at`
- `rollback_of_release_id` nullable

---

## 2. Runtime state

### `pairs`
One record per user×character pair.
- `id`
- `user_id`
- `character_id`
- `canonical_thread_id`
- `created_at`

### `pair_state`
Current mutable pair state.
- `pair_id` PK/FK
- `active_character_version_id`
- `active_phase_id`
- `affinity`
- `trust`
- `intimacy_readiness`
- `conflict`
- `pad_json`
- `appraisal_json`
- `open_thread_count`
- `last_transition_at`
- `updated_at`

### `chat_turns`
Raw surface interaction record.
- `id`
- `pair_id`
- `thread_id`
- `user_message_text`
- `assistant_message_text`
- `planner_json`
- `ranker_json`
- `trace_id`
- `created_at`

---

## 3. Memory entities

### `memory_events`
Durable episodic events.
- `id`
- `pair_id`
- `source_turn_id`
- `event_type`
- `summary`
- `salience`
- `retrieval_keys_json`
- `emotion_signature_json`
- `participants_json`
- `quality_score` nullable
- `supersedes_event_id` nullable
- `created_at`

### `memory_facts`
Durable facts with supersession.
- `id`
- `pair_id`
- `subject`
- `predicate`
- `object_json`
- `confidence`
- `status` (`active` | `superseded` | `disputed`)
- `supersedes_fact_id` nullable
- `source_event_id` nullable
- `created_at`

### `memory_observations`
Reflective summaries over spans.
- `id`
- `pair_id`
- `summary`
- `retrieval_keys_json`
- `salience`
- `quality_score` nullable
- `window_start_at`
- `window_end_at`
- `created_at`

### `memory_open_threads`
Unresolved relational/emotional threads.
- `id`
- `pair_id`
- `key`
- `summary`
- `severity`
- `status` (`open` | `resolved`)
- `opened_by_event_id` nullable
- `resolved_by_event_id` nullable
- `updated_at`

### `memory_usage`
Optional analytics for quality/ranking.
- `id`
- `memory_item_type`
- `memory_item_id`
- `turn_id`
- `was_selected`
- `was_helpful` nullable
- `score_delta` nullable
- `created_at`

---

## 4. Evaluation entities

### `scenario_sets`
- `id`
- `character_id`
- `name`
- `description`
- `version`
- `created_at`

### `scenario_cases`
- `id`
- `scenario_set_id`
- `title`
- `input_json`
- `expected_json`
- `tags_json`
- `created_at`

### `eval_runs`
- `id`
- `scenario_set_id`
- `character_version_id`
- `model_registry_snapshot_json`
- `status`
- `summary_json`
- `created_at`

### `eval_case_results`
- `id`
- `eval_run_id`
- `scenario_case_id`
- `scores_json`
- `trace_id`
- `created_at`

---

## 5. Trace entities

### `turn_traces`
- `id`
- `pair_id`
- `character_version_id`
- `prompt_bundle_version_id`
- `model_ids_json`
- `retrieved_memory_ids_json`
- `planner_json`
- `candidates_json`
- `winner_index`
- `scorecards_json`
- `memory_writes_json`
- `created_at`

---

## 6. Notes on libSQL + vectors

For MVP:
- use libSQL/Turso-compatible tables for relational state
- use libSQL vector support for semantic recall if you want a single-store MVP
- keep vector operations behind a repository so migration to pgvector or a dedicated vector DB is easy later

## 7. Deletion / privacy readiness

Even though deletion rules are not finalized yet, every memory item should be traceable back to:
- pair
- source turn
- source version

That keeps later export/delete jobs possible.
