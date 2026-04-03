#!/usr/bin/env python3
"""PreToolUse hook: blocks Edit/Write if no ticket is in_progress.

Ensures that code edits only happen when a ticket is actively being worked on.
Allows editing .claude/ state files and PLANS.md without restriction.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / ".claude" / "state" / "current-ticket.json"

# Files that can always be edited (state management, plans)
ALWAYS_ALLOWED = [
    ".claude/state/",
    ".claude/hooks/",
    ".claude/agents/",
    ".claude/claude.md",
    ".claude/settings",
    "PLANS.md",
    "PROJECT_LOG/",
    "document.xml",
]


def main() -> None:
    # Read hook input from stdin
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        # If we can't parse input, allow (fail open)
        sys.exit(0)

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    # Only gate Edit and Write tools
    if tool_name not in ("Edit", "Write"):
        sys.exit(0)

    # Check if the file being edited is in the always-allowed list
    file_path = tool_input.get("file_path", "")
    for allowed in ALWAYS_ALLOWED:
        if allowed in file_path:
            sys.exit(0)

    # Check ticket state
    if not STATE_PATH.exists():
        print(json.dumps({
            "decision": "block",
            "reason": (
                "No active ticket. Run `python3 .claude/hooks/start-ticket.py <TICKET_ID>` "
                "to initialize a ticket before editing code."
            ),
        }))
        sys.exit(0)

    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        print(json.dumps({
            "decision": "block",
            "reason": "`.claude/state/current-ticket.json` is invalid JSON. Fix it before editing code.",
        }))
        sys.exit(0)

    status = state.get("status", "")
    if status not in ("in_progress", "planned"):
        ticket_id = state.get("ticket_id", "unknown")
        print(json.dumps({
            "decision": "block",
            "reason": (
                f"Ticket {ticket_id} has status '{status}'. "
                "Only tickets with status 'in_progress' or 'planned' allow code edits. "
                "Start a new ticket or update the status first."
            ),
        }))
        sys.exit(0)

    # All checks passed — allow
    sys.exit(0)


if __name__ == "__main__":
    main()
