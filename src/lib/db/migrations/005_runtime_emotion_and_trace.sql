ALTER TABLE pair_state ADD COLUMN pad_fast_json TEXT;
ALTER TABLE pair_state ADD COLUMN pad_slow_json TEXT;
ALTER TABLE pair_state ADD COLUMN pad_combined_json TEXT;
ALTER TABLE pair_state ADD COLUMN last_emotion_updated_at TEXT;
UPDATE pair_state
SET
  pad_fast_json = COALESCE(pad_fast_json, pad_json),
  pad_slow_json = COALESCE(pad_slow_json, pad_json),
  pad_combined_json = COALESCE(pad_combined_json, pad_json),
  last_emotion_updated_at = COALESCE(last_emotion_updated_at, updated_at);

ALTER TABLE sandbox_pair_state ADD COLUMN pad_fast_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN pad_slow_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN pad_combined_json TEXT;
ALTER TABLE sandbox_pair_state ADD COLUMN last_emotion_updated_at TEXT;
UPDATE sandbox_pair_state
SET
  pad_fast_json = COALESCE(pad_fast_json, pad_json),
  pad_slow_json = COALESCE(pad_slow_json, pad_json),
  pad_combined_json = COALESCE(pad_combined_json, pad_json),
  last_emotion_updated_at = COALESCE(last_emotion_updated_at, updated_at);

ALTER TABLE turn_traces ADD COLUMN emotion_state_before_json TEXT;
ALTER TABLE turn_traces ADD COLUMN emotion_state_after_json TEXT;
ALTER TABLE turn_traces ADD COLUMN relationship_before_json TEXT;
ALTER TABLE turn_traces ADD COLUMN relationship_after_json TEXT;
ALTER TABLE turn_traces ADD COLUMN relationship_deltas_json TEXT;
ALTER TABLE turn_traces ADD COLUMN phase_transition_evaluation_json TEXT;
ALTER TABLE turn_traces ADD COLUMN prompt_assembly_hashes_json TEXT;
ALTER TABLE turn_traces ADD COLUMN memory_threshold_decisions_json TEXT;
ALTER TABLE turn_traces ADD COLUMN coe_contributions_json TEXT;
