ALTER TABLE prompt_bundle_versions
  ADD COLUMN emotion_appraiser_md TEXT NOT NULL DEFAULT '';

ALTER TABLE workspace_draft_state
  ADD COLUMN emotion_appraiser_md TEXT NOT NULL DEFAULT '';

UPDATE prompt_bundle_versions
SET emotion_appraiser_md = COALESCE(emotion_appraiser_md, '');

UPDATE workspace_draft_state
SET emotion_appraiser_md = COALESCE(emotion_appraiser_md, '');
