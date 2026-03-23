/**
 * Draft chat turn workflow.
 *
 * Similar to chat-turn but uses draft workspace state instead of published release.
 * Sandbox sessions are isolated from production pair state.
 */

import { workspaceRepo } from '@/lib/repositories';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { computeAppraisal } from '@/lib/rules/appraisal';
import { updatePAD } from '@/lib/rules/pad';
import { buildCoEExplanation, type CoEExplanation } from '@/lib/rules/coe';
import {
  buildPhaseEngineRuntimeContext,
  deriveSandboxPhaseTiming,
  resolvePhaseTransition,
  updateRelationshipMetrics,
} from '@/lib/rules/phase-runtime';
import { runPlanner } from '../agents/planner';
import { runGenerator, selectGeneratorPrompt } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import type {
  PADState,
  AppraisalVector,
  TurnPlan,
  WorkingMemory,
  PlaygroundSession,
  PairState,
} from '@/lib/schemas';

export type DraftChatTurnInput = {
  workspaceId: string;
  sessionId?: string; // If not provided, creates new session
  userId: string;
  message: string;
  // Optional overrides for testing
  forcePhaseId?: string;
  forcePAD?: PADState;
};

export type DraftChatTurnOutput = {
  text: string;
  sessionId: string;
  turnId: string;
  phaseId: string;
  emotion: PADState;
  coe: CoEExplanation;
  trace: DraftChatTrace;
};

export type DraftChatTrace = {
  workspaceId: string;
  phaseIdBefore: string;
  phaseIdAfter: string;
  emotionBefore: PADState;
  emotionAfter: PADState;
  appraisal: AppraisalVector;
  plan: TurnPlan;
  candidates: Array<{ text: string; scores: Record<string, number> }>;
  winnerIndex: number;
  userMessage: string;
  assistantMessage: string;
};

/**
 * Run a draft chat turn using workspace draft state.
 */
