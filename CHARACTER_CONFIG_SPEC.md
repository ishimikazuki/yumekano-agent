# Character Config Spec

This is the authoring model the dashboard edits.
It is intentionally typed and modular.

## 1. Top-level shape

```ts
type CharacterVersion = {
  id: string
  persona: PersonaSpec
  style: StyleSpec
  autonomy: AutonomySpec
  emotion: EmotionSpec
  memory: MemoryPolicySpec
  phases: PhaseGraphSpec
  prompts: PromptBundleRef
}
```

## 2. Persona

```ts
type PersonaSpec = {
  summary: string
  values: string[]
  flaws: string[]
  insecurities: string[]
  likes: string[]
  dislikes: string[]
  signatureBehaviors: string[]
  authoredExamples: {
    warm?: string[]
    playful?: string[]
    guarded?: string[]
    conflict?: string[]
  }
}
```

## 3. Style

```ts
type StyleSpec = {
  language: "ja"
  politenessDefault: "casual" | "mixed" | "polite"
  terseness: number        // 0..1
  directness: number       // 0..1
  playfulness: number      // 0..1
  teasing: number          // 0..1
  initiative: number       // 0..1
  emojiRate: number        // 0..1
  sentenceLengthBias: "short" | "medium"
  tabooPhrases: string[]
  signaturePhrases: string[]
}
```

## 4. Autonomy

```ts
type AutonomySpec = {
  disagreeReadiness: number
  refusalReadiness: number
  delayReadiness: number
  repairReadiness: number
  conflictCarryover: number
  intimacyNeverOnDemand: boolean
}
```

## 5. Emotion

```ts
type EmotionSpec = {
  baselinePAD: {
    pleasure: number
    arousal: number
    dominance: number
  }
  recovery: {
    pleasureHalfLifeTurns: number
    arousalHalfLifeTurns: number
    dominanceHalfLifeTurns: number
  }
  appraisalSensitivity: {
    goalCongruence: number
    controllability: number
    certainty: number
    normAlignment: number
    attachmentSecurity: number
    reciprocity: number
    pressureIntrusiveness: number
    novelty: number
  }
  externalization: {
    warmthWeight: number
    tersenessWeight: number
    directnessWeight: number
    teasingWeight: number
  }
}
```

## 6. Memory policy

```ts
type MemoryPolicySpec = {
  eventSalienceThreshold: number
  factConfidenceThreshold: number
  observationCompressionTarget: number
  retrievalTopK: {
    episodes: number
    facts: number
    observations: number
  }
  recencyBias: number
  qualityBias: number
  contradictionBoost: number
}
```

## 7. Phase graph

Free-form graph per character.

```ts
type PhaseNode = {
  id: string
  label: string
  description: string
  mode: "entry" | "relationship" | "girlfriend"
  authoredNotes?: string
  acceptanceProfile: {
    warmthFloor?: number
    trustFloor?: number
    intimacyFloor?: number
    conflictCeiling?: number
  }
  allowedActs: string[]
  disallowedActs: string[]
  adultIntimacyEligibility?: "never" | "conditional" | "allowed"
}

type TransitionCondition =
  | { type: "metric"; field: "trust" | "affinity" | "intimacy_readiness" | "conflict"; op: ">=" | "<="; value: number }
  | { type: "topic"; topicKey: string; minCount?: number }
  | { type: "event"; eventKey: string; exists: boolean }
  | { type: "emotion"; field: "pleasure" | "arousal" | "dominance"; op: ">=" | "<="; value: number }
  | { type: "openThread"; threadKey: string; status: "open" | "resolved" }
  | { type: "time"; field: "turnsSinceLastTransition" | "daysSinceEntry"; op: ">="; value: number }

type PhaseEdge = {
  id: string
  from: string
  to: string
  conditions: TransitionCondition[]
  allMustPass: boolean
  authoredBeat?: string
}
```

### Important
No global fixed phase count exists.
A character can have 4, 6, or more authored phases.
The only system-level special mode is `girlfriend`, which means “main graph completed” — not “always compliant”.

## 8. Prompt bundle reference

```ts
type PromptBundleRef = {
  promptBundleVersionId: string
  plannerVariant?: string
  generatorVariant?: string
  extractorVariant?: string
  reflectorVariant?: string
  rankerVariant?: string
}
```

## 9. Designer guidance

Prefer tuning with:
- values
- flaws
- autonomy settings
- phase conditions
- emotion sensitivity
- example lines

Use raw prompt edits only when structure is insufficient.
