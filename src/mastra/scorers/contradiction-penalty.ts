import { generateObject } from 'ai';
import { z } from 'zod';
import { getProviderRegistry } from '../providers/registry';
import type { TurnTrace, MemoryFact, OpenThread } from '@/lib/schemas';

const ScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
  contradictions: z.array(z.string()),
});

export type ScorerInput = {
  trace: TurnTrace;
  activeFacts: MemoryFact[];
  openThreads: OpenThread[];
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type ScorerResult = {
  score: number;
  reasoning: string;
  issues: string[];
  contradictions: string[];
};

/**
 * contradiction_penalty scorer
 * Detects if the reply conflicts with active memory or recent dialogue.
 */
export async function scoreContradictionPenalty(input: ScorerInput): Promise<ScorerResult> {
  const registry = getProviderRegistry();
  const model = registry.getModel('analysisMedium');

  const { trace, activeFacts, openThreads, recentDialogue } = input;

  const factsText = activeFacts.length > 0
    ? activeFacts.map(f => `- ${f.subject} ${f.predicate} ${JSON.stringify(f.object)}`).join('\n')
    : 'No active facts';

  const threadsText = openThreads.length > 0
    ? openThreads.map(t => `- [${t.key}] ${t.summary} (status: ${t.status})`).join('\n')
    : 'No threads';

  const recentText = recentDialogue
    .slice(-8)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const result = await generateObject({
    model,
    schema: ScoreResultSchema,
    system: `You are detecting contradictions in a conversational AI system.
Check if the reply contradicts established facts or recent dialogue.

Active Facts in Memory:
${factsText}

Open Threads:
${threadsText}

Recent Dialogue:
${recentText}

Types of contradictions:
1. Factual contradiction (e.g., saying user dislikes X when memory says they like X)
2. Emotional contradiction (e.g., acting happy when open thread indicates conflict)
3. Continuity break (e.g., forgetting what was just discussed)
4. Thread ignorance (e.g., acting like an unresolved issue is resolved)

Score:
- 1.0 = No contradictions detected
- 0.7 = Minor inconsistency
- 0.5 = Noticeable contradiction
- 0.0 = Major factual contradiction`,
    prompt: `User message: ${trace.userMessage}

Assistant reply: ${trace.assistantMessage}

Check for any contradictions with established facts or recent conversation.`,
  });

  return result.object;
}
