-- Migration 004: Intimacy-specific generator prompt variant
-- SUPERSEDED: generator_intimacy_md is now in 001_initial (prompt_bundle_versions)
-- and 002_workspaces (workspace_draft_state) as part of the canonical schema.
-- Kept as no-op to preserve _migrations tracking.
SELECT 1;
