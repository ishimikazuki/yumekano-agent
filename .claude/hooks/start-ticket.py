#!/usr/bin/env python3
"""Initialize current-ticket.json for a new ticket.

Usage:
  python3 .claude/hooks/start-ticket.py <ticket_id>

Example:
  python3 .claude/hooks/start-ticket.py T1
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = ROOT / ".claude" / "state"
STATE_PATH = STATE_DIR / "current-ticket.json"
PLANS_PATH = ROOT / "PLANS.md"


def parse_ticket_from_plans(ticket_id: str) -> dict:
    """Parse acceptance criteria and required tests from PLANS.md.

    Supports two formats:
      - Old: ## T1: Title / ### 受入基準 / ### 必要テスト
      - New: # T1. Title / ## Acceptance criteria / ## Required tests
    """
    if not PLANS_PATH.exists():
        return {"acceptance_criteria": [], "required_tests": []}

    content = PLANS_PATH.read_text(encoding="utf-8")
    lines = content.split("\n")

    acceptance_criteria = []
    required_tests = []
    in_ticket = False
    in_acceptance = False
    in_tests = False

    # Build patterns for ticket header detection
    # Matches: "# T1." or "## T1:" or "## T1 "
    ticket_header_re = re.compile(
        rf"^#+\s+{re.escape(ticket_id)}[\.\:\s]"
    )
    # Next ticket header (any heading that starts a new ticket section).
    # Matches both numeric tickets (T0, T10, ...) and letter tickets (T-A, T-B, ...)
    # so parsing stops at the next ticket boundary regardless of stream.
    next_section_re = re.compile(r"^#\s+T(\d+|-[A-Z])[\.\:\s]")

    for line in lines:
        # Find ticket section header
        if not in_ticket and ticket_header_re.match(line):
            in_ticket = True
            continue

        # Exit ticket section at next ticket header
        if in_ticket and next_section_re.match(line) and not ticket_header_re.match(line):
            break

        if not in_ticket:
            continue

        stripped = line.strip()

        # Detect sub-sections (both old and new format)
        if stripped in ("### 受入基準", "## Acceptance criteria"):
            in_acceptance = True
            in_tests = False
            continue
        elif stripped in ("### 必要テスト", "## Required tests"):
            in_tests = True
            in_acceptance = False
            continue
        elif stripped.startswith("## "):
            # A new ## section ends the current section
            in_acceptance = False
            in_tests = False
            continue
        elif stripped.startswith("### "):
            # ### subheaders within Required tests / Acceptance criteria
            # don't break out — just continue collecting items
            continue

        # Collect items
        if in_acceptance and stripped.startswith("- "):
            # Strip checkbox prefix if present
            text = stripped[2:]
            if text.startswith("[ ] "):
                text = text[4:]
            elif text.startswith("[x] "):
                text = text[4:]
            acceptance_criteria.append(text)
        elif in_tests and stripped.startswith("- "):
            required_tests.append(stripped[2:])

    return {
        "acceptance_criteria": acceptance_criteria,
        "required_tests": required_tests,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python3 .claude/hooks/start-ticket.py <ticket_id>")
        sys.exit(1)

    ticket_id = sys.argv[1]
    parsed = parse_ticket_from_plans(ticket_id)

    state = {
        "ticket_id": ticket_id,
        "status": "in_progress",
        "ready_to_stop": False,
        "tests": {
            "required": parsed["required_tests"],
            "passed": [],
            "failed": [],
            "all_passed": False,
        },
        "acceptance": {
            "required": parsed["acceptance_criteria"],
            "passed": [],
            "failed": [],
            "all_passed": False,
        },
        "review": {
            "pass": False,
            "blocking_issues": [],
        },
        "notes": "",
    }

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Initialized ticket {ticket_id}")
    print(f"  Acceptance criteria: {len(parsed['acceptance_criteria'])}")
    print(f"  Required tests: {len(parsed['required_tests'])}")
    print(f"  State file: {STATE_PATH}")


if __name__ == "__main__":
    main()
