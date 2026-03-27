# Ticket Specs

These files are extracted from `COE_PAD_REPAIR_PLAN.md`.
The master plan remains the strategic source of truth for intent, order, and overall migration policy.
The ticket files are the operational source of truth for executing one ticket safely.

## Rules

- Use only the current ticket file plus `COE_PAD_REPAIR_PLAN.md` when executing a ticket.
- Do not reinterpret the whole migration during ticket execution.
- The master plan is strategic; the ticket files are operational.
- Do not start a later ticket until the current ticket is green and reviewed.

## Recommended Workflow

1. Write or update failing tests first.
2. Implement only the current ticket scope.
3. Run the smallest relevant test set.
4. Review against the ticket acceptance criteria before stopping.

## Naming And Usage

- `T0.md` to `T9.md` map directly to the ticket order in `COE_PAD_REPAIR_PLAN.md`.
- One ticket file supports one execution ticket, one PR, and one bounded review.
- In prompts, name the ticket explicitly, for example: `Work only on T3 using plans/tickets/T3.md and COE_PAD_REPAIR_PLAN.md.`
