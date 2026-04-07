#!/usr/bin/env python3
"""Stop hook: blocks stop unless ticket is complete.

If the current ticket is complete and there's a next ticket in the sequence,
auto-advances to the next ticket and blocks stop so Claude continues working.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / ".claude" / "state" / "current-ticket.json"
START_TICKET = ROOT / ".claude" / "hooks" / "start-ticket.py"

# Fixed ticket order — matches plan_tdd.md
TICKET_ORDER = ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"]


def git_dirty() -> bool:
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


def block(reason: str) -> None:
    print(json.dumps({
        "decision": "block",
        "reason": reason
    }))
    sys.exit(0)


def auto_advance(current_id: str, next_id: str) -> None:
    """Start next ticket and block stop so Claude continues."""
    subprocess.run(
        [sys.executable, str(START_TICKET), next_id],
        cwd=ROOT,
        capture_output=True,
    )
    print(json.dumps({
        "decision": "block",
        "reason": (
            f"{current_id} complete. Auto-advancing to {next_id}. "
            f"Continue working on {next_id} following the ticket loop in PLANS.md."
        ),
    }))
    sys.exit(0)


def allow() -> None:
    sys.exit(0)


def get_next_ticket(current_id: str) -> str | None:
    """Return the next ticket ID, or None if current is the last."""
    try:
        idx = TICKET_ORDER.index(current_id)
        if idx + 1 < len(TICKET_ORDER):
            return TICKET_ORDER[idx + 1]
    except ValueError:
        pass
    return None


def main() -> None:
    dirty = git_dirty()

    # 1) No state file
    if not STATE_PATH.exists():
        if dirty:
            block(
                "Working tree has changes, but `.claude/state/current-ticket.json` does not exist. "
                "Create or update the active ticket state before stopping."
            )
        allow()

    # 2) Invalid state file
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        block(
            "`.claude/state/current-ticket.json` exists but is invalid JSON. "
            "Fix the file before stopping."
        )
        return

    ticket_id = state.get("ticket_id")
    status = state.get("status")
    ready_to_stop = state.get("ready_to_stop", False)

    tests = state.get("tests", {})
    tests_all_passed = tests.get("all_passed", False)

    acceptance = state.get("acceptance", {})
    acceptance_all_passed = acceptance.get("all_passed", False)

    review = state.get("review", {})
    review_passed = review.get("pass", False)

    # 3) Missing required fields
    if not ticket_id:
        block("Current ticket state is missing `ticket_id`.")
    if status not in {"planned", "in_progress", "ready_to_stop"}:
        block("Current ticket state has invalid `status`.")
    if "tests" not in state:
        block("Current ticket state is missing `tests`.")
    if "acceptance" not in state:
        block("Current ticket state is missing `acceptance`.")
    if "review" not in state:
        block("Current ticket state is missing `review`.")

    # 4) Ticket not complete
    if not ready_to_stop:
        block(
            f"{ticket_id} is not marked ready_to_stop. "
            "Run required tests, evaluate acceptance criteria, complete review, "
            "and update `.claude/state/current-ticket.json` before stopping."
        )

    if not tests_all_passed:
        block(f"{ticket_id} is marked ready_to_stop, but tests.all_passed is false.")

    if not acceptance_all_passed:
        block(f"{ticket_id} is marked ready_to_stop, but acceptance.all_passed is false.")

    if not review_passed:
        block(f"{ticket_id} is marked ready_to_stop, but review.pass is false.")

    # 5) Ticket is complete — check for auto-advance
    next_ticket = get_next_ticket(ticket_id)
    if next_ticket:
        auto_advance(ticket_id, next_ticket)

    # 6) Last ticket — allow stop
    allow()


if __name__ == "__main__":
    main()
