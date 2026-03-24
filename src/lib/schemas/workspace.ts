import { z } from 'zod';
import {
  PersonaAuthoringSchema,
  StyleSpecSchema,
  AutonomySpecSchema,
  EmotionSpecSchema,
  MemoryPolicySpecSchema,
  InnerWorldSchema,
  SurfaceLoopSchema,
  AnchorSchema,
  TopicPackSchema,
  ReactionPackSchema,
  type PersonaAuthoring,
  type InnerWorld,
  type SurfaceLoop,
  type Anchor,
  type TopicPack,
  type ReactionPack,
} from './character';
import { PhaseGraphSchema } from './phase';
import {
  AppraisalVectorSchema,
  PADStateSchema,
  RuntimeEmotionStateSchema,
} from './trace';
import { PromptFragmentSchema } from './prompts';

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
 * Prompt bundle content (raw markdown)
 */
export const PromptBundleContentSchema = z.object({
  plannerMd: PromptFragmentSchema,
  generatorMd: PromptFragmentSchema,
  generatorIntimacyMd: PromptFragmentSchema,
  extractorMd: PromptFragmentSchema,
  reflectorMd: PromptFragmentSchema,
  rankerMd: PromptFragmentSchema,
});
export type PromptBundleContent = z.infer<typeof PromptBundleContentSchema>;

/**
 * Draft state - complete editable state for a character
 */
export const DraftStateSchema = z.object({
  identity: CharacterIdentitySchema,
  persona: PersonaAuthoringSchema,
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
 * Persisted sandbox pair state for a playground session
 */
export const SandboxPairStateSchema = z.object({
  sessionId: z.string().uuid(),
  activePhaseId: z.string(),
  affinity: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  intimacyReadiness: z.number().min(0).max(100),
  conflict: z.number().min(0).max(100),
  emotion: RuntimeEmotionStateSchema,
  pad: PADStateSchema,
  appraisal: AppraisalVectorSchema,
  openThreadCount: z.number().int().min(0),
  updatedAt: z.coerce.date(),
});
export type SandboxPairState = z.infer<typeof SandboxPairStateSchema>;

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

export const WorkspacePersonaSchema = PersonaAuthoringSchema;
export type WorkspacePersona = PersonaAuthoring;
