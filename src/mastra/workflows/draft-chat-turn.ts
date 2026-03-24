import { workspaceRepo } from '@/lib/repositories';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import { deriveSandboxPhaseTiming } from '@/lib/rules/phase-runtime';
import { getOrCreateWorkingMemory } from '../memory/retrieval';
import { createSandboxMemoryStore } from '../memory/store';
import { executeTurn } from './execute-turn';
import { runConsolidateMemory, shouldTriggerConsolidation } from './consolidate-memory';
import type {
  PADState,
  TurnTrace,
  PlaygroundSession,
  PairState,
  CharacterVersion,
  PromptBundleVersion,
} from '@/lib/schemas';

export type DraftChatTurnInput = {
  workspaceId: string;
  sessionId?: string;
  userId: string;
  message: string;
  forcePhaseId?: string;
  forcePAD?: PADState;
};

export type DraftChatTurnOutput = {
  text: string;
  sessionId: string;
  turnId: string;
  phaseId: string;
  emotion: PADState;
  coe: Awaited<ReturnType<typeof executeTurn>>['coe'];
  trace: TurnTrace;
};

export type DraftChatTrace = TurnTrace;

export async function runDraftChatTurn(input: DraftChatTurnInput): Promise<DraftChatTurnOutput> {
  const { workspaceId, userId, message } = input;
  const workspace = await workspaceRepo.getWithDraft(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const session = await getOrCreateSession(workspaceId, userId, input.sessionId);
  const sandboxStore = createSandboxMemoryStore();
  const existingTurns = await workspaceRepo.getTurns(session.id);
  const recentDialogue = existingTurns.flatMap((turn) => [
    { role: 'user' as const, content: turn.userMessageText },
    { role: 'assistant' as const, content: turn.assistantMessageText },
  ]);

  const promptBundle: PromptBundleVersion = {
    id: workspace.id,
    characterId: workspace.characterId,
    versionNumber: 1,
    plannerMd: workspace.draft.prompts.plannerMd,
    generatorMd: workspace.draft.prompts.generatorMd,
    generatorIntimacyMd: workspace.draft.prompts.generatorIntimacyMd,
    extractorMd: workspace.draft.prompts.extractorMd,
    reflectorMd: workspace.draft.prompts.reflectorMd,
    rankerMd: workspace.draft.prompts.rankerMd,
    createdAt: workspace.updatedAt,
  };

  const characterVersion: CharacterVersion = {
    id: workspace.draft.baseVersionId ?? workspace.characterId,
    characterId: workspace.characterId,
    versionNumber: 1,
    status: 'draft',
    persona: {
      ...workspace.draft.persona,
      compiledPersona: undefined,
    },
    style: workspace.draft.style,
    autonomy: workspace.draft.autonomy,
    emotion: workspace.draft.emotion,
    memory: workspace.draft.memory,
    phaseGraphVersionId: workspace.id,
    promptBundleVersionId: workspace.id,
    createdBy: workspace.createdBy,
    createdAt: workspace.updatedAt,
    label: workspace.name,
    parentVersionId: workspace.draft.baseVersionId,
  };

  const persistedSandboxState = await workspaceRepo.getSandboxPairState(session.id);
  const phaseEngine = createPhaseEngine(workspace.draft.phaseGraph);
  const activePhaseId =
    input.forcePhaseId ?? persistedSandboxState?.activePhaseId ?? workspace.draft.phaseGraph.entryPhaseId;
  const currentPhase = phaseEngine.getPhase(activePhaseId) ?? phaseEngine.getEntryPhase();

  const currentPAD = input.forcePAD ?? persistedSandboxState?.pad ?? workspace.draft.emotion.baselinePAD;
  const currentEmotion =
    persistedSandboxState?.emotion ?? createRuntimeEmotionState(currentPAD, session.createdAt);

  const pairState: PairState = {
    pairId: session.id,
    activeCharacterVersionId: characterVersion.id,
    activePhaseId,
    affinity: persistedSandboxState?.affinity ?? 50,
    trust: persistedSandboxState?.trust ?? 50,
    intimacyReadiness: persistedSandboxState?.intimacyReadiness ?? 0,
    conflict: persistedSandboxState?.conflict ?? 0,
    emotion: currentEmotion,
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
    openThreadCount: persistedSandboxState?.openThreadCount ?? 0,
    lastTransitionAt: null,
    updatedAt: persistedSandboxState?.updatedAt ?? session.createdAt,
  };

  const workingMemory = await getOrCreateWorkingMemory(session.id, sandboxStore);
  const timing = deriveSandboxPhaseTiming({
    sessionCreatedAt: session.createdAt,
    turns: existingTurns,
    currentPhaseId: activePhaseId,
  });
  const turnsSinceLastEmotionUpdate =
    existingTurns.filter((turn) => new Date(turn.createdAt) > new Date(currentEmotion.lastUpdatedAt)).length + 1;

  const result = await executeTurn({
    scopeId: session.id,
    tracePairId: session.id,
    traceCharacterVersionId: characterVersion.id,
    tracePromptBundleVersionId: promptBundle.id,
    threadId: session.id,
    userMessage: message,
    characterVersion,
    phaseGraph: workspace.draft.phaseGraph,
    promptBundle,
    pairState,
    currentPhase,
    workingMemory,
    recentDialogue,
    turnsSinceLastTransition: timing.turnsSinceLastTransition,
    daysSinceEntry: timing.daysSinceEntry,
    turnsSinceLastEmotionUpdate,
    memoryStore: sandboxStore,
    persistence: {
      createTurnRecord: async ({
        turnId,
        userMessageText,
        assistantMessageText,
        pendingTrace,
      }) => {
        await workspaceRepo.createTurn({
          id: turnId,
          sessionId: session.id,
          userMessageText,
          assistantMessageText,
          traceJson: pendingTrace ?? { pending: true },
        });
      },
      persistTrace: async () => {},
      updateTurnTrace: async (turnId, trace) => {
        await workspaceRepo.updateTurnTrace(turnId, trace);
      },
      updatePairState: async (nextState) => {
        await workspaceRepo.saveSandboxPairState({
          sessionId: session.id,
          activePhaseId: nextState.activePhaseId,
          affinity: nextState.affinity,
          trust: nextState.trust,
          intimacyReadiness: nextState.intimacyReadiness,
          conflict: nextState.conflict,
          emotion: nextState.emotion,
          pad: nextState.pad,
          appraisal: nextState.appraisal,
          openThreadCount: nextState.openThreadCount,
        });
      },
      maybeConsolidate: async ({ pairState, characterVersion }) => {
        if (
          await shouldTriggerConsolidation({
            scopeId: session.id,
            memoryStore: sandboxStore,
          })
        ) {
          await runConsolidateMemory({
            scopeId: session.id,
            mode: 'light',
            memoryStore: sandboxStore,
            pairState,
            characterVersion,
          });
        }
      },
    },
  });

  return {
    text: result.text,
    sessionId: session.id,
    turnId: result.turnId,
    phaseId: result.phaseId,
    emotion: result.emotion,
    coe: result.coe,
    trace: result.trace,
  };
}

async function getOrCreateSession(
  workspaceId: string,
  userId: string,
  sessionId?: string
): Promise<PlaygroundSession> {
  if (sessionId) {
    const existing = await workspaceRepo.getSession(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return existing;
  }

  return workspaceRepo.createSession({ workspaceId, userId });
}
