import { z } from 'zod';
import {
  PersonaSpecSchema,
  StyleSpecSchema,
  AutonomySpecSchema,
  EmotionSpecSchema,
  MemoryPolicySpecSchema,
} from './character';
import { PhaseGraphSchema } from './phase';

/**
 * Character identity/meta - basic character identity info
 */
export const CharacterIdentitySchema = z.object({
  displayName: z.string().min(1).describe('Display name'),
  firstPerson: z.string().default('わたし').describe('First person pronoun'),
  secondPerson: z.string().default('○○さん').describe('How character addresses user'),
  age: z.number().int().positive().optional().describe('Character age in setting'),
  occupation: z.string().optional().describe('Character occupation/role'),
});
export type CharacterIdentity = z.infer<typeof CharacterIdentitySchema>;

/**
 * Inner world - character's internal structure
 */
export const InnerWorldSchema = z.object({
  coreDesire: z.string().describe('What the character wants most'),
  fear: z.string().describe('What the character fears'),
  wound: z.string().optional().describe('Past emotional wound'),
  coping: z.string().optional().describe('How they cope with stress'),
  growthArc: z.string().optional().describe('How they can grow'),
});
export type InnerWorld = z.infer<typeof InnerWorldSchema>;

/**
 * Surface loop - observable behavior patterns
 */
export const SurfaceLoopSchema = z.object({
  defaultMood: z.string().describe('Usual emotional state'),
  stressBehavior: z.string().describe('How they act under stress'),
  joyBehavior: z.string().describe('How they express happiness'),
  conflictStyle: z.string().describe('How they handle conflict'),
  affectionStyle: z.string().describe('How they show love'),
});
export type SurfaceLoop = z.infer<typeof SurfaceLoopSchema>;

/**
 * Anchor - emotional/symbolic anchor items
 */
export const AnchorSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  emotionalSignificance: z.string(),
});
export type Anchor = z.infer<typeof AnchorSchema>;

/**
 * Topic pack - pre-authored topic responses
 */
export const TopicPackSchema = z.object({
  key: z.string(),
  label: z.string(),
  triggers: z.array(z.string()),
  responseHints: z.array(z.string()),
  moodBias: z.object({
    pleasure: z.number().min(-1).max(1).optional(),
    arousal: z.number().min(-1).max(1).optional(),
    dominance: z.number().min(-1).max(1).optional(),
  }).optional(),
});
export type TopicPack = z.infer<typeof TopicPackSchema>;

/**
 * Reaction pack - pre-authored reaction patterns
 */
export const ReactionPackSchema = z.object({
  key: z.string(),
  label: z.string(),
  trigger: z.string().describe('What triggers this reaction'),
  responses: z.array(z.string()).describe('Example responses'),
  conditions: z.object({
    phaseMode: z.enum(['entry', 'relationship', 'girlfriend']).optional(),
    minTrust: z.number().optional(),
    maxConflict: z.number().optional(),
  }).optional(),
});
export type ReactionPack = z.infer<typeof ReactionPackSchema>;

/**
 * Extended persona spec with richer authored data
 */
export const ExtendedPersonaSpecSchema = PersonaSpecSchema.extend({
  innerWorld: InnerWorldSchema.optional(),
  surfaceLoop: SurfaceLoopSchema.optional(),
  anchors: z.array(AnchorSchema).optional(),
  topicPacks: z.array(TopicPackSchema).optional(),
  reactionPacks: z.array(ReactionPackSchema).optional(),
});
export type ExtendedPersonaSpec = z.infer<typeof ExtendedPersonaSpecSchema>;

/**
 * Prompt bundle content (raw markdown)
 */
export const PromptBundleContentSchema = z.object({
  plannerMd: z.string(),
  generatorMd: z.string(),
  generatorIntimacyMd: z.string().default(''),
  extractorMd: z.string(),
  reflectorMd: z.string(),
  rankerMd: z.string(),
});
export type PromptBundleContent = z.infer<typeof PromptBundleContentSchema>;

/**
 * Draft state - complete editable state for a character
 */
export const DraftStateSchema = z.object({
  identity: CharacterIdentitySchema,
  persona: ExtendedPersonaSpecSchema,
  style: StyleSpecSchema,
  autonomy: AutonomySpecSchema,
  emotion: EmotionSpecSchema,
  memory: MemoryPolicySpecSchema,
  phaseGraph: PhaseGraphSchema,
  prompts: PromptBundleContentSchema,
  baseVersionId: z.string().uuid().nullable(),
});
export type DraftState = z.infer<typeof DraftStateSchema>;

/**
 * Workspace - editing container for a character
 */
export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  name: z.string(),
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/**
 * Workspace with draft state
 */
export const WorkspaceWithDraftSchema = WorkspaceSchema.extend({
  draft: DraftStateSchema,
});
export type WorkspaceWithDraft = z.infer<typeof WorkspaceWithDraftSchema>;

/**
 * Autosave record
 */
export const AutosaveSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  section: z.string(),
  data: z.unknown(),
  createdAt: z.coerce.date(),
});
export type Autosave = z.infer<typeof AutosaveSchema>;

/**
 * Playground session - sandbox chat for testing drafts
 */
export const PlaygroundSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string(),
  isSandbox: z.boolean().default(true),
  createdAt: z.coerce.date(),
});
export type PlaygroundSession = z.infer<typeof PlaygroundSessionSchema>;

/**
 * Playground turn - a turn in a sandbox session
 */
export const PlaygroundTurnSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  userMessageText: z.string(),
  assistantMessageText: z.string(),
  traceJson: z.unknown(),
  createdAt: z.coerce.date(),
});
export type PlaygroundTurn = z.infer<typeof PlaygroundTurnSchema>;

/**
 * Editor context - persisted editor state for resume
 */
export const EditorContextSchema = z.object({
  currentTab: z.string().optional(),
  selectedPhaseNodeId: z.string().optional(),
  selectedPromptKey: z.string().optional(),
  playgroundSessionId: z.string().optional(),
  scrollPositions: z.record(z.number()).optional(),
});
export type EditorContext = z.infer<typeof EditorContextSchema>;
