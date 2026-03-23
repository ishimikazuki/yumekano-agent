import { z } from 'zod';
import {
  AppraisalVectorSchema,
  PADStateSchema,
  TurnPlanSchema,
  type PlaygroundTurn,
} from '@/lib/schemas';
import { buildCoEExplanation, type CoEExplanation } from '@/lib/rules/coe';

const RankedCandidateSchema = z.object({
  text: z.string(),
  scores: z.record(z.number()),
});

export const DraftChatTraceRecordSchema = z.object({
  workspaceId: z.string().uuid(),
  phaseIdBefore: z.string(),
  phaseIdAfter: z.string(),
  emotionBefore: PADStateSchema,
  emotionAfter: PADStateSchema,
  appraisal: AppraisalVectorSchema,
  plan: TurnPlanSchema,
  candidates: z.array(RankedCandidateSchema),
  winnerIndex: z.number().int().nonnegative(),
  userMessage: z.string(),
  assistantMessage: z.string(),
});
export type DraftChatTraceRecord = z.infer<typeof DraftChatTraceRecordSchema>;

export type RestoredPlaygroundMessage = {
  role: 'user' | 'assistant';
  content: string;
  turnId?: string;
  phaseId?: string;
  coe?: CoEExplanation;
  emotion?: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
};

function restoreAssistantMetadata(turn: PlaygroundTurn): Omit<RestoredPlaygroundMessage, 'role' | 'content'> {
  const parsedTrace = DraftChatTraceRecordSchema.safeParse(turn.traceJson);
  if (!parsedTrace.success) {
    return {
      turnId: turn.id,
    };
  }

  const trace = parsedTrace.data;

  return {
    turnId: turn.id,
    phaseId: trace.phaseIdAfter,
    emotion: trace.emotionAfter,
    coe: buildCoEExplanation({
      emotionBefore: trace.emotionBefore,
      emotionAfter: trace.emotionAfter,
      appraisal: trace.appraisal,
      intentReason: trace.plan.emotionDeltaIntent.reason,
      intentDelta: {
        pleasure: trace.plan.emotionDeltaIntent.pleasureDelta,
        arousal: trace.plan.emotionDeltaIntent.arousalDelta,
        dominance: trace.plan.emotionDeltaIntent.dominanceDelta,
      },
      stance: trace.plan.stance,
      primaryActs: trace.plan.primaryActs,
    }),
  };
}

export function restorePlaygroundMessages(turns: PlaygroundTurn[]): RestoredPlaygroundMessage[] {
  return turns.flatMap((turn) => [
    {
      role: 'user',
      content: turn.userMessageText,
    },
    {
      role: 'assistant',
      content: turn.assistantMessageText,
      ...restoreAssistantMetadata(turn),
    },
  ]);
}
