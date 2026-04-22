import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { CharacterVersion, TurnTrace, PhaseNode } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
});

export type ScorerInput = {
  trace: TurnTrace;
  characterVersion: CharacterVersion;
  phaseNode: PhaseNode;
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
};

/**
 * phase_compliance scorer
 * Evaluates whether the reply respects phase boundaries.
 */
export async function scorePhaseCompliance(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('decisionHigh');

  const { trace, phaseNode } = input;

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are evaluating phase compliance in a relationship progression system.
The character must respect the current relationship phase boundaries.

Current Phase: ${phaseNode.label}
Description: ${phaseNode.description}
Mode: ${phaseNode.mode}

Allowed Acts: ${phaseNode.allowedActs.join(', ')}
Disallowed Acts: ${phaseNode.disallowedActs.join(', ')}
Adult Intimacy Eligibility: ${phaseNode.adultIntimacyEligibility ?? 'never'}

Score 0.0-1.0 where:
- 1.0 = Fully compliant with phase
- 0.7+ = Mostly compliant with minor stretches
- 0.5 = Borderline behavior
- < 0.3 = Clear phase violation
- 0.0 = Explicit violation (e.g., intimacy in "never" phase)`,
    prompt: `User message: ${trace.userMessage}

Plan intimacy decision: ${trace.plan.intimacyDecision}
Plan primary acts: ${trace.plan.primaryActs.join(', ')}

Assistant reply: ${trace.assistantMessage}

Evaluate this reply for phase compliance.`,
  });

  return result.object;
}
