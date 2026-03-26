import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { CandidateResponse } from '@/mastra/agents/generator';
import type { MemoryExtractionResult } from '@/mastra/agents/memory-extractor';
import {
  resetDraftChatSession,
  runDraftChatTurn,
  type DraftChatTurnDeps,
} from '@/mastra/workflows/draft-chat-turn';
import { getDb } from '@/lib/db/client';
import { createSeiraDraftState } from '@/lib/db/seed-seira';
import { workspaceRepo } from '@/lib/repositories';
import type {
  Candidate,
  CoEEvidenceExtractorResult,
} from '@/lib/schemas';
import { createPlan } from './persona-test-helpers';

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
