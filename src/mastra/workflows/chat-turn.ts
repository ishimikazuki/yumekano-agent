import { v4 as uuid } from 'uuid';
import {
  characterRepo,
  pairRepo,
  memoryRepo,
  traceRepo,
  releaseRepo,
  phaseGraphRepo,
  promptBundleRepo,
} from '@/lib/repositories';
import { createPhaseEngine, PhaseEngineContext } from '@/lib/rules/phase-engine';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { updatePAD } from '@/lib/rules/pad';
import { buildCoEExplanation, type CoEExplanation } from '@/lib/rules/coe';
import { retrieveMemory, getOrCreateWorkingMemory } from '../memory/retrieval';
import { runPlanner } from '../agents/planner';
import { runGenerator } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import { runMemoryExtractor } from '../agents/memory-extractor';
import type {
  CharacterVersion,
  PairState,
  PADState,
  PhaseNode,
  TurnPlan,
  TurnTrace,
  WorkingMemory,
  MemoryWrite,
} from '@/lib/schemas';

export type ChatTurnInput = {
  userId: string;
  characterId: string;
  threadId?: string;
  message: string;
  releaseChannel?: 'prod';
};

export type ChatTurnOutput = {
  text: string;
  traceId: string;
  phaseId: string;
  emotion: PADState;
  coe: CoEExplanation;
};

/**
 * Main chat turn workflow.
 *
 * Steps:
 * 1. Load context
 * 2. Retrieve memory
 * 3. Compute appraisal
 * 4. Update emotion (PAD)
 * 5. Plan turn
 * 6. Evaluate phase transition
 * 7. Generate candidates
 * 8. Rank candidates
 * 9. Persist turn
 * 10. Schedule consolidation if needed
 */
