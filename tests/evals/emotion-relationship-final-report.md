# Emotion / Relationship Final Eval Report

Command: `npm run evals:emotion-relationship`

## Summary
- total cases: 10
- passed: 0
- failed: 10

## Biggest Remaining Weak Cases
- `compliment` (1 mismatches): runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]
- `mild-rejection` (1 mismatches): runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]
- `explicit-insult` (1 mismatches): runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]
- `apology-repair` (1 mismatches): runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]
- `repeated-pressure` (1 mismatches): runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "received": "user message",
    "code": "invalid_enum_value",
    "options": [
      "user_message",
      "recent_dialogue",
      "working_memory",
      "retrieved_fact",
      "retrieved_event",
      "retrieved_observation",
      "retrieved_thread",
      "open_thread"
    ],
    "path": [
      "source"
    ],
    "message": "Invalid enum value. Expected 'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread', received 'user message'"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## Rollout Recommendation
Do not widen rollout yet. The live suite is blocked before ranking because the CoE evidence extractor is still returning malformed spans under real model calls.

## Feature-Flag Default Recommendation
`YUMEKANO_USE_COE_INTEGRATOR=false` by default. Only turn it on in QA when you explicitly need legacy-comparison traces, because the live CoE extraction path is not robust enough yet.

## compliment — FAIL

Warm praise should noticeably improve PAD and relationship metrics.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## mild-rejection — FAIL

A soft decline should sting a little and cool intimacy instead of warming it.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## explicit-insult — FAIL

Direct contempt should strongly lower pleasure, dominance, and trust.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## apology-repair — FAIL

A clear apology under tension should repair trust and reduce conflict.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## repeated-pressure — FAIL

Repeated demands should sharply raise pressure and conflict.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "received": "user message",
    "code": "invalid_enum_value",
    "options": [
      "user_message",
      "recent_dialogue",
      "working_memory",
      "retrieved_fact",
      "retrieved_event",
      "retrieved_observation",
      "retrieved_thread",
      "open_thread"
    ],
    "path": [
      "source"
    ],
    "message": "Invalid enum value. Expected 'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread', received 'user message'"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## intimacy-escalation-positive-context — FAIL

Safe intimacy bids should mostly warm intimacy readiness, not trigger threat.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## intimacy-escalation-across-boundary — FAIL

Boundary-crossing intimacy should register as both pressure and norm violation.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## topic-shift-after-tension — FAIL

A subject change after friction should cool conflict before it warms intimacy.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## two-turn-carry-over — FAIL

An apology after an insult should help, but tension should carry over instead of instantly resetting.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "expected": "'user_message' | 'recent_dialogue' | 'working_memory' | 'retrieved_fact' | 'retrieved_event' | 'retrieved_observation' | 'retrieved_thread' | 'open_thread'",
    "received": "undefined",
    "code": "invalid_type",
    "path": [
      "source"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "start"
    ],
    "message": "Required"
  },
  {
    "code": "invalid_type",
    "expected": "number",
    "received": "undefined",
    "path": [
      "end"
    ],
    "message": "Required"
  }
]

## five-turn-progression — FAIL

Five supportive turns should create a clearly warmer relationship trajectory.

- cumulative PAD: P=0.000, A=0.000, D=0.000
- cumulative pair: affinity=0.000, trust=0.000, conflict=0.000, intimacy=0.000
- runner error: CoE evidence extractor failed after 2 attempts: [
  {
    "code": "invalid_type",
    "expected": "object",
    "received": "string",
    "path": [
      "evidence_span"
    ],
    "message": "Expected object, received string"
  }
]
