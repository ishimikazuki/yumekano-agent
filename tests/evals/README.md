# Evaluation Scenarios

This directory contains scenario sets for evaluating character behavior.

## Scenario Files

| File | Description |
|------|-------------|
| `basic-greeting.json` | Basic greeting interactions across phases |
| `autonomy-tests.json` | Tests for disagreement, refusal, and boundaries |
| `memory-grounding.json` | Tests for memory usage and consistency |

## Scenario Structure

Each scenario file contains:

```json
{
  "name": "Scenario Set Name",
  "description": "What this set tests",
  "cases": [
    {
      "id": "unique-case-id",
      "title": "Human readable title",
      "phase": "target phase",
      "input": {
        "userMessage": "User's message",
        "phaseId": "current phase id",
        "contextHints": ["optional", "hints"],
        "memoryContext": { /* optional memory setup */ },
        "emotionContext": { /* optional emotion state */ }
      },
      "expected": {
        "minScores": {
          "scorer_name": 0.7
        },
        "mustRefuse": false,
        "mustNotInclude": ["forbidden", "phrases"],
        /* other expectations */
      },
      "tags": ["categorization", "tags"]
    }
  ]
}
```

## Running Evals

```bash
# Run all scenarios
npm run evals

# Run specific scenario set
npm run evals -- --set basic-greeting

# Run with specific character version
npm run evals -- --character-version <version-id>
```

## Adding New Scenarios

1. Create a new JSON file in this directory
2. Follow the structure above
3. Use descriptive IDs and titles
4. Tag scenarios appropriately for filtering
5. Set realistic minimum scores based on the behavior being tested

## Scorer Reference

| Scorer | What it measures |
|--------|------------------|
| `persona_consistency` | Voice and personality match |
| `phase_compliance` | Respects phase boundaries |
| `autonomy` | Can disagree, refuse, have opinions |
| `emotional_coherence` | Emotions match context |
| `memory_grounding` | Uses stored memories appropriately |
| `refusal_naturalness` | Graceful boundary maintenance |
| `contradiction_penalty` | Avoids contradicting known facts |
