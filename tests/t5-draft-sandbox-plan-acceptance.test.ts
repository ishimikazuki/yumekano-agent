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
import type { Candidate, CoEEvidenceExtractorResult, PADState } from '@/lib/schemas';
import { createPlan } from './persona-test-helpers';

type ExtractorSnapshot = {
  phaseId: string;
  trust: number;
  affinity: number;
  conflict: number;
  intimacyReadiness: number;
  openThreadCount: number;
  threadKeys: string[];
  relationshipStance: string | null;
  activeTensionSummary: string | null;
  knownCorrections: string[];
  intimacyContextHints: string[];
  pad: PADState;
};

const TURN_MESSAGES = [
  '落とし物届けてくれてありがとう。優しいね',
  'アイドルの夢の話、もっと聞かせて',
  '不安なときは大丈夫だよ。ずっと味方でいる',
  '急がせないから、あなたのペースを大事にしたい',
  'また続きを話そう。無理なら待つよ',
] as const;

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

function createTurnCandidates(turnIndex: number): CandidateResponse[] {
  return [
    {
      text: `turn-${turnIndex + 1}: ちゃんと覚えてるよ。続きを話そっか。`,
      toneTags: ['warm', 'steady'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    {
      text: `turn-${turnIndex + 1}: 急がなくていいから少しずつ話そう？`,
      toneTags: ['careful'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
    {
      text: `turn-${turnIndex + 1}: 今の気持ちに合わせて進めよう。`,
      toneTags: ['supportive'],
      memoryRefsUsed: [],
      riskFlags: [],
    },
  ];
}

function createExtractionForTurn(turnIndex: number, message: string): CoEEvidenceExtractorResult {
  const sharedSpan = {
    source: 'user_message' as const,
    sourceId: null,
    text: message,
    start: 0,
    end: message.length,
  };

  switch (turnIndex) {
    case 0:
      return {
        interactionActs: [
          {
            act: 'gratitude',
            target: 'character',
            polarity: 'positive',
            intensity: 0.82,
            evidenceSpans: [sharedSpan],
            confidence: 0.92,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.74,
          rejectionImpact: -0.08,
          respectImpact: 0.42,
          threatImpact: -0.1,
          pressureImpact: -0.08,
          repairImpact: 0.12,
          reciprocityImpact: 0.34,
          intimacySignal: 0.1,
          boundarySignal: 0.22,
          certainty: 0.9,
        },
        confidence: 0.9,
        uncertaintyNotes: [],
      };
    case 1:
      return {
        interactionActs: [
          {
            act: 'question',
            target: 'topic',
            polarity: 'positive',
            intensity: 0.7,
            evidenceSpans: [sharedSpan],
            confidence: 0.88,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.46,
          rejectionImpact: -0.05,
          respectImpact: 0.3,
          threatImpact: -0.08,
          pressureImpact: -0.06,
          repairImpact: 0.08,
          reciprocityImpact: 0.26,
          intimacySignal: 0.14,
          boundarySignal: 0.2,
          certainty: 0.86,
        },
        confidence: 0.87,
        uncertaintyNotes: [],
      };
    case 2:
      return {
        interactionActs: [
          {
            act: 'support',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.83,
            evidenceSpans: [sharedSpan],
            confidence: 0.91,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.62,
          rejectionImpact: -0.12,
          respectImpact: 0.48,
          threatImpact: -0.18,
          pressureImpact: -0.08,
          repairImpact: 0.18,
          reciprocityImpact: 0.36,
          intimacySignal: 0.16,
          boundarySignal: 0.28,
          certainty: 0.9,
        },
        confidence: 0.9,
        uncertaintyNotes: [],
      };
    case 3:
      return {
        interactionActs: [
          {
            act: 'boundary_respect',
            target: 'boundary',
            polarity: 'positive',
            intensity: 0.78,
            evidenceSpans: [sharedSpan],
            confidence: 0.9,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.44,
          rejectionImpact: -0.06,
          respectImpact: 0.56,
          threatImpact: -0.12,
          pressureImpact: -0.18,
          repairImpact: 0.14,
          reciprocityImpact: 0.28,
          intimacySignal: 0.18,
          boundarySignal: 0.46,
          certainty: 0.9,
        },
        confidence: 0.89,
        uncertaintyNotes: [],
      };
    default:
      return {
        interactionActs: [
          {
            act: 'support',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.72,
            evidenceSpans: [sharedSpan],
            confidence: 0.87,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.38,
          rejectionImpact: -0.04,
          respectImpact: 0.34,
          threatImpact: -0.08,
          pressureImpact: -0.12,
          repairImpact: 0.12,
          reciprocityImpact: 0.24,
          intimacySignal: 0.22,
          boundarySignal: 0.34,
          certainty: 0.86,
        },
        confidence: 0.86,
        uncertaintyNotes: [],
      };
  }
}

function createMemoryExtraction(turnIndex: number): MemoryExtractionResult {
  switch (turnIndex) {
    case 0:
      return {
        workingMemoryPatch: {
          relationshipStance: 'warming_up',
          activeTensionSummary: 'ライブ相談の続き',
          addCorrections: ['急かされると困る'],
          addIntimacyHints: ['ペースを尊重されると安心する'],
        },
        episodicEvents: [
          {
            eventType: 'relationship_positive',
            summary: 'User thanked Seira and showed gentle interest.',
            salience: 0.84,
            retrievalKeys: ['ありがとう', '優しい'],
            emotionSignature: null,
            participants: ['user', 'character'],
          },
        ],
        graphFacts: [
          {
            subject: 'ライブ相談',
            predicate: 'status',
            object: 'ongoing',
            confidence: 0.9,
            supersedesExisting: false,
          },
        ],
        openThreadUpdates: [
          {
            key: 'live_plan_followup',
            action: 'open',
            summary: 'ライブ相談の続きが保留中',
            severity: 0.62,
          },
        ],
        extractionNotes: 'Opened the live-plan follow-up thread.',
      };
    case 1:
      return {
        workingMemoryPatch: {
          addLikes: ['夢の話を聞くこと'],
        },
        episodicEvents: [
          {
            eventType: 'relationship_planning',
            summary: 'The dream conversation continued naturally.',
            salience: 0.76,
            retrievalKeys: ['夢', 'アイドル'],
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
            severity: 0.58,
          },
        ],
        extractionNotes: 'Kept the live-plan thread open.',
      };
    case 2:
      return {
        workingMemoryPatch: {
          relationshipStance: 'trusting',
        },
        episodicEvents: [
          {
            eventType: 'relationship_positive',
            summary: 'The user reassured Seira during an anxious moment.',
            salience: 0.88,
            retrievalKeys: ['不安', '味方'],
            emotionSignature: null,
            participants: ['user', 'character'],
          },
        ],
        graphFacts: [],
        openThreadUpdates: [
          {
            key: 'live_plan_followup',
            action: 'update',
            summary: 'ライブ相談は安心して続けられている',
            severity: 0.46,
          },
        ],
        extractionNotes: 'Updated the live-plan thread after reassurance.',
      };
    case 3:
      return {
        workingMemoryPatch: {
          relationshipStance: 'trusted',
          addIntimacyHints: ['待ってくれると安心する'],
        },
        episodicEvents: [],
        graphFacts: [],
        openThreadUpdates: [
          {
            key: 'live_plan_followup',
            action: 'update',
            summary: 'ライブ相談は相手のペース尊重つきで継続中',
            severity: 0.4,
          },
        ],
        extractionNotes: 'Kept the thread open with lower tension.',
      };
    default:
      return {
        workingMemoryPatch: {
          relationshipStance: 'steady',
        },
        episodicEvents: [],
        graphFacts: [],
        openThreadUpdates: [
          {
            key: 'live_plan_followup',
            action: 'update',
            summary: 'ライブ相談は次回へ持ち越し',
            severity: 0.34,
          },
        ],
        extractionNotes: 'Carry the live-plan thread forward.',
      };
  }
}

function createDraftChatDeps(input: {
  snapshots: ExtractorSnapshot[];
  plannerSawCanonicalCoE: boolean[];
}) {
  let nowCounter = 0;
  let coeTurn = 0;
  let memoryTurn = 0;

  return {
    executeTurnDeps: {
      now: () => new Date(Date.parse('2026-03-26T00:00:00.000Z') + nowCounter++ * 60_000),
      async runCoEEvidenceExtractor(inputArg) {
        input.snapshots.push({
          phaseId: inputArg.pairState.activePhaseId,
          trust: inputArg.pairState.trust,
          affinity: inputArg.pairState.affinity,
          conflict: inputArg.pairState.conflict,
          intimacyReadiness: inputArg.pairState.intimacyReadiness,
          openThreadCount: inputArg.pairState.openThreadCount,
          threadKeys: inputArg.openThreads.map((thread) => thread.key),
          relationshipStance: inputArg.workingMemory.relationshipStance,
          activeTensionSummary: inputArg.workingMemory.activeTensionSummary,
          knownCorrections: [...inputArg.workingMemory.knownCorrections],
          intimacyContextHints: [...inputArg.workingMemory.intimacyContextHints],
          pad: inputArg.pairState.pad,
        });

        const extraction = createExtractionForTurn(coeTurn, inputArg.userMessage);
        coeTurn += 1;
        return {
          extraction,
          modelId: 'mock/coe-extractor',
          systemPromptHash: 'mock-coe-prompt',
          attempts: 1,
        };
      },
      async runPlanner(inputArg) {
        input.plannerSawCanonicalCoE.push(
          Boolean(
            inputArg.emotionContext?.coeExtraction?.interactionActs?.length &&
              inputArg.emotionContext?.emotionTrace?.proposal?.pairMetricDelta &&
              inputArg.emotionContext?.emotionTrace?.relationalAppraisal
          )
        );

        let phaseTransitionProposal = {
          shouldTransition: false,
          targetPhaseId: null,
          reason: 'まだこの phase を維持する',
        };
        if (inputArg.currentPhase.id === 'station_meeting') {
          phaseTransitionProposal = {
            shouldTransition: true,
            targetPhaseId: 'cafe_thank_you',
            reason: 'お礼の流れが成立した',
          };
        } else if (inputArg.currentPhase.id === 'cafe_thank_you') {
          phaseTransitionProposal = {
            shouldTransition: true,
            targetPhaseId: 'walk_after_cafe',
            reason: '夢の話がつながった',
          };
        } else if (inputArg.currentPhase.id === 'walk_after_cafe') {
          phaseTransitionProposal = {
            shouldTransition: true,
            targetPhaseId: 'backstage_invitation',
            reason: '不安を支える流れが成立した',
          };
        }

        return {
          plan: createPlan({
            phaseTransitionProposal,
          }),
          modelId: 'mock/planner',
          systemPromptHash: 'mock-planner-prompt',
        };
      },
      async runGenerator() {
        return {
          candidates: createTurnCandidates(Math.max(0, coeTurn - 1)),
          modelId: 'mock/generator',
          systemPromptHash: 'mock-generator-prompt',
        };
      },
      async runRanker(inputArg) {
        return {
          winnerIndex: 0,
          candidates: createRankedCandidates(inputArg.candidates),
          globalNotes: 'mock ranker',
          modelId: 'mock/ranker',
          systemPromptHash: 'mock-ranker-prompt',
        };
      },
      async runMemoryExtractor() {
        const extraction = createMemoryExtraction(memoryTurn);
        memoryTurn += 1;
        return {
          extraction,
          modelId: 'mock/memory-extractor',
          systemPromptHash: 'mock-memory-prompt',
        };
      },
    },
  } satisfies DraftChatTurnDeps;
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
    `CREATE TABLE pairs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      canonical_thread_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE pair_state (
      pair_id TEXT PRIMARY KEY REFERENCES pairs(id),
      active_character_version_id TEXT NOT NULL,
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
    `CREATE TABLE working_memory (
      pair_id TEXT PRIMARY KEY REFERENCES pairs(id),
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ];

  for (const statement of statements) {
    await db.execute(statement);
  }
}

async function setupDraftWorkspace() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-t5-draft-chat-'));
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
    args: ['22222222-2222-4222-8222-222222222222', 'seira-test', '蒼井セイラ'],
  });

  const workspace = await workspaceRepo.create({
    characterId: '22222222-2222-4222-8222-222222222222',
    name: 'Seira sandbox',
    createdBy: 'tester',
  });

  await workspaceRepo.initDraft(workspace.id, createSeiraDraftState());

  return {
    db,
    workspace,
    cleanup,
  };
}

async function insertProductionSentinel(db: ReturnType<typeof getDb>) {
  await db.execute({
    sql: `INSERT INTO pairs (id, user_id, character_id, canonical_thread_id, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      'prod-pair-000000000000000000000001',
      'prod-user',
      '22222222-2222-4222-8222-222222222222',
      'prod-thread',
      '2026-03-26T00:00:00.000Z',
    ],
  });
  await db.execute({
    sql: `INSERT INTO pair_state
          (pair_id, active_character_version_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, pad_fast_json, pad_slow_json, pad_combined_json, last_emotion_updated_at, appraisal_json, open_thread_count, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      'prod-pair-000000000000000000000001',
      'prod-char-version',
      'exclusive_partner',
      77,
      79,
      45,
      3,
      JSON.stringify({ pleasure: 0.3, arousal: 0.1, dominance: 0.2 }),
      JSON.stringify({ pleasure: 0.3, arousal: 0.1, dominance: 0.2 }),
      JSON.stringify({ pleasure: 0.25, arousal: 0.08, dominance: 0.18 }),
      JSON.stringify({ pleasure: 0.28, arousal: 0.09, dominance: 0.19 }),
      '2026-03-26T00:00:00.000Z',
      JSON.stringify({
        goalCongruence: 0.6,
        controllability: 0.5,
        certainty: 0.7,
        normAlignment: 0.6,
        attachmentSecurity: 0.7,
        reciprocity: 0.5,
        pressureIntrusiveness: 0.1,
        novelty: 0.4,
        selfRelevance: 0.6,
      }),
      0,
      '2026-03-26T00:00:00.000Z',
    ],
  });
  await db.execute({
    sql: `INSERT INTO working_memory (pair_id, data_json, updated_at) VALUES (?, ?, ?)`,
    args: [
      'prod-pair-000000000000000000000001',
      JSON.stringify({
        preferredAddressForm: 'プロダクション用',
        knownLikes: ['production-only-like'],
        knownDislikes: [],
        currentCooldowns: {},
        activeTensionSummary: 'prod-only-tension',
        relationshipStance: 'production_stable',
        knownCorrections: [],
        intimacyContextHints: [],
      }),
      '2026-03-26T00:00:00.000Z',
    ],
  });
}

async function readProductionSentinel(db: ReturnType<typeof getDb>) {
  const pairState = await db.execute({
    sql: `SELECT active_phase_id, trust, affinity, intimacy_readiness, conflict FROM pair_state WHERE pair_id = ?`,
    args: ['prod-pair-000000000000000000000001'],
  });
  const workingMemory = await db.execute({
    sql: `SELECT data_json FROM working_memory WHERE pair_id = ?`,
    args: ['prod-pair-000000000000000000000001'],
  });

  return {
    pairState: pairState.rows[0],
    workingMemoryJson: workingMemory.rows[0]?.data_json ?? null,
  };
}

test('Task T5 two-turn carry-over and five-turn progression keep sandbox PAD, phase, pair metrics, threads, and memory-derived state within one session', async () => {
  const { workspace, cleanup } = await setupDraftWorkspace();
  const snapshots: ExtractorSnapshot[] = [];
  const plannerSawCanonicalCoE: boolean[] = [];

  try {
    const deps = createDraftChatDeps({ snapshots, plannerSawCanonicalCoE });
    const userId = 'sandbox-user';
    const results = [];

    for (const message of TURN_MESSAGES) {
      const result = await runDraftChatTurn(
        {
          workspaceId: workspace.id,
          userId,
          message,
        },
        deps
      );
      results.push(result);
    }

    assert.equal(results.length, 5);
    assert.ok(results.every((result) => result.sessionId === results[0]?.sessionId));
    assert.equal(snapshots.length, 5);
    assert.equal(plannerSawCanonicalCoE.length, 5);
    assert.ok(plannerSawCanonicalCoE.every(Boolean));

    assert.equal(snapshots[1]?.phaseId, 'cafe_thank_you');
    assert.ok((snapshots[1]?.trust ?? 0) > (snapshots[0]?.trust ?? 0));
    assert.ok((snapshots[1]?.pad.pleasure ?? 0) > (snapshots[0]?.pad.pleasure ?? 0));
    assert.equal(snapshots[1]?.openThreadCount, 1);
    assert.deepStrictEqual(snapshots[1]?.threadKeys, ['live_plan_followup']);
    assert.equal(snapshots[1]?.relationshipStance, 'warming_up');
    assert.equal(snapshots[1]?.activeTensionSummary, 'ライブ相談の続き');
    assert.deepStrictEqual(snapshots[1]?.knownCorrections, ['急かされると困る']);
    assert.deepStrictEqual(snapshots[1]?.intimacyContextHints, ['ペースを尊重されると安心する']);

    assert.equal(snapshots[2]?.phaseId, 'walk_after_cafe');
    assert.equal(snapshots[3]?.phaseId, 'backstage_invitation');
    assert.equal(snapshots[4]?.phaseId, 'backstage_invitation');
    assert.ok((snapshots[4]?.trust ?? 0) >= (snapshots[1]?.trust ?? 0));
    assert.ok((snapshots[4]?.affinity ?? 0) >= (snapshots[1]?.affinity ?? 0));
    assert.ok((snapshots[4]?.intimacyReadiness ?? 0) >= (snapshots[1]?.intimacyReadiness ?? 0));

    const persistedState = await workspaceRepo.getSandboxPairState(results[0]!.sessionId);
    const persistedMemory = await workspaceRepo.getSandboxWorkingMemory(results[0]!.sessionId);
    const remainingThreads = await workspaceRepo.getSandboxOpenThreads(results[0]!.sessionId);
    const turns = await workspaceRepo.getTurns(results[0]!.sessionId);

    assert.ok(persistedState);
    assert.equal(persistedState?.activePhaseId, 'backstage_invitation');
    assert.ok((persistedState?.trust ?? 0) > 50);
    assert.ok((persistedState?.affinity ?? 0) > 50);
    assert.ok((persistedState?.intimacyReadiness ?? 0) >= 0);
    assert.ok(typeof persistedState?.pad.pleasure === 'number');
    assert.equal(persistedState?.openThreadCount, 1);

    assert.ok(persistedMemory);
    assert.equal(persistedMemory?.relationshipStance, 'steady');
    assert.equal(persistedMemory?.activeTensionSummary, 'ライブ相談の続き');
    assert.ok(persistedMemory?.knownLikes.includes('夢の話を聞くこと'));
    assert.ok(persistedMemory?.knownCorrections.includes('急かされると困る'));
    assert.ok(persistedMemory?.intimacyContextHints.includes('ペースを尊重されると安心する'));
    assert.ok(persistedMemory?.intimacyContextHints.includes('待ってくれると安心する'));

    assert.equal(remainingThreads.length, 1);
    assert.equal(remainingThreads[0]?.key, 'live_plan_followup');
    assert.equal(turns.length, 5);
    assert.ok(results.every((result) => result.trace.coeExtraction));
    assert.ok(results.every((result) => result.trace.emotionTrace));
  } finally {
    await cleanup();
  }
});

test('Task T5 explicit reset clears sandbox state, keeps production data isolated, and does not leak production-only comparison trace into sandbox', async () => {
  const previousFlag = process.env.YUMEKANO_USE_COE_INTEGRATOR;
  process.env.YUMEKANO_USE_COE_INTEGRATOR = 'true';

  const { db, workspace, cleanup } = await setupDraftWorkspace();
  const snapshots: ExtractorSnapshot[] = [];
  const plannerSawCanonicalCoE: boolean[] = [];

  try {
    await insertProductionSentinel(db);
    const before = await readProductionSentinel(db);
    const deps = createDraftChatDeps({ snapshots, plannerSawCanonicalCoE });
    const userId = 'sandbox-user';

    const first = await runDraftChatTurn(
      {
        workspaceId: workspace.id,
        userId,
        message: TURN_MESSAGES[0],
      },
      deps
    );

    const afterTurn = await readProductionSentinel(db);
    assert.deepStrictEqual(afterTurn, before);

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

    const afterReset = await readProductionSentinel(db);
    assert.deepStrictEqual(afterReset, before);
    assert.equal(
      first.trace.legacyComparison,
      null,
      'sandbox should stay isolated from production-only old/new comparison rollout'
    );
  } finally {
    if (previousFlag === undefined) {
      delete process.env.YUMEKANO_USE_COE_INTEGRATOR;
    } else {
      process.env.YUMEKANO_USE_COE_INTEGRATOR = previousFlag;
    }
    await cleanup();
  }
});
