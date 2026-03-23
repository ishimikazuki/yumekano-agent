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
import { runPlanner } from '../agents/planner';
import { runGenerator, selectGeneratorPrompt } from '../agents/generator';
import { runRanker } from '../agents/ranker';
import type {
  PADState,
  AppraisalVector,
  TurnPlan,
  WorkingMemory,
  PlaygroundSession,
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
  const currentPhaseId = input.forcePhaseId ?? draft.phaseGraph.entryPhaseId;
  const currentPhase = phaseEngine.getPhase(currentPhaseId) ?? phaseEngine.getEntryPhase();

  // Use forced PAD or baseline
  const currentPAD = input.forcePAD ?? draft.emotion.baselinePAD;

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
  const sandboxPairState = {
    affinity: 50,
    trust: 50,
    intimacyReadiness: 0,
    conflict: 0,
    pad: currentPAD,
    appraisal: {
      goalCongruence: 0,
      controllability: 0,
      certainty: 0,
      normAlignment: 0,
      attachmentSecurity: 0,
      reciprocity: 0,
      pressureIntrusiveness: 0,
      novelty: 0,
    },
    openThreadCount: 0,
    activePhaseId: currentPhaseId,
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

  // ==========================================
  // Step 5: Plan turn
  // ==========================================
  const plannerResult = await runPlanner({
    characterVersion: characterVersion as never,
    currentPhase,
    pairState: { ...sandboxPairState, pad: emotionAfter, appraisal } as never,
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
  // Step 6: Generate candidates
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
    currentPhase,
    pairState: { ...sandboxPairState, pad: emotionAfter, appraisal } as never,
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
  // Step 7: Rank candidates
  // ==========================================
  const rankerResult = await runRanker({
    characterVersion: characterVersion as never,
    currentPhase,
    pairState: { ...sandboxPairState, pad: emotionAfter, appraisal } as never,
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
  // Step 8: Build trace
  // ==========================================
  const trace: DraftChatTrace = {
    workspaceId,
    phaseIdBefore: currentPhaseId,
    phaseIdAfter: currentPhaseId, // No transition in sandbox for now
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
  // Step 9: Save turn
  // ==========================================
  const turn = await workspaceRepo.createTurn({
    sessionId: session.id,
    userMessageText: message,
    assistantMessageText: assistantMessage,
    traceJson: trace,
  });

  return {
    text: assistantMessage,
    sessionId: session.id,
    turnId: turn.id,
    phaseId: currentPhaseId,
    emotion: emotionAfter,
    coe,
    trace,
  };
}
