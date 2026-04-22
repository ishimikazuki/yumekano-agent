import { z } from 'zod';

/**
 * Dialogue act - atomic conversation action
 */
export const DialogueActSchema = z.enum([
  // Informative acts
  'share_information',
  'ask_question',
  'answer_question',
  'clarify',

  // Relational acts
  'express_affection',
  'express_concern',
  'offer_support',
  'request_support',
  'tease',
  'flirt',

  // Assertive acts
  'agree',
  'disagree',
  'suggest',
  'recommend',
  'refuse',
  'delay',

  // Repair acts
  'repair',
  'apologize',
  'forgive',
  'confront',
  'set_boundary',

  // Continuation acts
  'acknowledge',
  'redirect',
  'continue_topic',
  'change_topic',

  // Introspective acts (T-A: push-pull self-disclosure)
  'self_disclose',
  'show_vulnerability',
]);
export type DialogueAct = z.infer<typeof DialogueActSchema>;

/**
 * Stance - character's current emotional/relational stance
 */
export const StanceSchema = z.enum([
  'warm',
  'playful',
  'neutral',
  'guarded',
  'distant',
  'hurt',
  'angry',
  'conflicted',
  'intimate',
]);
export type Stance = z.infer<typeof StanceSchema>;

/**
 * Memory focus - what memories to emphasize
 */
export const MemoryFocusSchema = z.object({
  emphasize: z.array(z.string()).describe('Memory IDs to emphasize'),
  suppress: z.array(z.string()).describe('Memory IDs to suppress'),
  reason: z.string().describe('Why this focus'),
});
export type MemoryFocus = z.infer<typeof MemoryFocusSchema>;

/**
 * Intimacy decision
 */
export const IntimacyDecisionSchema = z.enum([
  'not_applicable',
  'decline_gracefully',
  'decline_firmly',
  'delay',
  'conditional_accept',
  'accept',
]);
export type IntimacyDecision = z.infer<typeof IntimacyDecisionSchema>;

/**
 * Turn plan - structured output from planner
 */
export const TurnPlanSchema = z.object({
  stance: StanceSchema.describe('Character stance for this turn'),
  primaryActs: z.array(DialogueActSchema).min(1).max(3).describe('Main dialogue acts'),
  secondaryActs: z.array(DialogueActSchema).max(2).describe('Supporting acts'),
  memoryFocus: MemoryFocusSchema.describe('Memory emphasis'),
  phaseTransitionProposal: z.object({
    shouldTransition: z.boolean(),
    targetPhaseId: z.string().nullable(),
    reason: z.string(),
  }).describe('Phase transition proposal'),
  intimacyDecision: IntimacyDecisionSchema.describe('How to handle intimacy if relevant'),
  emotionDeltaIntent: z.object({
    pleasureDelta: z.number().min(-0.5).max(0.5),
    arousalDelta: z.number().min(-0.5).max(0.5),
    dominanceDelta: z.number().min(-0.5).max(0.5),
    reason: z.string(),
  }).describe('Intended emotional shift'),
  mustAvoid: z.array(z.string()).describe('Things to explicitly avoid'),
  plannerReasoning: z.string().describe('Third-person reasoning about what character would do'),
});
export type TurnPlan = z.infer<typeof TurnPlanSchema>;