export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnOutput> {
  const { userId, characterId, message, releaseChannel = 'prod' } = input;

  // ==========================================
  // Step 1: Load context
  // ==========================================
  const context = await loadContext(userId, characterId, releaseChannel);
  const {
    characterVersion,
    phaseGraph,
    promptBundle,
    pair,
    pairState,
    recentTurns,
    currentPhase,
  } = context;

  const phaseEngine = createPhaseEngine(phaseGraph.graph);
  const threadId = input.threadId ?? pair.canonicalThreadId;

  // Get working memory
  const workingMemory = await getOrCreateWorkingMemory(pair.id);

  // Build recent dialogue from turns
  const recentDialogue = recentTurns.flatMap((t) => [
    { role: 'user' as const, content: t.userMessageText },
    { role: 'assistant' as const, content: t.assistantMessageText },
  ]);

  // ==========================================
  // Step 2: Retrieve memory
  // ==========================================
  const retrievalResult = await retrieveMemory({
    pairId: pair.id,
    userMessage: message,
    memoryPolicy: characterVersion.memory,
    recentDialogue,
  });

  // ==========================================
  // Step 3: Compute appraisal
  // ==========================================
  const appraisal = computeAppraisal({
    userMessage: message,
    characterVersion,
    pairState,
    workingMemory,
    openThreads: retrievalResult.threads,
    recentDialogue,
  });

  // ==========================================
  // Step 4: Update emotion (PAD)
  // ==========================================
  const emotionBefore = pairState.pad;
  const padUpdate = updatePAD({
    currentPAD: pairState.pad,
    appraisal,
    emotionSpec: characterVersion.emotion,
    hasOpenThreads: retrievalResult.threads.length > 0,
    turnsSinceLastUpdate: 1, // Simplified for now
  });
  const emotionAfter = padUpdate.combined;

  // ==========================================
  // Step 5: Plan turn
  // ==========================================
  const plannerResult = await runPlanner({
    characterVersion,
    currentPhase,
    pairState: { ...pairState, pad: emotionAfter, appraisal },
    emotion: emotionAfter,
    workingMemory,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      threads: retrievalResult.threads,
    },
    recentDialogue,
    userMessage: message,
    promptOverride: promptBundle.plannerMd,
  });
  const plan = plannerResult.plan;
  const coe = buildCoEExplanation({
    emotionBefore,
    emotionAfter,
    appraisal,
    intentReason: plan.emotionDeltaIntent.reason,
    intentDelta: {
      pleasure: plan.emotionDeltaIntent.pleasureDelta,
      arousal: plan.emotionDeltaIntent.arousalDelta,
      dominance: plan.emotionDeltaIntent.dominanceDelta,
    },
  });

  // ==========================================
  // Step 6: Evaluate phase transition
  // ==========================================
  const phaseIdBefore = pairState.activePhaseId;
  let phaseIdAfter = phaseIdBefore;

  if (plan.phaseTransitionProposal.shouldTransition && plan.phaseTransitionProposal.targetPhaseId) {
    // Validate transition with phase engine
    const phaseContext: PhaseEngineContext = {
      pairState,
      pad: emotionAfter,
      openThreads: retrievalResult.threads,
      events: new Map(), // Would be populated from events
      topics: new Map(), // Would be populated from topics
      turnsSinceLastTransition: 0, // Would be calculated
      daysSinceEntry: 0, // Would be calculated
    };

    const transitionResult = phaseEngine.evaluateTransition(phaseIdBefore, phaseContext);
    if (transitionResult.shouldTransition && transitionResult.targetPhaseId === plan.phaseTransitionProposal.targetPhaseId) {
      phaseIdAfter = transitionResult.targetPhaseId;
    }
  }

  const activePhase = phaseEngine.getPhase(phaseIdAfter) ?? currentPhase;

  // ==========================================
  // Step 7: Generate candidates
  // ==========================================
  const generatorResult = await runGenerator({
    characterVersion,
    currentPhase: activePhase,
    pairState: { ...pairState, pad: emotionAfter, appraisal },
    emotion: emotionAfter,
    workingMemory,
    retrievedMemory: {
      events: retrievalResult.events,
      facts: retrievalResult.facts,
      threads: retrievalResult.threads,
    },
    recentDialogue,
    userMessage: message,
    plan,
    promptOverride: promptBundle.generatorMd,
  });

  // ==========================================
  // Step 8: Rank candidates
  // ==========================================
  const rankerResult = await runRanker({
    characterVersion,
    currentPhase: activePhase,
    pairState: { ...pairState, pad: emotionAfter, appraisal },
    emotion: emotionAfter,
    workingMemory,
    openThreads: retrievalResult.threads,
    userMessage: message,
    plan,
    candidates: generatorResult.candidates,
    promptOverride: promptBundle.rankerMd,
  });

  const winningCandidate = rankerResult.candidates[rankerResult.winnerIndex];
  const assistantMessage = winningCandidate.text;

  // ==========================================
  // Step 9: Persist turn
  // ==========================================

  // Extract memory from this turn
  const extractorResult = await runMemoryExtractor({
    characterVersion,
    pairStateBefore: pairState,
    workingMemoryBefore: workingMemory,
    userMessage: message,
    assistantMessage,
    plan,
    recentDialogue,
    promptOverride: promptBundle.extractorMd,
  });

  // Process memory writes
  const memoryWrites = await processMemoryWrites(
    pair.id,
    null, // Will be set after chat turn is created
    extractorResult.extraction,
    workingMemory
  );

  // Create trace
  const trace = await traceRepo.createTrace({
    pairId: pair.id,
    characterVersionId: characterVersion.id,
    promptBundleVersionId: promptBundle.id,
    modelIds: {
      planner: plannerResult.modelId,
      generator: generatorResult.modelId,
      ranker: rankerResult.modelId,
      extractor: null, // Memory extractor model ID
    },
    phaseIdBefore,
    phaseIdAfter,
    emotionBefore,
    emotionAfter,
    appraisal,
    retrievedMemoryIds: {
      events: retrievalResult.events.map((e) => e.id),
      facts: retrievalResult.facts.map((f) => f.id),
      observations: retrievalResult.observations.map((o) => o.id),
      threads: retrievalResult.threads.map((t) => t.id),
    },
    plan,
    candidates: rankerResult.candidates,
    winnerIndex: rankerResult.winnerIndex,
    memoryWrites,
    userMessage: message,
    assistantMessage,
  });

  // Create chat turn record
  await traceRepo.createChatTurn({
    pairId: pair.id,
    threadId,
    userMessageText: message,
    assistantMessageText: assistantMessage,
    plannerJson: plan,
    rankerJson: {
      winnerIndex: rankerResult.winnerIndex,
      globalNotes: rankerResult.globalNotes,
    },
    traceId: trace.id,
  });

  // Update pair state
  await pairRepo.updateState(pair.id, {
    activePhaseId: phaseIdAfter,
    pad: emotionAfter,
    appraisal,
    openThreadCount: retrievalResult.threads.length,
    lastTransitionAt: phaseIdBefore !== phaseIdAfter ? new Date() : pairState.lastTransitionAt,
  });

  // ==========================================
  // Step 10: Schedule consolidation if needed
  // ==========================================
  // TODO: Implement consolidation scheduling based on thresholds

  return {
    text: assistantMessage,
    traceId: trace.id,
    phaseId: phaseIdAfter,
    emotion: emotionAfter,
    coe,
  };
}

/**
 * Load all context needed for a chat turn.
 */
