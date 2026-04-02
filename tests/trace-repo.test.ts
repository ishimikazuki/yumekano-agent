import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { traceRepo } from '@/lib/repositories/trace-repo';

test('createTrace persists the expanded runtime trace payload', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-trace-repo-'));
  const dbPath = path.join(tempDir, 'trace-repo.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  try {
    const db = getDb();

    await db.execute(`
      CREATE TABLE turn_traces (
        id TEXT PRIMARY KEY,
        pair_id TEXT NOT NULL,
        character_version_id TEXT NOT NULL,
        prompt_bundle_version_id TEXT NOT NULL,
        model_ids_json TEXT NOT NULL,
        phase_id_before TEXT NOT NULL,
        phase_id_after TEXT NOT NULL,
        emotion_before_json TEXT NOT NULL,
        emotion_after_json TEXT NOT NULL,
        emotion_state_before_json TEXT,
        emotion_state_after_json TEXT,
        relationship_before_json TEXT,
        relationship_after_json TEXT,
        relationship_deltas_json TEXT,
        phase_transition_evaluation_json TEXT,
        prompt_assembly_hashes_json TEXT,
        appraisal_json TEXT NOT NULL,
        retrieved_memory_ids_json TEXT NOT NULL,
        coe_extraction_json TEXT,
        emotion_trace_json TEXT,
        legacy_comparison_json TEXT,
        memory_threshold_decisions_json TEXT,
        coe_contributions_json TEXT,
        plan_json TEXT NOT NULL,
        candidates_json TEXT NOT NULL,
        winner_index INTEGER NOT NULL,
        memory_writes_json TEXT NOT NULL,
        user_message TEXT NOT NULL,
        assistant_message TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    const trace = await traceRepo.createTrace({
      pairId: '11111111-1111-4111-8111-111111111111',
      characterVersionId: '22222222-2222-4222-8222-222222222222',
      promptBundleVersionId: '33333333-3333-4333-8333-333333333333',
      modelIds: {
        planner: 'planner-model',
        generator: 'generator-model',
        ranker: 'ranker-model',
        extractor: 'extractor-model',
      },
      phaseIdBefore: 'station_meeting',
      phaseIdAfter: 'station_meeting',
      emotionBefore: {
        pleasure: -0.8,
        arousal: -0.8,
        dominance: 0.8,
      },
      emotionAfter: {
        pleasure: -0.78,
        arousal: -0.77,
        dominance: 0.8,
      },
      emotionStateBefore: {
        fastAffect: {
          pleasure: -0.8,
          arousal: -0.8,
          dominance: 0.8,
        },
        slowMood: {
          pleasure: -0.8,
          arousal: -0.8,
          dominance: 0.8,
        },
        combined: {
          pleasure: -0.8,
          arousal: -0.8,
          dominance: 0.8,
        },
        lastUpdatedAt: new Date('2026-03-24T07:00:00.000Z'),
      },
      emotionStateAfter: {
        fastAffect: {
          pleasure: -0.78,
          arousal: -0.77,
          dominance: 0.8,
        },
        slowMood: {
          pleasure: -0.8,
          arousal: -0.8,
          dominance: 0.8,
        },
        combined: {
          pleasure: -0.78,
          arousal: -0.77,
          dominance: 0.8,
        },
        lastUpdatedAt: new Date('2026-03-24T07:05:00.000Z'),
      },
      relationshipBefore: {
        affinity: 50,
        trust: 50,
        intimacyReadiness: 0,
        conflict: 0,
      },
      relationshipAfter: {
        affinity: 51,
        trust: 51,
        intimacyReadiness: 0.2,
        conflict: 0,
      },
      relationshipDeltas: {
        affinity: 1,
        trust: 1,
        intimacyReadiness: 0.2,
        conflict: 0,
      },
      phaseTransitionEvaluation: {
        shouldTransition: false,
        targetPhaseId: null,
        reason: 'threshold_not_met',
        satisfiedConditions: [],
        failedConditions: ['trust >= 60'],
      },
      promptAssemblyHashes: {
        planner: 'planner-hash',
        generator: 'generator-hash',
        ranker: 'ranker-hash',
        extractor: 'extractor-hash',
      },
      appraisal: {
        goalCongruence: 0.2,
        controllability: 0.5,
        certainty: 0.5,
        normAlignment: 0.1,
        attachmentSecurity: 0.6,
        reciprocity: 0.3,
        pressureIntrusiveness: 0.1,
        novelty: 0.6,
        selfRelevance: 0.5,
      },
      retrievedMemoryIds: {
        events: ['44444444-4444-4444-8444-444444444444'],
        facts: ['55555555-5555-4555-8555-555555555555'],
        observations: ['66666666-6666-4666-8666-666666666666'],
        threads: ['77777777-7777-4777-8777-777777777777'],
      },
      coeExtraction: {
        interactionActs: [
          {
            act: 'support',
            target: 'relationship',
            polarity: 'positive',
            intensity: 0.7,
            evidenceSpans: [
              {
                source: 'user_message',
                sourceId: null,
                text: '大丈夫だよ',
                start: 0,
                end: 5,
              },
            ],
            confidence: 0.82,
            uncertaintyNotes: [],
          },
        ],
        relationalAppraisal: {
          warmthImpact: 0.42,
          rejectionImpact: -0.05,
          respectImpact: 0.2,
          threatImpact: -0.1,
          pressureImpact: 0,
          repairImpact: 0.08,
          reciprocityImpact: 0.28,
          intimacySignal: 0.1,
          boundarySignal: 0.14,
          certainty: 0.82,
        },
        confidence: 0.82,
        uncertaintyNotes: [],
      },
      emotionTrace: {
        source: 'model',
        evidence: [
          {
            source: 'user_message',
            key: 'support_0',
            summary: 'support toward relationship: 大丈夫だよ',
            weight: 0.57,
            confidence: 0.82,
            valence: 0.7,
          },
        ],
        relationalAppraisal: {
          source: 'model',
          summary: 'Model extraction detected a warm, relationship-positive turn.',
          warmthSignal: 0.42,
          reciprocitySignal: 0.28,
          safetySignal: 0.48,
          boundaryRespect: 0.14,
          pressureSignal: 0,
          repairSignal: 0.08,
          intimacySignal: 0.1,
          confidence: 0.82,
          evidence: [
            {
              source: 'user_message',
              key: 'support_0',
              summary: 'support toward relationship: 大丈夫だよ',
              weight: 0.57,
              confidence: 0.82,
              valence: 0.7,
            },
          ],
        },
        proposal: {
          source: 'model',
          rationale: 'Model extraction detected a warm, relationship-positive turn.',
          appraisal: {
            source: 'model',
            summary: 'Model extraction detected a warm, relationship-positive turn.',
            warmthSignal: 0.42,
            reciprocitySignal: 0.28,
            safetySignal: 0.48,
            boundaryRespect: 0.14,
            pressureSignal: 0,
            repairSignal: 0.08,
            intimacySignal: 0.1,
            confidence: 0.82,
            evidence: [
              {
                source: 'user_message',
                key: 'support_0',
                summary: 'support toward relationship: 大丈夫だよ',
                weight: 0.57,
                confidence: 0.82,
                valence: 0.7,
              },
            ],
          },
          padDelta: {
            pleasure: 0.02,
            arousal: 0.01,
            dominance: 0,
          },
          pairDelta: {
            affinity: 1,
            trust: 1,
            intimacyReadiness: 0.2,
            conflict: 0,
          },
          confidence: 0.82,
          evidence: [
            {
              source: 'user_message',
              key: 'support_0',
              summary: 'support toward relationship: 大丈夫だよ',
              weight: 0.57,
              confidence: 0.82,
              valence: 0.7,
            },
          ],
        },
        emotionBefore: {
          pleasure: -0.8,
          arousal: -0.8,
          dominance: 0.8,
        },
        emotionAfter: {
          pleasure: -0.78,
          arousal: -0.77,
          dominance: 0.8,
        },
        pairMetricsBefore: {
          affinity: 50,
          trust: 50,
          intimacyReadiness: 0,
          conflict: 0,
        },
        pairMetricsAfter: {
          affinity: 51,
          trust: 51,
          intimacyReadiness: 0.2,
          conflict: 0,
        },
        pairMetricDelta: {
          affinity: 1,
          trust: 1,
          intimacyReadiness: 0.2,
          conflict: 0,
        },
      },
      legacyComparison: {
        appraisal: {
          goalCongruence: 0.2,
          controllability: 0.5,
          certainty: 0.5,
          normAlignment: 0.1,
          attachmentSecurity: 0.6,
          reciprocity: 0.3,
          pressureIntrusiveness: 0.1,
          novelty: 0.6,
          selfRelevance: 0.5,
        },
        emotionAfter: {
          pleasure: -0.79,
          arousal: -0.78,
          dominance: 0.8,
        },
        emotionStateAfter: {
          fastAffect: {
            pleasure: -0.79,
            arousal: -0.78,
            dominance: 0.8,
          },
          slowMood: {
            pleasure: -0.8,
            arousal: -0.8,
            dominance: 0.8,
          },
          combined: {
            pleasure: -0.79,
            arousal: -0.78,
            dominance: 0.8,
          },
          lastUpdatedAt: new Date('2026-03-24T07:05:00.000Z'),
        },
        relationshipAfter: {
          affinity: 50.8,
          trust: 50.9,
          intimacyReadiness: 0.1,
          conflict: 0.2,
        },
        relationshipDeltas: {
          affinity: 0.8,
          trust: 0.9,
          intimacyReadiness: 0.1,
          conflict: 0.2,
        },
        coeContributions: [
          {
            source: 'appraisal',
            axis: 'pleasure',
            delta: 0.01,
            reason: 'legacy comparison contribution',
          },
        ],
      },
      memoryThresholdDecisions: [
        {
          kind: 'event',
          summary: 'Store the clover continuation as an event',
          passed: true,
          reason: 'salience exceeded threshold',
        },
      ],
      coeContributions: [
        {
          source: 'appraisal',
          axis: 'pleasure',
          delta: 0.01,
          reason: 'goal congruence nudged pleasure upward',
        },
      ],
      plan: {
        stance: 'warm',
        primaryActs: ['acknowledge', 'continue_topic'],
        secondaryActs: ['suggest'],
        memoryFocus: {
          emphasize: ['44444444-4444-4444-8444-444444444444'],
          suppress: [],
          reason: 'Keep the clover thread active',
        },
        phaseTransitionProposal: {
          shouldTransition: false,
          targetPhaseId: null,
          reason: 'Still early in the meeting phase',
        },
        intimacyDecision: 'not_applicable',
        emotionDeltaIntent: {
          pleasureDelta: 0.05,
          arousalDelta: 0.02,
          dominanceDelta: 0,
          reason: 'Slightly warmer after a safe continuation',
        },
        mustAvoid: ['sudden intimacy'],
        plannerReasoning: 'She should respond warmly and keep the clover thread going.',
      },
      candidates: [
        {
          index: 0,
          text: 'こんにちはっ！ もちろんですっ。',
          toneTags: ['warm'],
          memoryRefsUsed: ['44444444-4444-4444-8444-444444444444'],
          riskFlags: [],
          scores: {
            personaConsistency: 0.9,
            phaseCompliance: 0.95,
            memoryGrounding: 0.88,
            emotionalCoherence: 0.9,
            autonomy: 0.82,
            naturalness: 0.86,
            overall: 0.89,
          },
          rejected: false,
          rejectionReason: null,
        },
      ],
      winnerIndex: 0,
      memoryWrites: [],
      userMessage: 'こんにちは、続きの話してもいい？',
      assistantMessage: 'こんにちはっ！ もちろんですっ。',
    });

    const stored = await traceRepo.getTraceById(trace.id);

    assert.ok(stored);
    assert.equal(stored?.promptAssemblyHashes.planner, 'planner-hash');
    assert.equal(stored?.modelIds.extractor, 'extractor-model');
    assert.equal(stored?.memoryThresholdDecisions.length, 1);
    assert.equal(stored?.coeContributions.length, 1);
    assert.equal(stored?.coeExtraction?.interactionActs[0]?.act, 'support');
    assert.equal(stored?.emotionTrace?.relationalAppraisal.warmthSignal, 0.42);
    assert.equal(stored?.legacyComparison?.relationshipDeltas.trust, 0.9);
  } finally {
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
  }
});
