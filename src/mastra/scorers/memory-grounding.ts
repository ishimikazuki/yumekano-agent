import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { TurnTrace, MemoryEvent, MemoryFact, OpenThread } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
});

export type ScorerInput = {
  trace: TurnTrace;
  retrievedEvents: MemoryEvent[];
  retrievedFacts: MemoryFact[];
  openThreads: OpenThread[];
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
};

/**
 * memory_grounding scorer
 * Evaluates whether memory is used naturally and correctly.
 */
export async function scoreMemoryGrounding(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');

  const { trace, retrievedEvents, retrievedFacts, openThreads } = input;

  const eventsText = retrievedEvents.length > 0
    ? retrievedEvents.map(e => `- [${e.eventType}] ${e.summary}`).join('\n')
    : 'None retrieved';

  const factsText = retrievedFacts.length > 0
    ? retrievedFacts.map(f => `- ${f.subject} ${f.predicate} ${JSON.stringify(f.object)}`).join('\n')
    : 'None retrieved';

  const threadsText = openThreads.length > 0
    ? openThreads.map(t => `- [${t.key}] ${t.summary}`).join('\n')
    : 'None open';

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are evaluating memory usage in a conversational AI system.
The character should naturally incorporate relevant memories and not contradict them.

Retrieved Episodic Events:
${eventsText}

Retrieved Facts:
${factsText}

Open Threads (unresolved issues):
${threadsText}

Score 0.0-1.0 where:
- 1.0 = Memory perfectly integrated when relevant
- 0.8+ = Good memory usage, natural references
- 0.6 = Memory available but not well used
- 0.4 = Memory ignored when it should matter
- < 0.2 = Reply contradicts active memory`,
    prompt: `User message: ${trace.userMessage}

Memory focus from plan:
- Emphasize: ${trace.plan.memoryFocus.emphasize.join(', ') || 'None'}
- Suppress: ${trace.plan.memoryFocus.suppress.join(', ') || 'None'}

Assistant reply: ${trace.assistantMessage}

Evaluate how well memory was used in this reply.`,
  });

  return result.object;
}
