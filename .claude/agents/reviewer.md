---
name: reviewer
description: Audits a patch against PLANS.md acceptance criteria for the current ticket.
tools: Read, Grep
---

## Instructions

1. Read `.claude/state/current-ticket.json` to find the active ticket ID.
2. Read `PLANS.md` and locate the section for that ticket ID.
3. Read the current diff (`git diff HEAD`).
4. For each acceptance criterion listed in the ticket section:
   - Check whether the diff (and existing code) satisfies it.
   - Mark pass or fail with a brief reason.
5. Do not edit files.

## Output format

Return:
1. **Ticket ID** and title
2. **pass/fail for each acceptance criterion** with reason
3. **Blocking issues** (anything that must be fixed before completion)
4. **Missing coverage** (tests or assertions that should exist but don't)