export async function runDraftChatTurn(input: DraftChatTurnInput): Promise<DraftChatTurnOutput> {
  const { workspaceId, userId, message } = input;

  // ==========================================
  // Step 1: Load workspace and draft
  // ==========================================
  const workspace = await workspaceRepo.getWithDraft(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const { draft } = workspace;

  // Get or create session
  let session: PlaygroundSession;
  if (input.sessionId) {
    const existingSession = await workspaceRepo.getSession(input.sessionId);
    if (!existingSession) {
      throw new Error(`Session ${input.sessionId} not found`);
    }
    session = existingSession;
  } else {
    session = await workspaceRepo.createSession({
      workspaceId,
      userId,
    });
  }

  const persistedSandboxState = await workspaceRepo.getSandboxPairState(session.id);

  // Get existing turns for recent dialogue
  const existingTurns = await workspaceRepo.getTurns(session.id);

  // Build recent dialogue
  const recentDialogue = existingTurns.flatMap((t) => [
    { role: 'user' as const, content: t.userMessageText },
    { role: 'assistant' as const, content: t.assistantMessageText },
  ]);

  // ==========================================
  // Step 2: Build runtime context from draft
  // ==========================================
  const phaseEngine = createPhaseEngine(draft.phaseGraph);

  // Use forced phase or entry phase for new sessions
  const currentPhaseId =
    input.forcePhaseId ??
    persistedSandboxState?.activePhaseId ??
    draft.phaseGraph.entryPhaseId;
  const currentPhase = phaseEngine.getPhase(currentPhaseId) ?? phaseEngine.getEntryPhase();

  // Use forced PAD or baseline
  const currentPAD = input.forcePAD ?? persistedSandboxState?.pad ?? draft.emotion.baselinePAD;

  // Default working memory for sandbox
  const workingMemory: WorkingMemory = {
    preferredAddressForm: draft.identity.secondPerson,
    knownLikes: [],
    knownDislikes: [],
    currentCooldowns: {},
    activeTensionSummary: null,
    relationshipStance: 'new',
    knownCorrections: [],
    intimacyContextHints: [],
  };

  // Default pair state for sandbox
  const sandboxPairState: PairState = {
    pairId: session.id,
    activeCharacterVersionId: `draft-${workspaceId}`,
    activePhaseId: currentPhaseId,
    affinity: persistedSandboxState?.affinity ?? 50,
    trust: persistedSandboxState?.trust ?? 50,
    intimacyReadiness: persistedSandboxState?.intimacyReadiness ?? 0,
    conflict: persistedSandboxState?.conflict ?? 0,
    pad: currentPAD,
    appraisal: persistedSandboxState?.appraisal ?? {
      goalCongruence: 0,
      controllability: 0.5,
      certainty: 0.5,
      normAlignment: 0,
      attachmentSecurity: 0.5,
      reciprocity: 0,
      pressureIntrusiveness: 0,
      novelty: 0.5,
      selfRelevance: 0.5,
    },
    openThreadCount: 0,
    lastTransitionAt: null,
    updatedAt: persistedSandboxState?.updatedAt ?? session.createdAt,
  };

  // Build character version-like object from draft
  const characterVersion = {
    id: `draft-${workspaceId}`,
    characterId: workspace.characterId,
    persona: draft.persona,
    style: draft.style,
    autonomy: draft.autonomy,
    emotion: draft.emotion,
    memory: draft.memory,
  };

  // ==========================================
  // Step 3: Compute appraisal
  // ==========================================
  const appraisal = computeAppraisal({
    userMessage: message,
    characterVersion: characterVersion as never,
    pairState: sandboxPairState as never,
    workingMemory,
    openThreads: [],
    recentDialogue,
  });

  // ==========================================
  // Step 4: Update emotion (PAD)
  // ==========================================
  const emotionBefore = currentPAD;
  const padUpdate = updatePAD({
    currentPAD,
    appraisal,
    emotionSpec: draft.emotion,
    hasOpenThreads: false,
    turnsSinceLastUpdate: 1,
  });
  const emotionAfter = padUpdate.combined;
  const relationshipAfter = updateRelationshipMetrics({
    current: sandboxPairState,
    appraisal,
    emotionBefore,
    emotionAfter,
  });
  const pairStateAfterUpdate: PairState = {
    ...sandboxPairState,
    ...relationshipAfter,
    pad: emotionAfter,
    appraisal,
    updatedAt: new Date(),
  };

  // ==========================================
  // Step 5: Plan turn
  // ==========================================
  const plannerResult = await runPlanner({
    characterVersion: characterVersion as never,
    currentPhase,
    pairState: pairStateAfterUpdate as never,
    emotion: emotionAfter,
    workingMemory,
    retrievedMemory: {
      events: [],
      facts: [],
      threads: [],
    },
    recentDialogue,
    userMessage: message,
    promptOverride: draft.prompts.plannerMd,
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
    stance: plan.stance,
    primaryActs: plan.primaryActs,
  });

  // ==========================================
  // Step 6: Evaluate phase transition
  // ==========================================
  const timing = deriveSandboxPhaseTiming({
    sessionCreatedAt: session.createdAt,
    turns: existingTurns,
    currentPhaseId,
  });
  const phaseContext = buildPhaseEngineRuntimeContext({
    edges: phaseEngine.getEdgesFrom(currentPhaseId),
    pairState: pairStateAfterUpdate,
    pad: emotionAfter,
    openThreads: [],
    recentDialogue,
    currentUserMessage: message,
    turnsSinceLastTransition: timing.turnsSinceLastTransition,
    daysSinceEntry: timing.daysSinceEntry,
  });
  const phaseIdBefore = currentPhaseId;
  const transitionResult = phaseEngine.evaluateTransition(phaseIdBefore, phaseContext);
  const phaseIdAfter =
    resolvePhaseTransition(
      transitionResult,
      plan.phaseTransitionProposal.shouldTransition
        ? plan.phaseTransitionProposal.targetPhaseId
        : null
    ) ?? phaseIdBefore;
  const activePhase = phaseEngine.getPhase(phaseIdAfter) ?? currentPhase;
  const pairStateForGeneration: PairState = {
    ...pairStateAfterUpdate,
    activePhaseId: phaseIdAfter,
  };

  // ==========================================
  // Step 7: Generate candidates
  // ==========================================
  const generatorPrompt = selectGeneratorPrompt(
    {
      generatorMd: draft.prompts.generatorMd,
      generatorIntimacyMd: draft.prompts.generatorIntimacyMd,
    },
    plan
  );

  const generatorResult = await runGenerator({
    characterVersion: characterVersion as never,
    currentPhase: activePhase,
    pairState: pairStateForGeneration as never,
    emotion: emotionAfter,
    workingMemory,
    retrievedMemory: {
      events: [],
      facts: [],
      threads: [],
    },
    recentDialogue,
    userMessage: message,
    plan,
    promptOverride: generatorPrompt,
  });

  // ==========================================
  // Step 8: Rank candidates
  // ==========================================
  const rankerResult = await runRanker({
    characterVersion: characterVersion as never,
    currentPhase: activePhase,
    pairState: pairStateForGeneration as never,
    emotion: emotionAfter,
    workingMemory,
    openThreads: [],
    userMessage: message,
    plan,
    candidates: generatorResult.candidates,
    promptOverride: draft.prompts.rankerMd,
  });

  const winningCandidate = rankerResult.candidates[rankerResult.winnerIndex];
  const assistantMessage = winningCandidate.text;

  // ==========================================
  // Step 9: Build trace
  // ==========================================
  const trace: DraftChatTrace = {
    workspaceId,
    phaseIdBefore,
    phaseIdAfter,
    emotionBefore,
    emotionAfter,
    appraisal,
    plan,
    candidates: rankerResult.candidates.map((c) => ({
      text: c.text,
      scores: c.scores,
    })),
    winnerIndex: rankerResult.winnerIndex,
    userMessage: message,
    assistantMessage,
  };

  // ==========================================
  // Step 10: Save turn and persist sandbox state
  // ==========================================
  const turn = await workspaceRepo.createTurn({
    sessionId: session.id,
    userMessageText: message,
    assistantMessageText: assistantMessage,
    traceJson: trace,
  });

  await workspaceRepo.saveSandboxPairState({
    sessionId: session.id,
    activePhaseId: phaseIdAfter,
    affinity: pairStateForGeneration.affinity,
    trust: pairStateForGeneration.trust,
    intimacyReadiness: pairStateForGeneration.intimacyReadiness,
    conflict: pairStateForGeneration.conflict,
    pad: emotionAfter,
    appraisal,
    openThreadCount: 0,
  });

  return {
    text: assistantMessage,
    sessionId: session.id,
    turnId: turn.id,
    phaseId: phaseIdAfter,
    emotion: emotionAfter,
    coe,
    trace,
  };
}
