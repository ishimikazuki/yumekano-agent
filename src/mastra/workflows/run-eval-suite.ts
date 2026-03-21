import { v4 as uuid } from 'uuid';
import { evalRepo, characterRepo, phaseGraphRepo, promptBundleRepo } from '@/lib/repositories';
import { runChatTurn } from './chat-turn';
import {
  scorePersonaConsistency,
  scorePhaseCompliance,
  scoreAutonomy,
  scoreEmotionalCoherence,
  scoreMemoryGrounding,
  scoreRefusalNaturalness,
  scoreContradictionPenalty,
} from '../scorers';
import type {
  ScenarioCase,
  EvalRun,
  EvalCaseResult,
  CharacterVersion,
  PhaseNode,
} from '@/lib/schemas';

export type RunEvalSuiteInput = {
  characterVersionId: string;
  scenarioSetId: string;
  evalRunId?: string;
};

export type RunEvalSuiteOutput = {
  evalRunId: string;
  status: 'completed' | 'failed';
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    avgScore: number;
  };
};

/**
 * Run evaluation suite workflow.
 *
 * Steps:
 * 1. Materialize scenario cases
 * 2. Run each case in isolated sandbox threads
 * 3. Score outputs
 * 4. Aggregate results
 * 5. Persist eval run + case traces
 */
export async function runEvalSuite(input: RunEvalSuiteInput): Promise<RunEvalSuiteOutput> {
  const { characterVersionId, scenarioSetId, evalRunId } = input;

  let activeEvalRunId = evalRunId;

  try {
    // Get character version
    const characterVersion = await characterRepo.getVersionById(characterVersionId);
    if (!characterVersion) {
      throw new Error(`Character version ${characterVersionId} not found`);
    }

    // Get phase graph
    const phaseGraph = await phaseGraphRepo.getById(characterVersion.phaseGraphVersionId);
    if (!phaseGraph) {
      throw new Error(`Phase graph not found`);
    }

    // Get scenario cases
    const scenarioCases = await evalRepo.getCasesBySet(scenarioSetId);
    if (scenarioCases.length === 0) {
      throw new Error(`No scenario cases found for set ${scenarioSetId}`);
    }

    // Create eval run when not supplied by caller
    const evalRun = activeEvalRunId
      ? await evalRepo.getEvalRunById(activeEvalRunId)
      : await evalRepo.createRun({
          scenarioSetId,
          characterVersionId,
          modelRegistrySnapshot: {}, // Would capture current model config
        });

    if (!evalRun) {
      throw new Error(`Eval run ${activeEvalRunId} not found`);
    }

    activeEvalRunId = evalRun.id;
    await evalRepo.updateRunStatus(evalRun.id, 'running');

    const results: EvalCaseResult[] = [];
    let totalScore = 0;
    let passed = 0;
    let failed = 0;

    // Run each scenario case
    for (const scenario of scenarioCases) {
      try {
        const caseResult = await runSingleCase({
          scenario,
          characterVersion,
          phaseGraph: phaseGraph.graph,
          evalRunId: evalRun.id,
        });

        results.push(caseResult);
        totalScore += caseResult.overallScore;

        if (caseResult.overallScore >= 0.6) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to run scenario ${scenario.id}:`, error);
        failed++;
      }
    }

    // Update eval run status
    const avgScore = results.length > 0 ? totalScore / results.length : 0;
    await evalRepo.updateRunStatus(evalRun.id, 'completed', {
      totalCases: scenarioCases.length,
      passed,
      failed,
      avgScore,
    });

    return {
      evalRunId: evalRun.id,
      status: 'completed',
      summary: {
        totalCases: scenarioCases.length,
        passed,
        failed,
        avgScore,
      },
    };
  } catch (error) {
    if (activeEvalRunId) {
      await evalRepo.updateRunStatus(activeEvalRunId, 'failed');
    }
    throw error;
  }
}

type RunSingleCaseInput = {
  scenario: ScenarioCase;
  characterVersion: CharacterVersion;
  phaseGraph: { nodes: PhaseNode[]; edges: unknown[]; entryPhaseId: string };
  evalRunId: string;
};

async function runSingleCase(input: RunSingleCaseInput): Promise<EvalCaseResult & { overallScore: number }> {
  const { scenario, characterVersion, phaseGraph, evalRunId } = input;

  // Create sandbox user/thread for this case
  const sandboxUserId = `eval-${uuid()}`;
  const sandboxThreadId = `eval-thread-${uuid()}`;

  // Run the chat turn
  const chatResult = await runChatTurn({
    userId: sandboxUserId,
    characterId: characterVersion.characterId,
    threadId: sandboxThreadId,
    message: scenario.input.userMessage,
  });

  // Get the trace for scoring
  const { traceRepo } = await import('@/lib/repositories');
  const trace = await traceRepo.getTraceById(chatResult.traceId);

  if (!trace) {
    throw new Error(`Trace not found for ${chatResult.traceId}`);
  }

  // Get current phase
  const currentPhase = phaseGraph.nodes.find(n => n.id === trace.phaseIdAfter);
  if (!currentPhase) {
    throw new Error(`Phase ${trace.phaseIdAfter} not found`);
  }

  // Run scorers
  const scores: Record<string, number> = {};
  const issues: string[] = [];

  // persona_consistency
  const personaResult = await scorePersonaConsistency({ trace, characterVersion });
  scores.persona_consistency = personaResult.score;
  issues.push(...personaResult.issues);

  // phase_compliance
  const phaseResult = await scorePhaseCompliance({ trace, characterVersion, phaseNode: currentPhase });
  scores.phase_compliance = phaseResult.score;
  issues.push(...phaseResult.issues);

  // autonomy
  const autonomyResult = await scoreAutonomy({
    trace,
    characterVersion,
    recentDialogue: [{ role: 'user', content: scenario.input.userMessage }],
  });
  scores.autonomy = autonomyResult.score;
  issues.push(...autonomyResult.issues);

  // emotional_coherence
  const emotionResult = await scoreEmotionalCoherence({ trace });
  scores.emotional_coherence = emotionResult.score;
  issues.push(...emotionResult.issues);

  // memory_grounding (simplified - would need actual memory)
  scores.memory_grounding = 0.8; // Placeholder

  // refusal_naturalness
  const refusalResult = await scoreRefusalNaturalness({ trace, characterVersion });
  scores.refusal_naturalness = refusalResult.score;
  if (refusalResult.wasRefusal) {
    issues.push(...refusalResult.issues);
  }

  // contradiction_penalty
  const contradictionResult = await scoreContradictionPenalty({
    trace,
    activeFacts: [],
    openThreads: [],
    recentDialogue: [{ role: 'user', content: scenario.input.userMessage }],
  });
  scores.contradiction_penalty = contradictionResult.score;
  issues.push(...contradictionResult.issues);

  // Calculate overall score (weighted average)
  const weights = {
    persona_consistency: 0.2,
    phase_compliance: 0.2,
    autonomy: 0.15,
    emotional_coherence: 0.15,
    memory_grounding: 0.1,
    refusal_naturalness: 0.1,
    contradiction_penalty: 0.1,
  };

  let overallScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    overallScore += (scores[key] ?? 0) * weight;
  }

  // Create eval case result
  const caseResult = await evalRepo.createCaseResult({
    evalRunId,
    scenarioCaseId: scenario.id,
    scores,
    passed: overallScore >= 0.6,
    failureReasons: issues,
    traceId: trace.id,
  });

  return { ...caseResult, overallScore };
}
