import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { CandidateResponse } from '@/mastra/agents/generator';
import type { MemoryExtractionResult } from '@/mastra/agents/memory-extractor';
import { runChatTurn, type ChatTurnDeps } from '@/mastra/workflows/chat-turn';
import {
  resetDraftChatSession,
  runDraftChatTurn,
  type DraftChatTurnDeps,
} from '@/mastra/workflows/draft-chat-turn';
import { createSandboxMemoryStore, type MemoryStore } from '@/mastra/memory/store';
import { getDb } from '@/lib/db/client';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import { workspaceRepo } from '@/lib/repositories';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import { buildPromptBundleVersion } from '@/lib/schemas';
import type {
  Candidate,
  CharacterVersion,
  CoEEvidenceExtractorResult,
  MemoryEvent,
  MemoryFact,
  MemoryObservation,
  OpenThread,
  PairState,
  PromptBundleVersion,
  WorkingMemory,
  WorkspaceWithDraft,
} from '@/lib/schemas';
import { createPlan, createWorkingMemory } from './persona-test-helpers';

type ExtractorSnapshot = {
  phaseId: string;
  trust: number;
  affinity: number;
  openThreadCount: number;
  threadKeys: string[];
  retrievedEventCount: number;
  retrievedFactCount: number;
  relationshipStance: string | null;
  activeTensionSummary: string | null;
  knownCorrections: string[];
  intimacyContextHints: string[];
};

function createRankedCandidates(candidates: CandidateResponse[]): Candidate[] {
  return candidates.map((candidate, index) => ({
    index,
    text: candidate.text,
    toneTags: candidate.toneTags,
    memoryRefsUsed: candidate.memoryRefsUsed,
    riskFlags: candidate.riskFlags,
    scores: {
      personaConsistency: 0.86,
      phaseCompliance: 0.88,
      memoryGrounding: 0.84,
      emotionalCoherence: 0.87,
      autonomy: 0.83,
      naturalness: 0.82,
      overall: 0.89 - index * 0.03,
    },
    rejected: false,
    rejectionReason: null,
  }));
}

