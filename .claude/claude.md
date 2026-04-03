# Claude Code rules for this repository

## Ticket loop (must follow this order)

Every piece of work follows this loop. Do not skip steps.

### Step 1: Start ticket
```bash
python3 .claude/hooks/start-ticket.py <TICKET_ID>
```
This reads PLANS.md and initializes `.claude/state/current-ticket.json` with:
- ticket ID, status `in_progress`
- acceptance criteria parsed from PLANS.md
- required tests parsed from PLANS.md
- review and tests set to not-passed

### Step 2: Read context
- Read `PLANS.md` — find the ticket section, understand goal and acceptance criteria.
- Read relevant code and existing tests.

### Step 3: Write failing tests first
- Write test(s) that cover the acceptance criteria before writing implementation.
- If schema, repository mapping, migration, seed data, prompt bundle, or workflow can drift, add a contract test.

### Step 4: Implement
- Work on only one ticket at a time.
- Do not widen scope beyond the ticket's acceptance criteria.
- If fresh DB behavior matters, verify it explicitly.

### Step 5: Run tests (use test-runner agent)
- Run the required tests listed in the ticket.
- Update `.claude/state/current-ticket.json` — record passed/failed tests.

### Step 6: Review (use reviewer agent)
- The reviewer agent reads the ticket's acceptance criteria from PLANS.md.
- It checks each criterion against the diff and marks pass/fail.
- Update `.claude/state/current-ticket.json` — record review result.

### Step 7: Complete or fix
- If all tests pass AND all acceptance criteria pass AND review passes:
  - Set `ready_to_stop: true` and `status: "ready_to_stop"` in the state file.
  - Update PLANS.md: change the ticket's checkboxes to `[x]` and status to `done`.
- If anything fails:
  - Go back to Step 4, fix the issue, and re-run from Step 5.

### Step 8: Next ticket
- Only after `ready_to_stop` is true for the current ticket.
- Run `python3 .claude/hooks/start-ticket.py <NEXT_TICKET_ID>` to begin the next one.
- Go back to Step 2.

## Guard rails (enforced by hooks)

| Hook | Trigger | What it does |
|------|---------|-------------|
| `check-edit.py` | PreToolUse (Edit/Write) | Blocks code edits if no ticket is `in_progress` |
| `check-stop.sh` | Stop / SubagentStop | Blocks session stop unless ticket is fully complete |

## Core rules
- Work on only one ticket at a time.
- Do not widen scope.
- Do not advance to the next ticket unless all acceptance criteria for the current ticket pass.
- If uncertain whether the current ticket is complete, do not advance.

## Completion policy
- Never claim completion unless:
  - required tests passed
  - acceptance criteria passed
  - review passed
  - `ready_to_stop` is true in `.claude/state/current-ticket.json`

## Important repository-specific constraints
- Treat runtime schema as the canonical prompt contract.
- Do not assume checked-in prompt markdown is canonical unless tests prove it.
- Do not assume draft and production are behaviorally aligned unless parity tests prove it.
- If a change touches persistence, verify fresh DB behavior.