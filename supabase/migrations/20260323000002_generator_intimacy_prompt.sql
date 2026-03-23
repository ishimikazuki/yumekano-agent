ALTER TABLE prompt_bundle_versions
  ADD COLUMN generator_intimacy_md TEXT NOT NULL DEFAULT '';

ALTER TABLE workspace_draft_state
  ADD COLUMN generator_intimacy_md TEXT NOT NULL DEFAULT '';
