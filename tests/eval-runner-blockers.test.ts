import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