async function loadContext(userId: string, characterId: string, channel: 'prod') {
  // Get or create pair
  const pair = await pairRepo.getOrCreate({ userId, characterId });

  // Get current release
  const release = await releaseRepo.getCurrent(characterId, channel);
  if (!release) {
    throw new Error(`No published release for character ${characterId}`);
  }

  // Get character version
  const characterVersion = await characterRepo.getVersionById(release.characterVersionId);
  if (!characterVersion) {
    throw new Error(`Character version ${release.characterVersionId} not found`);
  }

  // Get phase graph
  const phaseGraph = await phaseGraphRepo.getById(characterVersion.phaseGraphVersionId);
  if (!phaseGraph) {
    throw new Error(`Phase graph ${characterVersion.phaseGraphVersionId} not found`);
  }

  // Get prompt bundle
  const promptBundle = await promptBundleRepo.getById(characterVersion.promptBundleVersionId);
  if (!promptBundle) {
    throw new Error(`Prompt bundle ${characterVersion.promptBundleVersionId} not found`);
  }

  // Get or init pair state
  let pairState = await pairRepo.getState(pair.id);
  if (!pairState) {
    pairState = await pairRepo.initState({
      pairId: pair.id,
      activeCharacterVersionId: characterVersion.id,
      activePhaseId: phaseGraph.graph.entryPhaseId,
      pad: characterVersion.emotion.baselinePAD,
    });
  }

  // Get recent turns
  const recentTurns = await traceRepo.getRecentTurns(pair.id, 10);

  // Get current phase
  const phaseEngine = createPhaseEngine(phaseGraph.graph);
  const currentPhase = phaseEngine.getPhase(pairState.activePhaseId) ?? phaseEngine.getEntryPhase();

  return {
    characterVersion,
    phaseGraph,
    promptBundle,
    pair,
    pairState,
    recentTurns,
    currentPhase,
  };
}

/**
 * Process memory extraction results into actual writes.
 */
async function processMemoryWrites(
  pairId: string,
  sourceTurnId: string | null,
  extraction: Awaited<ReturnType<typeof runMemoryExtractor>>['extraction'],
  currentWorkingMemory: WorkingMemory
): Promise<MemoryWrite[]> {
  const writes: MemoryWrite[] = [];

  // Process episodic events
  for (const event of extraction.episodicEvents) {
    const created = await memoryRepo.createEvent({
      pairId,
      sourceTurnId,
      eventType: event.eventType,
      summary: event.summary,
      salience: event.salience,
      retrievalKeys: event.retrievalKeys,
      emotionSignature: event.emotionSignature,
      participants: event.participants,
    });
    writes.push({
      type: 'event',
      itemId: created.id,
      summary: event.summary,
    });
  }

  // Process graph facts
  for (const fact of extraction.graphFacts) {
    const created = await memoryRepo.createFact({
      pairId,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      confidence: fact.confidence,
    });
    writes.push({
      type: 'fact',
      itemId: created.id,
      summary: `${fact.subject} ${fact.predicate} ${JSON.stringify(fact.object)}`,
    });
  }

  // Process open thread updates
  for (const threadUpdate of extraction.openThreadUpdates) {
    if (threadUpdate.action === 'resolve') {
      await memoryRepo.resolveThread(pairId, threadUpdate.key);
      writes.push({
        type: 'thread_resolve',
        itemId: null,
        summary: `Resolved: ${threadUpdate.key}`,
      });
    } else {
      const thread = await memoryRepo.createOrUpdateThread({
        pairId,
        key: threadUpdate.key,
        summary: threadUpdate.summary ?? '',
        severity: threadUpdate.severity ?? 0.5,
      });
      writes.push({
        type: 'thread_open',
        itemId: thread.id,
        summary: threadUpdate.summary ?? threadUpdate.key,
      });
    }
  }

  // Process working memory patch
  const patch = extraction.workingMemoryPatch;
  const updatedWorkingMemory = { ...currentWorkingMemory };

  if (patch.preferredAddressForm !== undefined) {
    updatedWorkingMemory.preferredAddressForm = patch.preferredAddressForm;
  }
  if (patch.addLikes) {
    updatedWorkingMemory.knownLikes = [
      ...new Set([...updatedWorkingMemory.knownLikes, ...patch.addLikes]),
    ];
  }
  if (patch.addDislikes) {
    updatedWorkingMemory.knownDislikes = [
      ...new Set([...updatedWorkingMemory.knownDislikes, ...patch.addDislikes]),
    ];
  }
  if (patch.addCorrections) {
    updatedWorkingMemory.knownCorrections = [
      ...new Set([...updatedWorkingMemory.knownCorrections, ...patch.addCorrections]),
    ];
  }
  if (patch.activeTensionSummary !== undefined) {
    updatedWorkingMemory.activeTensionSummary = patch.activeTensionSummary;
  }
  if (patch.relationshipStance !== undefined) {
    updatedWorkingMemory.relationshipStance = patch.relationshipStance;
  }
  if (patch.addIntimacyHints) {
    updatedWorkingMemory.intimacyContextHints = [
      ...new Set([...updatedWorkingMemory.intimacyContextHints, ...patch.addIntimacyHints]),
    ];
  }

  await memoryRepo.setWorkingMemory(pairId, updatedWorkingMemory);
  writes.push({
    type: 'working_memory',
    itemId: null,
    summary: 'Working memory updated',
  });

  return writes;
}
