# Open Questions for Next Iteration

These are the most leverage-heavy unresolved inputs.

## 1. Game integration contract
Which fields should the runtime eventually read from the game?
Examples:
- user inventory
- paid entitlements
- item ownership
- event flags
- premium mode
- cooldowns shared with other systems

## 2. Pair threading model
Will a user×character pair have:
- one canonical chat thread only, or
- multiple simultaneous threads / chat rooms later?

This affects memory scope and UI hydration strategy.

## 3. Future policy pack
You intentionally deferred global prohibited-content rules.
When you are ready, define:
- hard-banned categories
- soft-block categories
- escalation / cooldown categories
- provider-specific exceptions

## 4. Release ergonomics
Direct publish is locked.
But do you want:
- optional “warn if no eval in last N hours”
- optional canary percentage later
- optional release notes field

## 5. Voice / image roadmap
If voice or image exchange is likely, the memory and emotion model should reserve hooks now.
