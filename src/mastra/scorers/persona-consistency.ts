import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { CharacterVersion, TurnTrace } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
});

export type ScorerInput = {
  trace: TurnTrace;
  characterVersion: CharacterVersion;
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
};

/**
 * persona_consistency scorer
 * Evaluates whether the reply sounds like this character.
 */
export async function scorePersonaConsistency(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');

  const { trace, characterVersion } = input;

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are evaluating character consistency in a conversational AI system.
Score how well the assistant's reply matches the defined character persona.

Character Definition:
- Summary: ${characterVersion.persona.summary}
- Values: ${characterVersion.persona.values.join(', ')}
- Flaws: ${characterVersion.persona.flaws.join(', ')}
- Signature behaviors: ${characterVersion.persona.signatureBehaviors.join(', ')}

Style:
- Politeness: ${characterVersion.style.politenessDefault}
- Directness: ${characterVersion.style.directness}
- Playfulness: ${characterVersion.style.playfulness}
- Signature phrases: ${characterVersion.style.signaturePhrases.join(', ')}
- Taboo phrases (should NEVER use): ${characterVersion.style.tabooPhrases.join(', ')}

Score 0.0-1.0 where:
- 1.0 = Perfect character match
- 0.7+ = Generally consistent with minor issues
- 0.5 = Mixed, some elements match
- < 0.5 = Significant character breaks`,
    prompt: `User message: ${trace.userMessage}

Assistant reply: ${trace.assistantMessage}

Evaluate this reply for persona consistency.`,
  });

  return result.object;
}
