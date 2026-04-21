import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { TurnTrace, CharacterVersion } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
  wasRefusal: z.boolean(),
});

export type ScorerInput = {
  trace: TurnTrace;
  characterVersion: CharacterVersion;
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
  wasRefusal: boolean;
};

/**
 * refusal_naturalness scorer
 * Evaluates whether refusals/delays sound relationally believable.
 */
export async function scoreRefusalNaturalness(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('decisionHigh');

  const { trace, characterVersion } = input;

  const intimacyDecision = trace.plan.intimacyDecision;
  const isRefusalContext =
    intimacyDecision === 'decline_gracefully' ||
    intimacyDecision === 'decline_firmly' ||
    intimacyDecision === 'delay' ||
    trace.plan.primaryActs.includes('refuse') ||
    trace.plan.primaryActs.includes('delay') ||
    trace.plan.primaryActs.includes('set_boundary');

  if (!isRefusalContext) {
    // No refusal scenario, return neutral score
    return {
      score: 1.0,
      reasoning: 'No refusal scenario in this turn',
      issues: [],
      wasRefusal: false,
    };
  }

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are evaluating refusal naturalness in a relationship AI system.
When the character declines or delays, it should sound like a real person, not a robot.

Character autonomy context:
- Refusal Readiness: ${characterVersion.autonomy.refusalReadiness}
- Delay Readiness: ${characterVersion.autonomy.delayReadiness}
- Intimacy Never On Demand: ${characterVersion.autonomy.intimacyNeverOnDemand}

Planned approach:
- Intimacy Decision: ${intimacyDecision}
- Primary Acts: ${trace.plan.primaryActs.join(', ')}

Signs of GOOD refusal:
- Feels like the character's own choice
- Offers relational context (mood, timing, feelings)
- Maintains connection while declining
- Doesn't sound scripted or policy-based
- May offer alternatives or future possibilities

Signs of BAD refusal:
- Sounds robotic or policy-driven
- Generic "I can't do that" responses
- No emotional or relational texture
- Breaks character voice
- Too abrupt or harsh

Score 0.0-1.0 where:
- 1.0 = Natural, believable refusal
- 0.7+ = Generally natural
- 0.5 = Somewhat stilted
- < 0.3 = Robotic or out of character`,
    prompt: `User message: ${trace.userMessage}

Assistant reply: ${trace.assistantMessage}

Evaluate the naturalness of this refusal/delay.`,
  });

  return { ...result.object, wasRefusal: true };
}
