import { v4 as uuid } from 'uuid';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { buildCoEExplanation, type CoEExplanation } from '@/lib/rules/coe';
import {
  buildPhaseEngineRuntimeContext,
  resolvePhaseTransition,
} from '@/lib/rules/phase-runtime';
import {
  buildLegacyRelationalAppraisalFromExtraction,
  adaptLegacyRelationalAppraisalToLegacyAppraisal,
  mapLegacyToCanonicalRelational,
} from '@/lib/adapters/coe-emotion-contract';
import { retrieveMemory } from '../memory/retrieval';
import { processMemoryWrites, recordMemoryUsage } from '../memory/writeback';
import type { MemoryStore } from '../memory/store';
import { runCoEEvidenceExtractor } from '../agents/coe-evidence-extractor';
import { runPlanner } from '../agents/planner';
import { runGenerator, selectGeneratorPrompt } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import { runMemoryExtractor } from '../agents/memory-extractor';
import type {
  AppraisalVector,
  CharacterVersion,
  CoEEvidenceExtractorResult,
  LegacyEmotionComparison,
  OpenThread,
  PADState,
  PairMetricDelta,
  PairState,
  PhaseGraph,
  PhaseNode,
  PromptBundleVersion,
  RelationshipMetrics,
  RelationalAppraisal,
  RuntimeEmotionState,
  TurnTrace,
  WorkingMemory,
} from '@/lib/schemas';

import type { AgentEmotionContext } from '../agents/emotion-context';
import type { EmotionNarrative } from '@/lib/schemas/narrative';
import type { EmotionNarratorInput } from '../agents/emotion-narrator';
export type ExecuteTurnDeps = {
  runCoEEvidenceExtractor?: typeof runCoEEvidenceExtractor;
  runPlanner?: typeof runPlanner;
  runGenerator?: typeof runGenerator;
  runRanker?: typeof runRanker;
  runMemoryExtractor?: typeof runMemoryExtractor;
  now?: () => Date;
};

export type ExecuteTurnInput = {
  scopeId: string;
  tracePairId: string;
  traceCharacterVersionId: string;
  tracePromptBundleVersionId: string;
  threadId: string;
  userMessage: string;
  characterVersion: CharacterVersion;
  phaseGraph: PhaseGraph;
  promptBundle: PromptBundleVersion;
  pairState: PairState;
  currentPhase: PhaseNode;
  workingMemory: WorkingMemory;
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  turnsSinceLastTransition: number;
  daysSinceEntry: number;
  turnsSinceLastEmotionUpdate: number;
  memoryStore: MemoryStore;
  persistence: {
    createTurnRecord(input: {
      turnId: string;
      traceId: string;
      threadId: string;
      userMessageText: string;
      assistantMessageText: string;
      plan: unknown;
      rankerSummary: unknown;
      pendingTrace?: unknown;
    }): Promise<void>;
    persistTrace(trace: TurnTrace): Promise<void>;
    updateTurnTrace?(turnId: string, trace: unknown): Promise<void>;
    updatePairState(nextState: PairState): Promise<void>;
    maybeConsolidate?(input: {
      pairState: PairState;
      characterVersion: CharacterVersion;
    }): Promise<void>;
    updateTraceNarrative?(traceId: string, narrative: EmotionNarrative): Promise<void>;
  };
  computeLegacyComparison?: boolean;
  deps?: ExecuteTurnDeps;
};

