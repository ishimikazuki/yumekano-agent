# Codex Handoff

Give Codex these priorities in order:

1. Read `AGENTS.md`
2. Read `PRD.md`
3. Build the repo structure in `REPO_STRUCTURE.md`
4. Implement schemas from `CHARACTER_CONFIG_SPEC.md` and `DATA_MODEL.md`
5. Implement `chat_turn` from `WORKFLOWS.md`
6. Build a minimal read-only dashboard
7. Add editing, evals, and release actions

## First milestone
A designer can:
- open one character
- edit a draft
- run a sandbox chat
- inspect phase / memory / trace
- publish a version
- roll back

## Coding rules
- do not invent extra product requirements
- do not add approval workflow
- do not hardcode character personality in code branches
- keep prompts modular and short
- expose trace data in the UI
