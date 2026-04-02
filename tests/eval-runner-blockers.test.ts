import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReport,
  buildShadowComparisonReport,
  isProviderConnectivityError,
} from '@/scripts/run-emotion-relationship-evals';

test('isProviderConnectivityError detects provider/network outages', () => {
  assert.equal(
    isProviderConnectivityError(
      new Error('Failed after 3 attempts. Last error: Cannot connect to API: getaddrinfo ENOTFOUND api.x.ai')
    ),
    true
  );
  assert.equal(isProviderConnectivityError(new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed')), false);
});

test('buildShadowComparisonReport marks missing legacy coverage explicitly', () => {
  const report = buildShadowComparisonReport(
    [
      {
        id: 'case-a',
        title: 'A',
        notes: 'A notes',
        passed: false,
        turns: [],
        cumulativePadDelta: { pleasure: 0, arousal: 0, dominance: 0 },
        cumulativePairDelta: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
        cumulativeMismatches: ['runner error: example'],
        shadow: {
          comparedTurns: 0,
          totalTurns: 2,
          avgPadAbsDiff: 0,
          avgPairAbsDiff: 0,
        },
      },
      {
        id: 'case-b',
        title: 'B',
        notes: 'B notes',
        passed: true,
        turns: [],
        cumulativePadDelta: { pleasure: 0, arousal: 0, dominance: 0 },
        cumulativePairDelta: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
        cumulativeMismatches: [],
        shadow: {
          comparedTurns: 2,
          totalTurns: 2,
          avgPadAbsDiff: 0.1,
          avgPairAbsDiff: 0.2,
        },
      },
    ],
    {
      requestedMode: 'auto',
      effectiveMode: 'offline',
      fellBackToOffline: true,
      fallbackReason: 'ENOTFOUND api.x.ai',
    },
    true
  );

  assert.match(report, /Missing Legacy Comparison Coverage/);
  assert.match(report, /- case-a/);
  assert.match(report, /Execution mode effective: `offline`/);
});

test('buildReport explicitly names unresolved blockers', () => {
  const report = buildReport(
    [
      {
        id: 'case-blocked',
        title: 'Blocked',
        notes: 'blocked notes',
        passed: false,
        turns: [
          {
            index: 1,
            userMessage: 'msg',
            assistantMessage: 'reply',
            padDelta: { pleasure: 0, arousal: 0, dominance: 0 },
            pairDelta: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
            mismatches: ['runner error: ENOTFOUND api.x.ai'],
          },
        ],
        cumulativePadDelta: { pleasure: 0, arousal: 0, dominance: 0 },
        cumulativePairDelta: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
        cumulativeMismatches: [],
        shadow: {
          comparedTurns: 0,
          totalTurns: 1,
          avgPadAbsDiff: 0,
          avgPairAbsDiff: 0,
        },
      },
    ],
    {
      requestedMode: 'auto',
      effectiveMode: 'offline',
      fellBackToOffline: true,
      fallbackReason: 'ENOTFOUND api.x.ai',
    }
  );

  assert.match(report, /Named Blockers/i);
  assert.match(report, /runner error: ENOTFOUND api\.x\.ai/);
});

test('buildReport does not hide failing local validation tests as no known blockers', () => {
  const report = buildReport(
    [
      {
        id: 'case-pass',
        title: 'Pass',
        notes: 'pass notes',
        passed: true,
        turns: [],
        cumulativePadDelta: { pleasure: 0, arousal: 0, dominance: 0 },
        cumulativePairDelta: { affinity: 0, trust: 0, intimacyReadiness: 0, conflict: 0 },
        cumulativeMismatches: [],
        shadow: {
          comparedTurns: 0,
          totalTurns: 1,
          avgPadAbsDiff: 0,
          avgPairAbsDiff: 0,
        },
      },
    ],
    {
      requestedMode: 'offline',
      effectiveMode: 'offline',
      fellBackToOffline: false,
      fallbackReason: null,
    },
    {
      command: 'npm run test',
      passed: false,
      exitCode: 1,
      failures: [
        {
          testId: 'tests/t1-contract-plan-acceptance.test.ts:2:2358',
          title: 'Task T1 keeps the production turn path free of the new CoE pipeline wiring',
          reason: 'AssertionError [ERR_ASSERTION]',
        },
        {
          testId: 'tests/trace-repo.test.ts:2:1133',
          title: 'createTrace persists the expanded runtime trace payload',
          reason: 'Error [ZodError]',
        },
      ],
    }
  );

  assert.match(report, /Local Validation[\s\S]*status: FAIL/);
  assert.match(report, /tests\/t1-contract-plan-acceptance\.test\.ts:2:2358/);
  assert.match(report, /tests\/trace-repo\.test\.ts:2:1133/);
  assert.doesNotMatch(report, /- no known blockers/);
  assert.match(report, /Do not widen rollout yet\./);
  assert.match(report, /YUMEKANO_USE_COE_INTEGRATOR=false/);
});
