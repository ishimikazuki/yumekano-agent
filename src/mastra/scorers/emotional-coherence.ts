import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { TurnTrace, PADState } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
});

export type ScorerInput = {
  trace: TurnTrace;
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
};

function describePAD(pad: PADState): string {
  const { pleasure, arousal, dominance } = pad;
  const parts: string[] = [];

  if (pleasure > 0.3) parts.push('positive/happy');
  else if (pleasure < -0.3) parts.push('negative/unhappy');
  else parts.push('neutral mood');

  if (arousal > 0.3) parts.push('excited/energetic');
  else if (arousal < -0.3) parts.push('calm/tired');

  if (dominance > 0.2) parts.push('confident/in-control');
  else if (dominance < -0.2) parts.push('submissive/uncertain');

  return parts.join(', ');
}

/**
 * emotional_coherence scorer
 * Evaluates whether the reply tone matches the emotional state.
 */
export async function scoreEmotionalCoherence(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');

  const { trace } = input;

  const emotionDesc = describePAD(trace.emotionAfter);
  const stancePlanned = trace.plan.stance;

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are evaluating emotional coherence in a conversational AI system.
The reply's tone should match the character's current emotional state.

Emotional State (PAD):
- Pleasure: ${trace.emotionAfter.pleasure.toFixed(2)} (${trace.emotionAfter.pleasure > 0 ? 'positive' : 'negative'})
- Arousal: ${trace.emotionAfter.arousal.toFixed(2)} (${trace.emotionAfter.arousal > 0 ? 'active' : 'passive'})
- Dominance: ${trace.emotionAfter.dominance.toFixed(2)} (${trace.emotionAfter.dominance > 0 ? 'assertive' : 'submissive'})

Interpreted emotional state: ${emotionDesc}
Planned stance: ${stancePlanned}

Score 0.0-1.0 where:
- 1.0 = Tone perfectly matches emotional state
- 0.7+ = Generally coherent
- 0.5 = Somewhat mismatched
- < 0.3 = Clear emotional dissonance`,
    prompt: `User message: ${trace.userMessage}

Assistant reply: ${trace.assistantMessage}

Evaluate whether the reply's tone matches the emotional state (${emotionDesc}, ${stancePlanned}).`,
  });

  return result.object;
}
