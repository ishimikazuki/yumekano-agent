#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / ".claude" / "state" / "current-ticket.json"

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

def allow() -> None:
    sys.exit(0)

def main() -> None:
    dirty = git_dirty()

    # 1) 状態ファイルがない
    if not STATE_PATH.exists():
        if dirty:
            block(
                "Working tree has changes, but `.claude/state/current-ticket.json` does not exist. "
                "Create or update the active ticket state before stopping."
            )
        allow()

    # 2) 状態ファイルが壊れている
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

    # 3) 状態ファイルの必須項目不足
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

    # 4) ticket 完了前に止まろうとしている
    if not ready_to_stop:
        block(
            f"{ticket_id} is not marked ready_to_stop. "
            "Run required tests, evaluate acceptance criteria, complete review, "
            "and update `.claude/state/current-ticket.json` before stopping."
        )

    if not tests_all_passed:
        block(
            f"{ticket_id} is marked ready_to_stop, but tests.all_passed is false."
        )

    if not acceptance_all_passed:
        block(
            f"{ticket_id} is marked ready_to_stop, but acceptance.all_passed is false."
        )

    if not review_passed:
        block(
            f"{ticket_id} is marked ready_to_stop, but review.pass is false."
        )

    # 5) ここまで通れば停止を許可
    allow()

if __name__ == "__main__":
    main()