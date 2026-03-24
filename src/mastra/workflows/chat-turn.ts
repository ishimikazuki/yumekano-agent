import {
  characterRepo,
  pairRepo,
  traceRepo,
  releaseRepo,
  phaseGraphRepo,
  promptBundleRepo,
} from '@/lib/repositories';
import { createPhaseEngine } from '@/lib/rules/phase-engine';
import { getOrCreateWorkingMemory } from '../memory/retrieval';
import { createProductionMemoryStore } from '../memory/store';
import { executeTurn } from './execute-turn';
import { runConsolidateMemory, shouldTriggerConsolidation } from './consolidate-memory';
import type {
  CharacterVersion,
  PhaseGraph,
  PhaseGraphVersion,
  PromptBundleVersion,
  PADState,
} from '@/lib/schemas';

export type ChatTurnInput = {
  userId: string;
  characterId: string;
  threadId?: string;
  message: string;
  releaseChannel?: 'prod';
  characterVersionOverride?: CharacterVersion;
  phaseGraphOverride?: PhaseGraph;
  promptBundleOverride?: PromptBundleVersion;
};

export type ChatTurnOutput = {
  text: string;
  traceId: string;
  phaseId: string;
  emotion: PADState;
  coe: Awaited<ReturnType<typeof executeTurn>>['coe'];
};

export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnOutput> {
  const context = await loadContext(input);
  const memoryStore = createProductionMemoryStore();
  const workingMemory = await getOrCreateWorkingMemory(context.pair.id, memoryStore);
  const recentDialogue = context.recentTurns.flatMap((turn) => [
    { role: 'user' as const, content: turn.userMessageText },
    { role: 'assistant' as const, content: turn.assistantMessageText },
  ]);

  const phaseEntryReference = context.pairState.lastTransitionAt ?? context.pair.createdAt;
  const daysSinceEntry = Math.max(
    0,
    Math.floor((Date.now() - phaseEntryReference.getTime()) / (24 * 60 * 60 * 1000))
  );
  const turnsSinceLastTransition = await traceRepo.countTurnsSince(
    context.pair.id,
    context.pairState.lastTransitionAt
  );
  const turnsSinceLastEmotionUpdate =
    Math.max(0, await traceRepo.countTurnsSince(context.pair.id, context.pairState.emotion.lastUpdatedAt)) + 1;

  const result = await executeTurn({
    scopeId: context.pair.id,
    tracePairId: context.pair.id,
    traceCharacterVersionId: context.characterVersion.id,
    tracePromptBundleVersionId: context.promptBundle.id,
    threadId: input.threadId ?? context.pair.canonicalThreadId,
    userMessage: input.message,
    characterVersion: context.characterVersion,
    phaseGraph: context.phaseGraph.graph,
    promptBundle: context.promptBundle,
    pairState: context.pairState,
    currentPhase: context.currentPhase,
    workingMemory,
    recentDialogue,
    turnsSinceLastTransition,
    daysSinceEntry,
    turnsSinceLastEmotionUpdate,
    memoryStore,
    persistence: {
      createTurnRecord: async ({
        turnId,
        traceId,
        threadId,
        userMessageText,
        assistantMessageText,
        plan,
        rankerSummary,
      }) => {
        await traceRepo.createChatTurn({
          id: turnId,
          pairId: context.pair.id,
          threadId,
          userMessageText,
          assistantMessageText,
          plannerJson: plan,
          rankerJson: rankerSummary,
          traceId,
        });
      },
      persistTrace: async (trace) => {
        await traceRepo.createTrace(trace);
      },
      updatePairState: async (nextState) => {
        await pairRepo.updateState(context.pair.id, {
          activeCharacterVersionId: nextState.activeCharacterVersionId,
          activePhaseId: nextState.activePhaseId,
          affinity: nextState.affinity,
          trust: nextState.trust,
          intimacyReadiness: nextState.intimacyReadiness,
          conflict: nextState.conflict,
          emotion: nextState.emotion,
          pad: nextState.pad,
          appraisal: nextState.appraisal,
          openThreadCount: nextState.openThreadCount,
          lastTransitionAt: nextState.lastTransitionAt,
        });
      },
      maybeConsolidate: async ({ pairState, characterVersion }) => {
        if (
          await shouldTriggerConsolidation({
            scopeId: context.pair.id,
            memoryStore,
          })
        ) {
          await runConsolidateMemory({
            scopeId: context.pair.id,
            mode: 'light',
            memoryStore,
            pairState,
            characterVersion,
          });
        }
      },
    },
  });

  return {
    text: result.text,
    traceId: result.traceId,
    phaseId: result.phaseId,
    emotion: result.emotion,
    coe: result.coe,
  };
}

async function loadContext(input: ChatTurnInput) {
  const { userId, characterId, releaseChannel = 'prod' } = input;
  const pair = await pairRepo.getOrCreate({ userId, characterId });

  const characterVersion =
    input.characterVersionOverride ??
    (await (async () => {
      const release = await releaseRepo.getCurrent(characterId, releaseChannel);
      if (!release) {
        throw new Error(`No published release for character ${characterId}`);
      }
      const version = await characterRepo.getVersionById(release.characterVersionId);
      if (!version) {
        throw new Error(`Character version ${release.characterVersionId} not found`);
      }
      return version;
    })());

  const phaseGraph: PhaseGraphVersion | null = input.phaseGraphOverride
    ? {
        id: characterVersion.phaseGraphVersionId,
        characterId: characterVersion.characterId,
        versionNumber: characterVersion.versionNumber,
        graph: input.phaseGraphOverride,
        createdAt: characterVersion.createdAt,
      }
    : await phaseGraphRepo.getById(characterVersion.phaseGraphVersionId);
  if (!phaseGraph) {
    throw new Error(`Phase graph ${characterVersion.phaseGraphVersionId} not found`);
  }

  const promptBundle =
    input.promptBundleOverride ??
    (await promptBundleRepo.getById(characterVersion.promptBundleVersionId));
  if (!promptBundle) {
    throw new Error(`Prompt bundle ${characterVersion.promptBundleVersionId} not found`);
  }

  let pairState = await pairRepo.getState(pair.id);
  if (!pairState) {
    pairState = await pairRepo.initState({
      pairId: pair.id,
      activeCharacterVersionId: characterVersion.id,
      activePhaseId: phaseGraph.graph.entryPhaseId,
      pad: characterVersion.emotion.baselinePAD,
    });
  }

  const recentTurns = await traceRepo.getRecentTurns(pair.id, 10);
  const phaseEngine = createPhaseEngine(phaseGraph.graph);
  const currentPhase = phaseEngine.getPhase(pairState.activePhaseId) ?? phaseEngine.getEntryPhase();

  return {
    pair,
    pairState,
    characterVersion,
    phaseGraph,
    promptBundle,
    recentTurns,
    currentPhase,
  };
}
