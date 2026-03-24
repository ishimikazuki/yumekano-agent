import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDb } from '@/lib/db/client';
import { pairRepo } from '@/lib/repositories/pair-repo';

test('pairRepo.updateState accepts emotion and pad together without duplicate pad assignment', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'yumekano-pair-repo-'));
  const dbPath = path.join(tempDir, 'pair-repo.db');
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousLocalDatabaseUrl = process.env.LOCAL_DATABASE_URL;

  delete process.env.DATABASE_URL;
  process.env.LOCAL_DATABASE_URL = `file:${dbPath}`;
  await getDb().close();

  try {
    const db = getDb();

    await db.execute(`
      CREATE TABLE pair_state (
        pair_id TEXT PRIMARY KEY,
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
        last_transition_at TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute({
      sql: `INSERT INTO pair_state
            (pair_id, active_character_version_id, active_phase_id, affinity, trust, intimacy_readiness, conflict, pad_json, pad_fast_json, pad_slow_json, pad_combined_json, last_emotion_updated_at, appraisal_json, open_thread_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        'station_meeting',
        50,
        50,
        0,
        0,
        JSON.stringify({ pleasure: 0, arousal: 0, dominance: 0 }),
        JSON.stringify({ pleasure: 0, arousal: 0, dominance: 0 }),
        JSON.stringify({ pleasure: 0, arousal: 0, dominance: 0 }),
        JSON.stringify({ pleasure: 0, arousal: 0, dominance: 0 }),
        '2026-03-24T07:00:00.000Z',
        JSON.stringify({
          goalCongruence: 0,
          controllability: 0.5,
          certainty: 0.5,
          normAlignment: 0,
          attachmentSecurity: 0.5,
          reciprocity: 0,
          pressureIntrusiveness: 0,
          novelty: 0.5,
          selfRelevance: 0.5,
        }),
        0,
        '2026-03-24T07:00:00.000Z',
      ],
    });

    await pairRepo.updateState('11111111-1111-4111-8111-111111111111', {
      emotion: {
        fastAffect: { pleasure: 0.1, arousal: 0.2, dominance: 0.3 },
        slowMood: { pleasure: 0, arousal: 0, dominance: 0.1 },
        combined: { pleasure: 0.1, arousal: 0.2, dominance: 0.4 },
        lastUpdatedAt: new Date('2026-03-24T07:05:00.000Z'),
      },
      pad: { pleasure: 0.1, arousal: 0.2, dominance: 0.4 },
    });

    const result = await db.execute({
      sql: `SELECT pad_json, pad_combined_json, last_emotion_updated_at FROM pair_state WHERE pair_id = ?`,
      args: ['11111111-1111-4111-8111-111111111111'],
    });

    assert.equal(
      result.rows[0]?.last_emotion_updated_at,
      '2026-03-24T07:05:00.000Z'
    );
    assert.deepStrictEqual(JSON.parse(String(result.rows[0]?.pad_json)), {
      pleasure: 0.1,
      arousal: 0.2,
      dominance: 0.4,
    });
    assert.deepStrictEqual(JSON.parse(String(result.rows[0]?.pad_combined_json)), {
      pleasure: 0.1,
      arousal: 0.2,
      dominance: 0.4,
    });
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