function createTurnCandidates(): CandidateResponse[] {
  return [
    {
      text: 'ちゃんと覚えてるよ。続きを話そっか。',
      toneTags: ['warm', 'steady'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    {
      text: 'うん、急がなくていいから少しずつ話そう？',
      toneTags: ['warm', 'careful'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    {
      text: 'ありがと。じゃあ落ち着いて続き決めようか。',
      toneTags: ['grateful', 'collaborative'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
  ];
}

function createExtractionForMessage(message: string): CoEEvidenceExtractorResult {
  if (message.includes('ありがとう')) {
    return {
      interactionActs: [
        {
          act: 'gratitude',
          target: 'character',
          polarity: 'positive',
          intensity: 0.74,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: 'ありがとう',
              start: message.indexOf('ありがとう'),
              end: message.indexOf('ありがとう') + 'ありがとう'.length,
            },
          ],
          confidence: 0.88,
          uncertaintyNotes: [],
        },
        {
          act: 'support',
          target: 'relationship',
          polarity: 'positive',
          intensity: 0.58,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: message,
              start: 0,
              end: message.length,
            },
          ],
          confidence: 0.8,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: 0.72,
        rejectionImpact: -0.14,
        respectImpact: 0.44,
        threatImpact: -0.2,
        pressureImpact: 0.02,
        repairImpact: 0.18,
        reciprocityImpact: 0.52,
        intimacySignal: 0.36,
        boundarySignal: 0.41,
        certainty: 0.86,
      },
      confidence: 0.84,
      uncertaintyNotes: [],
    };
  }

  if (message.includes('急がせない')) {
    return {
      interactionActs: [
        {
          act: 'boundary_respect',
          target: 'boundary',
          polarity: 'positive',
          intensity: 0.52,
          evidenceSpans: [
            {
              source: 'user_message',
              sourceId: null,
              text: '急がせない',
              start: message.indexOf('急がせない'),
              end: message.indexOf('急がせない') + '急がせない'.length,
            },
          ],
          confidence: 0.81,
          uncertaintyNotes: [],
        },
      ],
      relationalAppraisal: {
        warmthImpact: 0.24,
        rejectionImpact: -0.08,
        respectImpact: 0.52,
        threatImpact: -0.22,
        pressureImpact: -0.18,
        repairImpact: 0.28,
        reciprocityImpact: 0.22,
        intimacySignal: 0.18,
        boundarySignal: 0.58,
        certainty: 0.83,
      },
      confidence: 0.81,
      uncertaintyNotes: [],
    };
  }

  return {
    interactionActs: [
      {
        act: 'question',
        target: 'topic',
        polarity: 'neutral',
        intensity: 0.34,
        evidenceSpans: [
          {
            source: 'user_message',
            sourceId: null,
            text: message,
            start: 0,
            end: message.length,
          },
        ],
        confidence: 0.76,
        uncertaintyNotes: [],
      },
    ],
    relationalAppraisal: {
      warmthImpact: 0.08,
      rejectionImpact: 0,
      respectImpact: 0.1,
      threatImpact: 0,
      pressureImpact: 0.04,
      repairImpact: 0,
      reciprocityImpact: 0.06,
      intimacySignal: 0.04,
      boundarySignal: 0.12,
      certainty: 0.74,
    },
    confidence: 0.76,
    uncertaintyNotes: [],
  };
}

function createMemoryExtraction(turnIndex: number): MemoryExtractionResult {
  if (turnIndex === 1) {
    return {
      workingMemoryPatch: {
        relationshipStance: 'warming_up',
        activeTensionSummary: 'ライブ相談の返事待ち',
        addCorrections: ['ライブ相談は急かされると困る'],
        addIntimacyHints: ['ペースを尊重されると安心する'],
      },
      episodicEvents: [
        {
          eventType: 'relationship_positive',
          summary: 'User thanked Seira and suggested continuing the live-show discussion later.',
          salience: 0.82,
          retrievalKeys: ['ありがとう', 'ライブ'],
          emotionSignature: null,
          participants: ['user', 'character'],
        },
      ],
      graphFacts: [
        {
          subject: 'ライブ相談',
          predicate: 'status',
          object: 'pending',
          confidence: 0.9,
          supersedesExisting: false,
        },
      ],
      openThreadUpdates: [
        {
          key: 'live_plan_followup',
          action: 'open',
          summary: 'ライブ相談の続きが保留中',
          severity: 0.66,
        },
      ],
      extractionNotes: 'Opened a follow-up thread for the live-show discussion.',
    };
  }

  if (turnIndex === 2) {
    return {
      workingMemoryPatch: {
        addLikes: ['ライブの感想を共有すること'],
      },
      episodicEvents: [
        {
          eventType: 'relationship_planning',
          summary: 'The live-show discussion continued without pressure.',
          salience: 0.71,
          retrievalKeys: ['ライブ', '相談'],
          emotionSignature: null,
          participants: ['user', 'character'],
        },
      ],
      graphFacts: [],
      openThreadUpdates: [
        {
          key: 'live_plan_followup',
          action: 'update',
          summary: 'ライブ相談はまだ継続中',
          severity: 0.55,
        },
      ],
      extractionNotes: 'Kept the follow-up thread open.',
    };
  }

  return {
    workingMemoryPatch: {
      relationshipStance: 'steadier',
      activeTensionSummary: null,
    },
    episodicEvents: [],
    graphFacts: [],
    openThreadUpdates: [
      {
        key: 'live_plan_followup',
        action: 'resolve',
      },
    ],
    extractionNotes: 'Resolved the outstanding live-plan thread.',
  };
}

type ProgressSnapshot = {
  phaseId: string;
  affinity: number;
  trust: number;
  intimacyReadiness: number;
  conflict: number;
  pad: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
  openThreadCount: number;
};

function applyPairUpdates(pairState: PairState, updates: Record<string, unknown>): PairState {
  return {
    ...pairState,
    activeCharacterVersionId:
      (updates.activeCharacterVersionId as string | undefined) ?? pairState.activeCharacterVersionId,
    activePhaseId: (updates.activePhaseId as string | undefined) ?? pairState.activePhaseId,
    affinity: (updates.affinity as number | undefined) ?? pairState.affinity,
    trust: (updates.trust as number | undefined) ?? pairState.trust,
    intimacyReadiness: (updates.intimacyReadiness as number | undefined) ?? pairState.intimacyReadiness,
    conflict: (updates.conflict as number | undefined) ?? pairState.conflict,
    emotion: (updates.emotion as PairState['emotion'] | undefined) ?? pairState.emotion,
    pad:
      (updates.pad as PairState['pad'] | undefined) ??
      ((updates.emotion as PairState['emotion'] | undefined)?.combined ?? pairState.pad),
    appraisal: (updates.appraisal as PairState['appraisal'] | undefined) ?? pairState.appraisal,
    openThreadCount: (updates.openThreadCount as number | undefined) ?? pairState.openThreadCount,
    lastTransitionAt:
      updates.lastTransitionAt === undefined
        ? pairState.lastTransitionAt
        : ((updates.lastTransitionAt as Date | null) ?? null),
    updatedAt: new Date('2026-03-26T00:00:00.000Z'),
  };
}

function roundSnapshot(snapshot: ProgressSnapshot): ProgressSnapshot {
  return {
    ...snapshot,
    affinity: Number(snapshot.affinity.toFixed(2)),
    trust: Number(snapshot.trust.toFixed(2)),
    intimacyReadiness: Number(snapshot.intimacyReadiness.toFixed(2)),
    conflict: Number(snapshot.conflict.toFixed(2)),
    pad: {
      pleasure: Number(snapshot.pad.pleasure.toFixed(4)),
      arousal: Number(snapshot.pad.arousal.toFixed(4)),
      dominance: Number(snapshot.pad.dominance.toFixed(4)),
    },
  };
}

function toProgressSnapshot(input: {
  phaseId: string;
  state: {
    affinity: number;
    trust: number;
    intimacyReadiness: number;
    conflict: number;
    pad: {
      pleasure: number;
      arousal: number;
      dominance: number;
    };
    openThreadCount: number;
  };
}): ProgressSnapshot {
  return roundSnapshot({
    phaseId: input.phaseId,
    affinity: input.state.affinity,
    trust: input.state.trust,
    intimacyReadiness: input.state.intimacyReadiness,
    conflict: input.state.conflict,
    pad: input.state.pad,
    openThreadCount: input.state.openThreadCount,
  });
}

function createDraftRuntimeArtifacts(workspace: WorkspaceWithDraft): {
  characterVersion: CharacterVersion;
  promptBundle: PromptBundleVersion;
} {
  const characterVersion: CharacterVersion = {
    id: workspace.draft.baseVersionId ?? workspace.characterId,
    characterId: workspace.characterId,
    versionNumber: 1,
    status: 'draft',
    persona: {
      ...workspace.draft.persona,
      compiledPersona: undefined,
    },
    style: workspace.draft.style,
    autonomy: workspace.draft.autonomy,
    emotion: workspace.draft.emotion,
    memory: workspace.draft.memory,
    phaseGraphVersionId: workspace.id,
    promptBundleVersionId: workspace.id,
    createdBy: workspace.createdBy,
    createdAt: workspace.updatedAt,
    label: workspace.name,
    parentVersionId: workspace.draft.baseVersionId,
  };

  const promptBundle = buildPromptBundleVersion({
    id: workspace.id,
    characterId: workspace.characterId,
    versionNumber: 1,
    createdAt: workspace.updatedAt,
    prompts: workspace.draft.prompts,
  });

  return {
    characterVersion,
    promptBundle,
  };
}

function createMemoryStoreFixture(input?: {
  workingMemory?: WorkingMemory;
  facts?: MemoryFact[];
  events?: MemoryEvent[];
  observations?: MemoryObservation[];
  threads?: OpenThread[];
}) {
  const state = {
    workingMemory: input?.workingMemory ?? createWorkingMemory(),
    facts: input?.facts ?? [],
    events: input?.events ?? [],
    observations: input?.observations ?? [],
    threads: input?.threads ?? [],
    memoryUsage: [] as Array<{ turnId: string; memoryItemId: string }>,
  };
  let idCounter = 0;
  const nextId = (prefix: string) =>
    `${prefix}${String(++idCounter).padStart(11, '0')}`.replace(
      /^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/,
      '$1-$2-4$3-8$4-$5'
    );

  const memoryStore: MemoryStore = {
    async getWorkingMemory() {
      return state.workingMemory;
    },
    async setWorkingMemory(_scopeId, data) {
      state.workingMemory = data;
    },
    getDefaultWorkingMemory() {
      return createWorkingMemory();
    },
    async getOpenThreads() {
      return state.threads.filter((thread) => thread.status === 'open');
    },
    async getFacts() {
      return state.facts.filter((fact) => fact.status === 'active');
    },
    async getFactsBySubject(_scopeId, subject) {
      return state.facts.filter((fact) => fact.subject === subject);
    },
    async getEvents(_scopeId, limit = 100) {
      return state.events.slice(-limit);
    },
    async getObservations(_scopeId, limit = 50) {
      return state.observations.slice(-limit);
    },
    async createEvent(input) {
      const event: MemoryEvent = {
        id: nextId('event'),
        pairId: input.scopeId,
        sourceTurnId: input.sourceTurnId,
        eventType: input.eventType,
        summary: input.summary,
        salience: input.salience,
        retrievalKeys: input.retrievalKeys,
        emotionSignature: input.emotionSignature,
        participants: input.participants,
        qualityScore: null,
        supersedesEventId: input.supersedesEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.events.push(event);
      return event;
    },
    async createFact(input) {
      const fact: MemoryFact = {
        id: nextId('fact'),
        pairId: input.scopeId,
        subject: input.subject,
        predicate: input.predicate,
        object: input.object,
        confidence: input.confidence,
        status: 'active',
        supersedesFactId: input.supersedesFactId ?? null,
        sourceEventId: input.sourceEventId ?? null,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.facts.push(fact);
      return fact;
    },
    async createObservation(input) {
      const observation: MemoryObservation = {
        id: nextId('observation'),
        pairId: input.scopeId,
        summary: input.summary,
        retrievalKeys: input.retrievalKeys,
        salience: input.salience,
        qualityScore: null,
        windowStartAt: input.windowStartAt,
        windowEndAt: input.windowEndAt,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.observations.push(observation);
      return observation;
    },
    async createOrUpdateThread(input) {
      const existing = state.threads.find((thread) => thread.key === input.key);
      if (existing) {
        existing.summary = input.summary;
        existing.severity = input.severity;
        existing.status = 'open';
        existing.updatedAt = new Date('2026-03-25T00:00:00.000Z');
        return existing;
      }

      const thread: OpenThread = {
        id: nextId('thread'),
        pairId: input.scopeId,
        key: input.key,
        summary: input.summary,
        severity: input.severity,
        status: 'open',
        openedByEventId: input.openedByEventId ?? null,
        resolvedByEventId: null,
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      };
      state.threads.push(thread);
      return thread;
    },
    async resolveThread(_scopeId, key, resolvedByEventId) {
      const thread = state.threads.find((item) => item.key === key);
      if (thread) {
        thread.status = 'resolved';
        thread.resolvedByEventId = resolvedByEventId ?? null;
      }
    },
    async updateEventQuality() {},
    async updateFactStatus(factId, status) {
      const fact = state.facts.find((item) => item.id === factId);
      if (fact) {
        fact.status = status;
      }
    },
    async updateObservationQuality(observationId, qualityScore) {
      const observation = state.observations.find((item) => item.id === observationId);
      if (observation) {
        observation.qualityScore = qualityScore;
      }
    },
    async createMemoryUsage(input) {
      state.memoryUsage.push({
        turnId: input.turnId,
        memoryItemId: input.memoryItemId,
      });
      return {
        id: nextId('usage'),
        memoryItemType: input.memoryItemType,
        memoryItemId: input.memoryItemId,
        turnId: input.turnId,
        wasSelected: input.wasSelected,
        wasHelpful: input.wasHelpful,
        scoreDelta: input.scoreDelta,
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
      };
    },
  };

  return { memoryStore, state };
}

function createDraftChatDeps(snapshots: ExtractorSnapshot[]): DraftChatTurnDeps {
  let nowCounter = 0;
  let memoryExtractionTurn = 0;

  return {
    executeTurnDeps: {
      now: () => new Date(Date.parse('2026-03-26T00:00:00.000Z') + nowCounter++ * 60_000),
      async runCoEEvidenceExtractor(input) {
        snapshots.push({
          phaseId: input.pairState.activePhaseId,
          trust: input.pairState.trust,
          affinity: input.pairState.affinity,
          openThreadCount: input.pairState.openThreadCount,
          threadKeys: input.openThreads.map((thread) => thread.key),
          retrievedEventCount: input.retrievedMemory.events.length,
          retrievedFactCount: input.retrievedMemory.facts.length,
          relationshipStance: input.workingMemory.relationshipStance,
          activeTensionSummary: input.workingMemory.activeTensionSummary,
          knownCorrections: [...input.workingMemory.knownCorrections],
          intimacyContextHints: [...input.workingMemory.intimacyContextHints],
        });

        return {
          extraction: createExtractionForMessage(input.userMessage),
          modelId: 'mock/coe-extractor',
          systemPromptHash: 'mock-coe-prompt',
        };
      },
      async runPlanner() {
        return {
          plan: createPlan(),
          modelId: 'mock/planner',
          systemPromptHash: 'mock-planner-prompt',
        };
      },
      async runGenerator() {
        return {
          candidates: createTurnCandidates(),
          modelId: 'mock/generator',
          systemPromptHash: 'mock-generator-prompt',
        };
      },
      async runRanker(input) {
        return {
          winnerIndex: 0,
          candidates: createRankedCandidates(input.candidates),
          globalNotes: 'mock ranker',
          modelId: 'mock/ranker',
          systemPromptHash: 'mock-ranker-prompt',
        };
      },
      async runMemoryExtractor() {
        memoryExtractionTurn += 1;
        return {
          extraction: createMemoryExtraction(memoryExtractionTurn),
          modelId: 'mock/memory-extractor',
          systemPromptHash: 'mock-memory-prompt',
        };
      },
    },
  };
}

async function setupDraftWorkspace() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-draft-chat-'));
  const dbPath = path.join(tempDir, 'draft-chat.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  const cleanup = async () => {
    await getDb().close();

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousLocalDatabaseUrl === undefined) {
      delete process.env.LOCAL_DATABASE_URL;
    } else {
      process.env.LOCAL_DATABASE_URL = previousLocalDatabaseUrl;
    }

    rmSync(tempDir, { recursive: true, force: true });
  };

  const db = getDb();
  await createDraftChatTestSchema(db);
  await db.execute({
    sql: `INSERT INTO characters (id, slug, display_name) VALUES (?, ?, ?)`,
    args: [
      '22222222-2222-4222-8222-222222222222',
      'seira-test',
      '蒼井セイラ',
    ],
  });

  const workspace = await workspaceRepo.create({
    characterId: '22222222-2222-4222-8222-222222222222',
    name: 'Seira sandbox',
    createdBy: 'tester',
  });

  await workspaceRepo.initDraft(workspace.id, createSeiraDraftState());

  return {
    workspace,
    cleanup,
  };
}

async function createDraftChatTestSchema(db: ReturnType<typeof getDb>) {
  const statements = [
    `CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE character_workspaces (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL REFERENCES characters(id),
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE workspace_draft_state (
      workspace_id TEXT PRIMARY KEY REFERENCES character_workspaces(id),
      identity_json TEXT NOT NULL,
      persona_json TEXT NOT NULL,
      style_json TEXT NOT NULL,
      autonomy_json TEXT NOT NULL,
      emotion_json TEXT NOT NULL,
      memory_policy_json TEXT NOT NULL,
      phase_graph_json TEXT NOT NULL,
      planner_md TEXT NOT NULL,
      generator_md TEXT NOT NULL,
      generator_intimacy_md TEXT NOT NULL DEFAULT '',
      emotion_appraiser_md TEXT NOT NULL DEFAULT '',
      extractor_md TEXT NOT NULL,
      reflector_md TEXT NOT NULL,
      ranker_md TEXT NOT NULL,
      base_version_id TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE playground_sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES character_workspaces(id),
      user_id TEXT NOT NULL,
      is_sandbox INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE playground_turns (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      user_message_text TEXT NOT NULL,
      assistant_message_text TEXT NOT NULL,
      trace_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_pair_state (
      session_id TEXT PRIMARY KEY REFERENCES playground_sessions(id),
      active_phase_id TEXT NOT NULL,
      affinity REAL NOT NULL,
      trust REAL NOT NULL,
      intimacy_readiness REAL NOT NULL,
      conflict REAL NOT NULL,
      pad_json TEXT NOT NULL,
      pad_fast_json TEXT,
      pad_slow_json TEXT,
      pad_combined_json TEXT,
      last_emotion_updated_at TEXT,
      appraisal_json TEXT NOT NULL,
      open_thread_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_working_memory (
      session_id TEXT PRIMARY KEY REFERENCES playground_sessions(id),
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_memory_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      source_turn_id TEXT REFERENCES playground_turns(id),
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      salience REAL NOT NULL,
      retrieval_keys_json TEXT NOT NULL,
      emotion_signature_json TEXT,
      participants_json TEXT NOT NULL,
      quality_score REAL,
      supersedes_event_id TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_memory_facts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL,
      supersedes_fact_id TEXT,
      source_event_id TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_memory_observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      summary TEXT NOT NULL,
      retrieval_keys_json TEXT NOT NULL,
      salience REAL NOT NULL,
      quality_score REAL,
      window_start_at TEXT NOT NULL,
      window_end_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE sandbox_memory_open_threads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      key TEXT NOT NULL,
      summary TEXT NOT NULL,
      severity REAL NOT NULL,
      status TEXT NOT NULL,
      opened_by_event_id TEXT,
      resolved_by_event_id TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(session_id, key)
    )`,
    `CREATE TABLE sandbox_memory_usage (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES playground_sessions(id),
      memory_item_type TEXT NOT NULL,
      memory_item_id TEXT NOT NULL,
      turn_id TEXT NOT NULL REFERENCES playground_turns(id),
      was_selected INTEGER NOT NULL,
      was_helpful INTEGER,
      score_delta REAL,
      created_at TEXT NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await db.execute(statement);
  }
}

test('runDraftChatTurn resumes the latest sandbox session and carries state across three turns', async () => {
  const { workspace, cleanup } = await setupDraftWorkspace();
  const snapshots: ExtractorSnapshot[] = [];

  try {
    const deps = createDraftChatDeps(snapshots);
    const userId = 'sandbox-user';

    const first = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: '落とし物届けてくれてありがとう。今度ライブの相談もしたい',
      },
      deps
    );

    const second = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: 'この前のライブ相談、続きをしてもいい？',
      },
      deps
    );

    const third = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: 'ライブ相談の件、急がせないからまた今度で大丈夫だよ',
      },
      deps
    );

    assert.equal(first.phaseId, 'cafe_thank_you');
    assert.equal(second.sessionId, first.sessionId);
    assert.equal(third.sessionId, first.sessionId);

    assert.equal(snapshots.length, 3);
    assert.equal(snapshots[1]?.phaseId, 'cafe_thank_you');
    assert.ok((snapshots[1]?.trust ?? 0) > 50);
    assert.equal(snapshots[1]?.openThreadCount, 1);
    assert.deepStrictEqual(snapshots[1]?.threadKeys, ['live_plan_followup']);
    assert.equal(snapshots[1]?.relationshipStance, 'warming_up');
    assert.equal(snapshots[1]?.activeTensionSummary, 'ライブ相談の返事待ち');
    assert.deepStrictEqual(snapshots[1]?.knownCorrections, ['ライブ相談は急かされると困る']);
    assert.deepStrictEqual(snapshots[1]?.intimacyContextHints, ['ペースを尊重されると安心する']);
    assert.ok((snapshots[1]?.retrievedEventCount ?? 0) >= 1);
    assert.ok((snapshots[1]?.retrievedFactCount ?? 0) >= 1);

    assert.equal(snapshots[2]?.phaseId, 'cafe_thank_you');
    assert.equal(snapshots[2]?.openThreadCount, 1);

    const persistedState = await workspaceRepo.getSandboxPairState(first.sessionId);
    const persistedMemory = await workspaceRepo.getSandboxWorkingMemory(first.sessionId);
    const remainingThreads = await workspaceRepo.getSandboxOpenThreads(first.sessionId);
    const turns = await workspaceRepo.getTurns(first.sessionId);

    assert.ok(persistedState);
    assert.equal(persistedState?.activePhaseId, 'cafe_thank_you');
    assert.ok((persistedState?.trust ?? 0) > 50);
    assert.equal(persistedState?.openThreadCount, 0);
    assert.ok(persistedMemory);
    assert.equal(persistedMemory?.relationshipStance, 'steadier');
    assert.ok(
      persistedMemory?.knownLikes.includes('ライブの感想を共有すること'),
      'working memory should keep likes learned in the sandbox session'
    );
    assert.deepStrictEqual(remainingThreads, []);
    assert.equal(turns.length, 3);
  } finally {
    await cleanup();
  }
});

test('resetDraftChatSession explicitly clears sandbox carry-over so the next turn starts from baseline', async () => {
  const { workspace, cleanup } = await setupDraftWorkspace();
  const snapshots: ExtractorSnapshot[] = [];

  try {
    const deps = createDraftChatDeps(snapshots);
    const userId = 'sandbox-user';

    const first = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: '落とし物届けてくれてありがとう。今度ライブの相談もしたい',
      },
      deps
    );

    const resetResult = await resetDraftChatSession({
      workspaceId: workspace.id,
      userId,
      sessionId: first.sessionId,
    });

    assert.deepStrictEqual(resetResult, {
      deleted: true,
      sessionId: first.sessionId,
    });
    assert.equal(await workspaceRepo.getSession(first.sessionId), null);
    assert.equal(await workspaceRepo.getSandboxPairState(first.sessionId), null);
    assert.equal(await workspaceRepo.getSandboxWorkingMemory(first.sessionId), null);
    assert.deepStrictEqual(await workspaceRepo.getSandboxOpenThreads(first.sessionId), []);
    assert.deepStrictEqual(await workspaceRepo.getTurns(first.sessionId), []);

    const afterReset = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: 'こんにちは、今日はどうしてた？',
      },
      deps
    );

    assert.notEqual(afterReset.sessionId, first.sessionId);
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[1]?.phaseId, 'station_meeting');
    assert.equal(snapshots[1]?.trust, 50);
    assert.equal(snapshots[1]?.affinity, 50);
    assert.equal(snapshots[1]?.openThreadCount, 0);
    assert.deepStrictEqual(snapshots[1]?.threadKeys, []);
    assert.equal(snapshots[1]?.relationshipStance, null);
    assert.equal(snapshots[1]?.activeTensionSummary, null);
    assert.deepStrictEqual(snapshots[1]?.knownCorrections, []);
    assert.deepStrictEqual(snapshots[1]?.intimacyContextHints, []);
  } finally {
    await cleanup();
  }
});

test('sandbox and production show equivalent state progression for the same fixture sequence with isolated stores', async () => {
  const { workspace, cleanup } = await setupDraftWorkspace();
  const userId = 'parity-user';
  const messages = [
    '落とし物届けてくれてありがとう。今度ライブの相談もしたい',
    'この前のライブ相談、続きをしてもいい？',
    'ライブ相談の件、急がせないからまた今度で大丈夫だよ',
  ];
  const sandboxSnapshots: ProgressSnapshot[] = [];
  const productionSnapshots: ProgressSnapshot[] = [];

  try {
    const workspaceWithDraft = await workspaceRepo.getWithDraft(workspace.id);
    if (!workspaceWithDraft) {
      throw new Error('workspace draft should exist for parity test');
    }
    const { characterVersion, promptBundle } = createDraftRuntimeArtifacts(workspaceWithDraft);

    // Keep sandbox and production memory scopes isolated while sharing the same draft fixture.
    const sandboxSession = await workspaceRepo.createSession({
      workspaceId: workspace.id,
      userId,
    });
    const productionMemorySession = await workspaceRepo.createSession({
      workspaceId: workspace.id,
      userId: `${userId}-production`,
    });

    const sandboxDeps = createDraftChatDeps([]);
    const productionExecuteTurnDeps = createDraftChatDeps([]).executeTurnDeps;
    const defaultSandboxWorkingMemory = workspaceRepo.getDefaultSandboxWorkingMemory();
    const { memoryStore: productionMemoryStore, state: productionMemoryState } = createMemoryStoreFixture({
      workingMemory: defaultSandboxWorkingMemory,
    });
    let productionTurnCounter = 0;
    const productionNowBase = Date.parse('2026-03-26T00:00:00.000Z');
    let currentProductionNow = new Date(productionNowBase);
    const productionTurns: Array<{
      userMessageText: string;
      assistantMessageText: string;
      createdAt: Date;
    }> = [];
    let productionPairState: PairState = {
      pairId: productionMemorySession.id,
      activeCharacterVersionId: characterVersion.id,
      activePhaseId: workspaceWithDraft.draft.phaseGraph.entryPhaseId,
      affinity: 50,
      trust: 50,
      intimacyReadiness: 0,
      conflict: 0,
      emotion: createRuntimeEmotionState(
        workspaceWithDraft.draft.emotion.baselinePAD,
        sandboxSession.createdAt
      ),
      pad: workspaceWithDraft.draft.emotion.baselinePAD,
      appraisal: {
        goalCongruence: 0,
        controllability: 0.5,
        certainty: 0.5,
        normAlignment: 0,
        attachmentSecurity: 0.5,
        reciprocity: 0,
        pressureIntrusiveness: 0,
        novelty: 0.5,
        selfRelevance: 0.5,
      },
      openThreadCount: 0,
      lastTransitionAt: null,
      updatedAt: sandboxSession.createdAt,
    };
    const productionPair = {
      id: productionPairState.pairId,
      userId,
      characterId: workspaceWithDraft.characterId,
      canonicalThreadId: 'production-thread',
      createdAt: sandboxSession.createdAt,
    };

    const productionDeps: ChatTurnDeps = {
      now: () => {
        currentProductionNow = new Date(productionNowBase + productionTurnCounter * 60_000);
        productionTurnCounter += 1;
        return currentProductionNow;
      },
      repos: {
        pairRepo: {
          async getOrCreate() {
            return productionPair;
          },
          async getState() {
            return productionPairState;
          },
          async initState() {
            throw new Error('production parity test should not call initState');
          },
          async updateState(_pairId, updates) {
            productionPairState = applyPairUpdates(productionPairState, updates as Record<string, unknown>);
          },
        },
        traceRepo: {
          async getRecentTurns(_pairId, limit = 10) {
            return productionTurns.slice(-limit);
          },
          async countTurnsSince(_pairId, since) {
            if (!since) {
              return productionTurns.length;
            }
            return productionTurns.filter((turn) => turn.createdAt > since).length;
          },
          async createChatTurn(input) {
            productionTurns.push({
              userMessageText: input.userMessageText,
              assistantMessageText: input.assistantMessageText,
              createdAt: new Date(),
            });
          },
          async createTrace() {},
        },
        characterRepo: {
          async getVersionById() {
            throw new Error('production parity test uses characterVersion override');
          },
        },
        releaseRepo: {
          async getCurrent() {
            throw new Error('production parity test uses characterVersion override');
          },
        },
        phaseGraphRepo: {
          async getById() {
            throw new Error('production parity test uses phaseGraph override');
          },
        },
        promptBundleRepo: {
          async getById() {
            throw new Error('production parity test uses promptBundle override');
          },
        },
      },
      createMemoryStore: () => productionMemoryStore,
      executeTurnDeps: productionExecuteTurnDeps,
    };

    for (const message of messages) {
      const sandboxResult = await runDraftChatTurn(
        {
          workspaceId: workspace.id,
          sessionId: sandboxSession.id,
          userId,
          message,
        },
        sandboxDeps
      );
      const sandboxState = await workspaceRepo.getSandboxPairState(sandboxSession.id);
      if (!sandboxState) {
        throw new Error('sandbox pair state should exist after draft turn');
      }
      sandboxSnapshots.push(
        toProgressSnapshot({
          phaseId: sandboxResult.phaseId,
          state: sandboxState,
        })
      );

      const productionResult = await runChatTurn(
        {
          userId,
          characterId: workspaceWithDraft.characterId,
          message,
          characterVersionOverride: characterVersion,
          phaseGraphOverride: workspaceWithDraft.draft.phaseGraph,
          promptBundleOverride: promptBundle,
        },
        productionDeps
      );
      productionSnapshots.push(
        toProgressSnapshot({
          phaseId: productionResult.phaseId,
          state: productionPairState,
        })
      );
    }

    assert.deepStrictEqual(
      sandboxSnapshots,
      productionSnapshots,
      'sandbox and production should share equivalent phase/PAD/pair progression for the same sequence'
    );

    // Explicitly verify isolation: sandbox and production memory scopes are distinct.
    const sandboxMemory = await workspaceRepo.getSandboxWorkingMemory(sandboxSession.id);
    const leakedProductionSandboxMemory = await workspaceRepo.getSandboxWorkingMemory(
      productionMemorySession.id
    );
    assert.ok(sandboxMemory);
    assert.equal(leakedProductionSandboxMemory, null);
    assert.ok(productionMemoryState.workingMemory.knownLikes.includes('ライブの感想を共有すること'));
    assert.notEqual(sandboxSession.id, productionMemorySession.id);
  } finally {
    await cleanup();
  }
});
