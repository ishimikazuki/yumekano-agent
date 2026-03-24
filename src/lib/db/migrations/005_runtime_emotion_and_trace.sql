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
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS memory_threshold_decisions_json TEXT;
ALTER TABLE turn_traces ADD COLUMN IF NOT EXISTS coe_contributions_json TEXT;
