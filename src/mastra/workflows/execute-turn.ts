import { v4 as uuid } from 'uuid';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { computeAppraisal } from '@/lib/rules/appraisal';
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
import { runPlanner } from '../agents/planner';
import { runGenerator, selectGeneratorPrompt } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import { runMemoryExtractor } from '../agents/memory-extractor';
import type {
  CharacterVersion,
  PairState,
  PhaseGraph,
  PhaseNode,
  PromptBundleVersion,
  WorkingMemory,
  PADState,
  TurnTrace,
} from '@/lib/schemas';

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

  const retrievalResult = await retrieveMemory({
    scopeId: input.scopeId,
    userMessage: input.userMessage,
    memoryPolicy: input.characterVersion.memory,
    recentDialogue: input.recentDialogue,
    memoryStore: input.memoryStore,
  });

  const appraisal = computeAppraisal({
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

  const relationshipBefore = {
    affinity: input.pairState.affinity,
    trust: input.pairState.trust,
    intimacyReadiness: input.pairState.intimacyReadiness,
    conflict: input.pairState.conflict,
  };
  const emotionBeforeState = input.pairState.emotion;
  const emotionBefore = emotionBeforeState.combined;
  const padUpdate = updatePAD({
    currentEmotion: input.pairState.emotion,
    appraisal,
    emotionSpec: input.characterVersion.emotion,
    hasOpenThreads: retrievalResult.threads.length > 0,
    turnsSinceLastUpdate: input.turnsSinceLastEmotionUpdate,
    now: new Date(),
  });
  const emotionAfterState = padUpdate.after;
  const emotionAfter = emotionAfterState.combined;
  const relationshipAfter = updateRelationshipMetrics({
    current: input.pairState,
    appraisal,
    emotionBefore,
    emotionAfter,
  });
  const pairStateAfterUpdate: PairState = {
    ...input.pairState,
    activeCharacterVersionId: input.characterVersion.id,
    ...relationshipAfter,
    emotion: emotionAfterState,
    pad: emotionAfter,
    appraisal,
    updatedAt: new Date(),
  };

  const plannerResult = await runPlanner({
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
    promptOverride: input.promptBundle.plannerMd,
  });
  const plan = plannerResult.plan;
  const coe = buildCoEExplanation({
    emotionBefore,
    emotionAfter,
    emotionBeforeState,
    emotionAfterState,
    appraisal,
    contributions: padUpdate.contributions,
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

  const generatorResult = await runGenerator({
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
    promptOverride: generatorPrompt,
  });

  const rankerResult = await runRanker({
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

  const extractorResult = await runMemoryExtractor({
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
    memoryThresholdDecisions: memoryWriteResult.thresholdDecisions,
    coeContributions: padUpdate.contributions,
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