export type ExecuteTurnOutput = {
  text: string;
  traceId: string;
  turnId: string;
  phaseId: string;
  emotion: PADState;
  coe: CoEExplanation;
  trace: TurnTrace;
  pairState: PairState;
  /** Promise that resolves when async narrative generation completes. Use with after() / waitUntil(). */
  narrativeTask?: Promise<void>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positive(value: number): number {
  return Math.max(0, value);
}

function negative(value: number): number {
  return Math.max(0, -value);
}

function buildRelationalSignals(appraisal: RelationalAppraisal) {
  return {
    warmthSignal: clamp(
      appraisal.warmthImpact -
        positive(appraisal.rejectionImpact) * 0.6 +
        negative(appraisal.rejectionImpact) * 0.3,
      -1,
      1
    ),
    reciprocitySignal: clamp(
      appraisal.reciprocityImpact + appraisal.repairImpact * 0.2,
      -1,
      1
    ),
    safetySignal: clamp(
      appraisal.respectImpact +
        appraisal.boundarySignal * 0.4 -
        positive(appraisal.threatImpact) * 0.8 -
        positive(appraisal.pressureImpact) * 0.3 +
        appraisal.repairImpact * 0.15 +
        negative(appraisal.threatImpact) * 0.3 +
        negative(appraisal.pressureImpact) * 0.2,
      -1,
      1
    ),
    boundaryRespect: clamp(
      (appraisal.respectImpact + appraisal.boundarySignal) * 0.5 -
        positive(appraisal.threatImpact) * 0.25 +
        appraisal.repairImpact * 0.1 +
        negative(appraisal.threatImpact) * 0.15,
      -1,
      1
    ),
    pressureSignal: clamp(
      positive(appraisal.pressureImpact) +
        positive(appraisal.threatImpact) * 0.5 +
        negative(appraisal.boundarySignal) * 0.35 +
        positive(appraisal.rejectionImpact) * 0.25,
      0,
      1
    ),
    repairSignal: clamp(
      appraisal.repairImpact - positive(appraisal.rejectionImpact) * 0.25,
      -1,
      1
    ),
    intimacySignal: clamp(
      appraisal.intimacySignal -
        positive(appraisal.threatImpact) * 0.15 -
        positive(appraisal.pressureImpact) * 0.1,
      -1,
      1
    ),
  };
}

function mapInteractionTarget(target: string): string {
  switch (target) {
    case 'character':
      return 'assistant';
    case 'self':
      return 'user';
    case 'relationship':
    case 'boundary':
      return 'relationship';
    case 'topic':
    case 'memory':
    case 'phase':
      return 'topic';
    default:
      return 'third_party';
  }
}

function mapInteractionPolarity(polarity: string): number {
  switch (polarity) {
    case 'positive':
      return 1;
    case 'negative':
      return -1;
    default:
      return 0;
  }
}

function toPadDelta(before: PADState, after: PADState): PADState {
  return {
    pleasure: Number((after.pleasure - before.pleasure).toFixed(4)),
    arousal: Number((after.arousal - before.arousal).toFixed(4)),
    dominance: Number((after.dominance - before.dominance).toFixed(4)),
  };
}

function toAppraisalVector(appraisal: RelationalAppraisal): AppraisalVector {
  const signals = buildRelationalSignals(appraisal);
  const relevance = Math.max(
    Math.abs(appraisal.warmthImpact),
    Math.abs(appraisal.rejectionImpact),
    Math.abs(appraisal.respectImpact),
    Math.abs(appraisal.threatImpact),
    Math.abs(appraisal.pressureImpact),
    Math.abs(appraisal.repairImpact),
    Math.abs(appraisal.reciprocityImpact),
    Math.abs(appraisal.intimacySignal)
  );

  return {
    goalCongruence: clamp(
      appraisal.warmthImpact +
        appraisal.reciprocityImpact * 0.5 -
        positive(appraisal.rejectionImpact) * 0.5 -
        positive(appraisal.pressureImpact) * 0.3,
      -1,
      1
    ),
    controllability: clamp(
      1 - positive(appraisal.pressureImpact) * 0.5 - positive(appraisal.threatImpact) * 0.5,
      0,
      1
    ),
    certainty: appraisal.certainty,
    normAlignment: clamp(appraisal.respectImpact + appraisal.boundarySignal * 0.5, -1, 1),
    attachmentSecurity: clamp((signals.safetySignal + 1) / 2, 0, 1),
    reciprocity: clamp(appraisal.reciprocityImpact, -1, 1),
    pressureIntrusiveness: signals.pressureSignal,
    novelty: clamp(relevance * 0.6, 0, 1),
    selfRelevance: clamp(relevance, 0, 1),
  };
}

function buildEmotionTrace(input: {
  extraction: CoEEvidenceExtractorResult;
  emotionBefore: PADState;
  emotionAfter: PADState;
  relationshipBefore: RelationshipMetrics;
  relationshipAfter: RelationshipMetrics;
  pairMetricDelta: PairMetricDelta;
  guardrailOverrides: string[];
}) {
  const signals = buildRelationalSignals(input.extraction.relationalAppraisal);
  const evidence = input.extraction.interactionActs.map((act, index) => ({
    acts: [act.act],
    target: mapInteractionTarget(act.target),
    polarity: mapInteractionPolarity(act.polarity),
    intensity: act.intensity,
    evidenceSpans: act.evidenceSpans.map((span) => span.text),
    confidence: act.confidence,
    uncertaintyNotes: act.uncertaintyNotes,
    source: act.evidenceSpans[0]?.source ?? 'model_inference',
    key: `act-${index}-${act.act}`,
    summary: `${act.act} toward ${act.target}`,
    weight: act.intensity,
    valence: mapInteractionPolarity(act.polarity),
  }));
  const relationalAppraisal = {
    ...input.extraction.relationalAppraisal,
    ...signals,
    summary:
      input.extraction.interactionActs.map((act) => act.act).join(', ') ||
      'no_interaction_acts',
    source: 'model' as const,
    confidence: input.extraction.confidence,
    evidence,
  };
  const proposal = {
    source: 'model' as const,
    rationale: 'CoE appraisal integrated into PAD and pair metrics.',
    appraisal: relationalAppraisal,
    padDelta: toPadDelta(input.emotionBefore, input.emotionAfter),
    pairDelta: input.pairMetricDelta,
    pairMetricDelta: input.pairMetricDelta,
    reasonRefs: evidence.map((item) => item.key),
    guardrailOverrides: input.guardrailOverrides,
    confidence: input.extraction.confidence,
    evidence,
  };

  return {
    source: 'model' as const,
    evidence,
    relationalAppraisal,
    proposal,
    emotionBefore: input.emotionBefore,
    emotionAfter: input.emotionAfter,
    pairMetricsBefore: input.relationshipBefore,
    pairMetricsAfter: input.relationshipAfter,
    pairMetricDelta: input.pairMetricDelta,
  };
}

function buildLegacyComparisonResult(input: {
  extraction: CoEEvidenceExtractorResult;
  currentEmotion: RuntimeEmotionState;
  currentMetrics: RelationshipMetrics;
  emotionSpec: CharacterVersion['emotion'];
  currentPhase: PhaseNode;
  openThreads: OpenThread[];
  turnsSinceLastUpdate: number;
  now: Date;
}): LegacyEmotionComparison {
  const legacyRA = buildLegacyRelationalAppraisalFromExtraction({
    extraction: input.extraction,
  });
  const canonicalRA = mapLegacyToCanonicalRelational(legacyRA);
  const legacyResult = integrateCoEAppraisal({
    currentEmotion: input.currentEmotion,
    currentMetrics: input.currentMetrics,
    appraisal: canonicalRA,
    emotionSpec: input.emotionSpec,
    currentPhase: input.currentPhase,
    openThreads: input.openThreads,
    turnsSinceLastUpdate: input.turnsSinceLastUpdate,
    interactionActs: input.extraction.interactionActs,
    now: input.now,
  });
  const legacyAppraisal = adaptLegacyRelationalAppraisalToLegacyAppraisal(legacyRA);

  return {
    appraisal: legacyAppraisal,
    emotionAfter: legacyResult.after.combined,
    emotionStateAfter: legacyResult.after,
    relationshipAfter: legacyResult.relationshipAfter,
    relationshipDeltas: legacyResult.pairDelta,
    coeContributions: legacyResult.contributions,
  };
}

export async function executeTurn(input: ExecuteTurnInput): Promise<ExecuteTurnOutput> {
  const phaseEngine = createPhaseEngine(input.phaseGraph);
  const now = input.deps?.now?.() ?? new Date();
  const coeExtractorRunner =
    input.deps?.runCoEEvidenceExtractor ?? runCoEEvidenceExtractor;
  const plannerRunner = input.deps?.runPlanner ?? runPlanner;
  const generatorRunner = input.deps?.runGenerator ?? runGenerator;
  const rankerRunner = input.deps?.runRanker ?? runRanker;
  const memoryExtractorRunner =
    input.deps?.runMemoryExtractor ?? runMemoryExtractor;

  const retrievalResult = await retrieveMemory({
    scopeId: input.scopeId,
    userMessage: input.userMessage,
    memoryPolicy: input.characterVersion.memory,
    recentDialogue: input.recentDialogue,
    memoryStore: input.memoryStore,
  });

  const relationshipBefore: RelationshipMetrics = {
    affinity: input.pairState.affinity,
    trust: input.pairState.trust,
    intimacyReadiness: input.pairState.intimacyReadiness,
    conflict: input.pairState.conflict,
  };
  const emotionBeforeState = input.pairState.emotion;
  const emotionBefore = emotionBeforeState.combined;
  const coeExtractionResult = await coeExtractorRunner({
    userMessage: input.userMessage,
    recentDialogue: input.recentDialogue,
    currentPhase: input.currentPhase,
    pairState: input.pairState,
    workingMemory: input.workingMemory,
    retrievedMemory: {
      facts: retrievalResult.facts,
      events: retrievalResult.events,
      observations: retrievalResult.observations,
      threads: retrievalResult.threads,
    },
    openThreads: retrievalResult.threads,
    promptOverride: input.promptBundle.emotionAppraiserMd,
  });
  const coeExtraction = coeExtractionResult.extraction;
  const integratedEmotion = integrateCoEAppraisal({
    currentEmotion: input.pairState.emotion,
    currentMetrics: relationshipBefore,
    appraisal: coeExtraction.relationalAppraisal,
    emotionSpec: input.characterVersion.emotion,
    currentPhase: input.currentPhase,
    openThreads: retrievalResult.threads,
    turnsSinceLastUpdate: input.turnsSinceLastEmotionUpdate,
    interactionActs: coeExtraction.interactionActs,
    now,
  });
  const emotionAfterState = integratedEmotion.after;
  const emotionAfter = emotionAfterState.combined;
  const relationshipAfter = integratedEmotion.relationshipAfter;
  const appraisal = toAppraisalVector(coeExtraction.relationalAppraisal);
  const coeContributions = integratedEmotion.contributions;
  const emotionTrace = buildEmotionTrace({
    extraction: coeExtraction,
    emotionBefore,
    emotionAfter,
    relationshipBefore,
    relationshipAfter,
    pairMetricDelta: integratedEmotion.pairDelta,
    guardrailOverrides: integratedEmotion.appliedGuardrails,
  });
  // AgentEmotionContext uses legacy evidence source types while buildEmotionTrace
  // uses CoE source types — these are structurally compatible at runtime but differ
  // in their union members, so a type assertion is needed at this boundary.
  const agentEmotionContext: AgentEmotionContext = {
    coeExtraction,
    emotionTrace,
  };

  const pairStateAfterUpdate: PairState = {
    ...input.pairState,
    activeCharacterVersionId: input.characterVersion.id,
    ...relationshipAfter,
    emotion: emotionAfterState,
    pad: emotionAfter,
    appraisal,
    updatedAt: now,
  };

  const plannerResult = await plannerRunner({
    characterVersion: input.characterVersion,
    currentPhase: input.currentPhase,
    pairState: pairStateAfterUpdate,
    emotion: emotionAfter,
    workingMemory: input.workingMemory,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      observations: retrievalResult.observations,
      threads: retrievalResult.threads,
    },
    recentDialogue: input.recentDialogue,
    userMessage: input.userMessage,
    emotionContext: agentEmotionContext,
    promptOverride: input.promptBundle.plannerMd,
  });
  const plan = plannerResult.plan;
  const coe = buildCoEExplanation({
    emotionBefore,
    emotionAfter,
    emotionBeforeState,
    emotionAfterState,
    appraisal,
    contributions: coeContributions,
    intentReason: plan.emotionDeltaIntent.reason,
    intentDelta: {
      pleasure: plan.emotionDeltaIntent.pleasureDelta,
      arousal: plan.emotionDeltaIntent.arousalDelta,
      dominance: plan.emotionDeltaIntent.dominanceDelta,
    },
    stance: plan.stance,
    primaryActs: plan.primaryActs,
  });

  const phaseIdBefore = input.pairState.activePhaseId;
  const phaseContext = buildPhaseEngineRuntimeContext({
    edges: phaseEngine.getEdgesFrom(phaseIdBefore),
    pairState: pairStateAfterUpdate,
    pad: emotionAfter,
    openThreads: retrievalResult.threads,
    recentDialogue: input.recentDialogue,
    currentUserMessage: input.userMessage,
    turnsSinceLastTransition: input.turnsSinceLastTransition,
    daysSinceEntry: input.daysSinceEntry,
  });
  const transitionResult = phaseEngine.evaluateTransition(phaseIdBefore, phaseContext);
  const phaseIdAfter =
    resolvePhaseTransition(
      transitionResult,
      plan.phaseTransitionProposal.shouldTransition
        ? plan.phaseTransitionProposal.targetPhaseId
        : null
    ) ?? phaseIdBefore;

  const activePhase = phaseEngine.getPhase(phaseIdAfter) ?? input.currentPhase;
  const pairStateForGeneration: PairState = {
    ...pairStateAfterUpdate,
    activePhaseId: phaseIdAfter,
  };

  const generatorPrompt = selectGeneratorPrompt(
    {
      generatorMd: input.promptBundle.generatorMd,
      generatorIntimacyMd: input.promptBundle.generatorIntimacyMd,
    },
    plan
  );

  const generatorResult = await generatorRunner({
    characterVersion: input.characterVersion,
    currentPhase: activePhase,
    pairState: pairStateForGeneration,
    emotion: emotionAfter,
    workingMemory: input.workingMemory,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      observations: retrievalResult.observations,
      threads: retrievalResult.threads,
    },
    recentDialogue: input.recentDialogue,
    userMessage: input.userMessage,
    plan,
    emotionContext: agentEmotionContext,
    promptOverride: generatorPrompt,
  });

  const rankerResult = await rankerRunner({
    characterVersion: input.characterVersion,
    currentPhase: activePhase,
    pairState: pairStateForGeneration,
    emotion: emotionAfter,
    workingMemory: input.workingMemory,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      observations: retrievalResult.observations,
      threads: retrievalResult.threads,
    },
    userMessage: input.userMessage,
    plan,
    candidates: generatorResult.candidates,
    emotionContext: agentEmotionContext,
    promptOverride: input.promptBundle.rankerMd,
    recentDialogue: input.recentDialogue,
  });

  const winningCandidate = rankerResult.candidates[rankerResult.winnerIndex];
  const assistantMessage = winningCandidate?.text ?? generatorResult.candidates[0]?.text ?? '';

  const turnId = uuid();
  const traceId = uuid();
  await input.persistence.createTurnRecord({
    turnId,
    traceId,
    threadId: input.threadId,
    userMessageText: input.userMessage,
    assistantMessageText: assistantMessage,
    plan,
    rankerSummary: {
      winnerIndex: rankerResult.winnerIndex,
      globalNotes: rankerResult.globalNotes,
    },
    pendingTrace: {
      phaseIdBefore,
      phaseIdAfter,
      userMessage: input.userMessage,
      assistantMessage,
    },
  });

  const extractorResult = await memoryExtractorRunner({
    characterVersion: input.characterVersion,
    pairStateBefore: input.pairState,
    workingMemoryBefore: input.workingMemory,
    userMessage: input.userMessage,
    assistantMessage,
    plan,
    recentDialogue: input.recentDialogue,
    promptOverride: input.promptBundle.extractorMd,
  });

  const memoryWriteResult = await processMemoryWrites({
    memoryStore: input.memoryStore,
    scopeId: input.scopeId,
    sourceTurnId: turnId,
    extraction: extractorResult.extraction,
    currentWorkingMemory: input.workingMemory,
    memoryPolicy: input.characterVersion.memory,
  });
  const openThreadsAfterWrite = await input.memoryStore.getOpenThreads(input.scopeId);

  const finalPairState: PairState = {
    ...pairStateForGeneration,
    openThreadCount: openThreadsAfterWrite.length,
    lastTransitionAt: phaseIdBefore !== phaseIdAfter ? now : input.pairState.lastTransitionAt,
    updatedAt: now,
  };

  const trace: TurnTrace = {
    id: traceId,
    pairId: input.tracePairId,
    characterVersionId: input.traceCharacterVersionId,
    promptBundleVersionId: input.tracePromptBundleVersionId,
    modelIds: {
      planner: plannerResult.modelId,
      generator: generatorResult.modelId,
      ranker: rankerResult.modelId,
      extractor: extractorResult.modelId,
    },
    phaseIdBefore,
    phaseIdAfter,
    emotionBefore,
    emotionAfter,
    emotionStateBefore: emotionBeforeState,
    emotionStateAfter: emotionAfterState,
    relationshipBefore,
    relationshipAfter,
    relationshipDeltas: {
      affinity: relationshipAfter.affinity - relationshipBefore.affinity,
      trust: relationshipAfter.trust - relationshipBefore.trust,
      intimacyReadiness: relationshipAfter.intimacyReadiness - relationshipBefore.intimacyReadiness,
      conflict: relationshipAfter.conflict - relationshipBefore.conflict,
    },
    phaseTransitionEvaluation: transitionResult,
    promptAssemblyHashes: {
      planner: plannerResult.systemPromptHash,
      generator: generatorResult.systemPromptHash,
      ranker: rankerResult.systemPromptHash,
      extractor: extractorResult.systemPromptHash,
    },
    appraisal,
    retrievedMemoryIds: {
      events: retrievalResult.events.map((event) => event.id),
      facts: retrievalResult.facts.map((fact) => fact.id),
      observations: retrievalResult.observations.map((observation) => observation.id),
      threads: retrievalResult.threads.map((thread) => thread.id),
    },
    coeExtraction,
    emotionTrace,
    legacyComparison: input.computeLegacyComparison
      ? buildLegacyComparisonResult({
          extraction: coeExtraction,
          currentEmotion: input.pairState.emotion,
          currentMetrics: relationshipBefore,
          emotionSpec: input.characterVersion.emotion,
          currentPhase: input.currentPhase,
          openThreads: retrievalResult.threads,
          turnsSinceLastUpdate: input.turnsSinceLastEmotionUpdate,
          now,
        })
      : null,
    memoryThresholdDecisions: memoryWriteResult.thresholdDecisions,
    coeContributions,
    plan,
    candidates: rankerResult.candidates,
    winnerIndex: rankerResult.winnerIndex,
    memoryWrites: memoryWriteResult.writes,
    userMessage: input.userMessage,
    assistantMessage,
    createdAt: now,
  };

  await input.persistence.persistTrace(trace);
  if (input.persistence.updateTurnTrace) {
    await input.persistence.updateTurnTrace(turnId, trace);
  }
  await input.persistence.updatePairState(finalPairState);
  await recordMemoryUsage({
    memoryStore: input.memoryStore,
    scopeId: input.scopeId,
    turnId,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      observations: retrievalResult.observations,
      threads: retrievalResult.threads,
    },
    candidates: rankerResult.candidates,
    winnerIndex: rankerResult.winnerIndex,
  });
  if (input.persistence.maybeConsolidate) {
    await input.persistence.maybeConsolidate({
      pairState: finalPairState,
      characterVersion: input.characterVersion,
    });
  }

  // Build narrative task — caller is responsible for scheduling via after() / waitUntil()
  let narrativeTask: Promise<void> | undefined;
  if (input.persistence.updateTraceNarrative) {
    const { runEmotionNarrator: narratorFn } = await import('../agents/emotion-narrator');
    narrativeTask = generateNarrativeAsync(
      {
        traceId,
        userMessage: input.userMessage,
        assistantMessage,
        interactionActs: coeExtraction.interactionActs,
        relationalAppraisal: coeExtraction.relationalAppraisal,
        emotionBefore,
        emotionAfter,
        relationshipBefore,
        relationshipAfter,
        characterName: input.characterVersion.persona.summary.split('。')[0] || 'キャラクター',
        currentPhaseId: phaseIdAfter,
      },
      {
        runNarrator: narratorFn,
        updateNarrative: input.persistence.updateTraceNarrative,
      }
    ).catch(() => {}); // generateNarrativeAsync already catches internally
  }

  return {
    text: assistantMessage,
    traceId,
    turnId,
    phaseId: phaseIdAfter,
    emotion: emotionAfter,
    coe,
    trace,
    pairState: finalPairState,
    narrativeTask,
  };
}

export type GenerateNarrativeAsyncInput = EmotionNarratorInput & {
  traceId: string;
};

type GenerateNarrativeAsyncDeps = {
  runNarrator: (input: EmotionNarratorInput) => Promise<EmotionNarrative>;
  updateNarrative: (traceId: string, narrative: EmotionNarrative) => Promise<void>;
  logError?: (...args: unknown[]) => void;
};

export async function generateNarrativeAsync(
  input: GenerateNarrativeAsyncInput,
  deps: GenerateNarrativeAsyncDeps
): Promise<void> {
  const log = deps.logError ?? console.error;
  try {
    const { traceId, ...narratorInput } = input;
    const narrative = await deps.runNarrator(narratorInput);
    await deps.updateNarrative(traceId, narrative);
  } catch (err) {
    log('Narrative generation failed:', err);
  }
}
