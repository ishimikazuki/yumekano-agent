import { v4 as uuid } from 'uuid';
import {
  adaptRelationalAppraisalToLegacyAppraisal,
  buildRelationalAppraisalFromExtraction,
} from '@/lib/adapters/coe-emotion-contract';
import { shouldCompareLegacyEmotionPath } from '@/lib/feature-flags';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { integrateCoEAppraisal } from '@/lib/rules/coe-integrator';
import { updatePAD } from '@/lib/rules/pad';
import { buildCoEExplanation, type CoEExplanation } from '@/lib/rules/coe';
import {
  buildPhaseEngineRuntimeContext,
  resolvePhaseTransition,
  updateRelationshipMetrics,
} from '@/lib/rules/phase-runtime';
import { retrieveMemory } from '../memory/retrieval';
import { processMemoryWrites, recordMemoryUsage } from '../memory/writeback';
import type { MemoryStore } from '../memory/store';
import { runCoEEvidenceExtractor } from '../agents/coe-evidence-extractor';
import { runPlanner } from '../agents/planner';
import { runGenerator, selectGeneratorPrompt } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import { runMemoryExtractor } from '../agents/memory-extractor';
import { EmotionTraceSchema } from '@/lib/schemas';
import type {
  CharacterVersion,
  EmotionTrace,
  LegacyEmotionComparison,
  PairState,
  PhaseGraph,
  PhaseNode,
  PromptBundleVersion,
  WorkingMemory,
  PADState,
  TurnTrace,
} from '@/lib/schemas';

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
  };
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
};

export async function executeTurn(input: ExecuteTurnInput): Promise<ExecuteTurnOutput> {
  const phaseEngine = createPhaseEngine(input.phaseGraph);
  const now = input.deps?.now?.() ?? new Date();
  const coeEvidenceExtractorRunner =
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

  const coeExtractionResult = await coeEvidenceExtractorRunner({
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
  });
  const relationalAppraisal = buildRelationalAppraisalFromExtraction({
    extraction: coeExtractionResult.extraction,
    openThreads: retrievalResult.threads,
    retrievedObservations: retrievalResult.observations,
    workingMemory: input.workingMemory,
    pairState: input.pairState,
    currentPhase: input.currentPhase,
  });
  const appraisal = adaptRelationalAppraisalToLegacyAppraisal(relationalAppraisal);

  const relationshipBefore = {
    affinity: input.pairState.affinity,
    trust: input.pairState.trust,
    intimacyReadiness: input.pairState.intimacyReadiness,
    conflict: input.pairState.conflict,
  };
  const emotionBeforeState = input.pairState.emotion;
  const emotionBefore = emotionBeforeState.combined;
  const coeIntegration = integrateCoEAppraisal({
    currentEmotion: input.pairState.emotion,
    currentMetrics: relationshipBefore,
    appraisal: relationalAppraisal,
    emotionSpec: input.characterVersion.emotion,
    currentPhase: input.currentPhase,
    openThreads: retrievalResult.threads,
    turnsSinceLastUpdate: input.turnsSinceLastEmotionUpdate,
    interactionActs: coeExtractionResult.extraction.interactionActs,
    now,
  });
  const emotionAfterState = coeIntegration.after;
  const emotionAfter = emotionAfterState.combined;
  const relationshipAfter = coeIntegration.relationshipAfter;
  const coeContributions = coeIntegration.contributions;
  const emotionTrace: EmotionTrace = EmotionTraceSchema.parse({
    source: 'model',
    evidence: relationalAppraisal.evidence,
    relationalAppraisal,
    proposal: {
      source: 'model',
      rationale: relationalAppraisal.summary,
      appraisal: relationalAppraisal,
      padDelta: {
        pleasure: Number((emotionAfter.pleasure - emotionBefore.pleasure).toFixed(4)),
        arousal: Number((emotionAfter.arousal - emotionBefore.arousal).toFixed(4)),
        dominance: Number((emotionAfter.dominance - emotionBefore.dominance).toFixed(4)),
      },
      pairDelta: coeIntegration.pairDelta,
      confidence: relationalAppraisal.confidence,
      evidence: relationalAppraisal.evidence,
    },
    emotionBefore,
    emotionAfter,
    pairMetricsBefore: relationshipBefore,
    pairMetricsAfter: relationshipAfter,
    pairMetricDelta: coeIntegration.pairDelta,
  });
  const legacyComparison: LegacyEmotionComparison | null = shouldCompareLegacyEmotionPath()
    ? (() => {
        const legacyAppraisal = computeAppraisal({
          userMessage: input.userMessage,
          characterVersion: input.characterVersion,
          pairState: input.pairState,
          workingMemory: input.workingMemory,
          openThreads: retrievalResult.threads,
          recentDialogue: input.recentDialogue,
          currentPhase: input.currentPhase,
          retrievedFacts: retrievalResult.facts,
          retrievedEvents: retrievalResult.events,
          retrievedObservations: retrievalResult.observations,
        });
        const legacyPadUpdate = updatePAD({
          currentEmotion: input.pairState.emotion,
          appraisal: legacyAppraisal,
          emotionSpec: input.characterVersion.emotion,
          hasOpenThreads: retrievalResult.threads.length > 0,
          turnsSinceLastUpdate: input.turnsSinceLastEmotionUpdate,
          now,
        });
        const legacyRelationshipAfter = updateRelationshipMetrics({
          current: input.pairState,
          appraisal: legacyAppraisal,
          emotionBefore,
          emotionAfter: legacyPadUpdate.after.combined,
        });

        return {
          appraisal: legacyAppraisal,
          emotionAfter: legacyPadUpdate.after.combined,
          emotionStateAfter: legacyPadUpdate.after,
          relationshipAfter: legacyRelationshipAfter,
          relationshipDeltas: {
            affinity: legacyRelationshipAfter.affinity - relationshipBefore.affinity,
            trust: legacyRelationshipAfter.trust - relationshipBefore.trust,
            intimacyReadiness:
              legacyRelationshipAfter.intimacyReadiness -
              relationshipBefore.intimacyReadiness,
            conflict: legacyRelationshipAfter.conflict - relationshipBefore.conflict,
          },
          coeContributions: legacyPadUpdate.contributions,
        };
      })()
    : null;
  const agentEmotionContext = {
    coeExtraction: coeExtractionResult.extraction,
    emotionTrace,
    legacyComparison,
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
    lastTransitionAt: phaseIdBefore !== phaseIdAfter ? new Date() : input.pairState.lastTransitionAt,
    updatedAt: new Date(),
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
    coeExtraction: coeExtractionResult.extraction,
    emotionTrace,
    legacyComparison,
    memoryThresholdDecisions: memoryWriteResult.thresholdDecisions,
    coeContributions,
    plan,
    candidates: rankerResult.candidates,
    winnerIndex: rankerResult.winnerIndex,
    memoryWrites: memoryWriteResult.writes,
    userMessage: input.userMessage,
    assistantMessage,
    createdAt: new Date(),
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

  return {
    text: assistantMessage,
    traceId,
    turnId,
    phaseId: phaseIdAfter,
    emotion: emotionAfter,
    coe,
    trace,
    pairState: finalPairState,
  };
}
