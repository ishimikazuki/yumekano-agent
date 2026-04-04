/**
 * Shared helpers for relational integrator unit tests.
 */
import { integrateCoEAppraisal, type CoEIntegratorInput } from '@/lib/rules/coe-integrator';
import { createRuntimeEmotionState } from '@/lib/rules/pad';
import type {
  CoEIntegratorConfig,
  EmotionSpec,
  ExtractedInteractionAct,
  OpenThread,
  RelationalAppraisal,
  RelationshipMetrics,
} from '@/lib/schemas';
import { DEFAULT_COE_INTEGRATOR_CONFIG } from '@/lib/schemas';

export const DEFAULT_EMOTION_SPEC: EmotionSpec = {
  baselinePAD: { pleasure: 0.1, arousal: 0, dominance: 0.05 },
  recovery: { pleasureHalfLifeTurns: 5, arousalHalfLifeTurns: 3, dominanceHalfLifeTurns: 4 },
  appraisalSensitivity: {
    goalCongruence: 0.6, controllability: 0.5, certainty: 0.5,
    normAlignment: 0.6, attachmentSecurity: 0.7, reciprocity: 0.7,
    pressureIntrusiveness: 0.7, novelty: 0.5, selfRelevance: 0.5,
  },
  externalization: { warmthWeight: 0.7, tersenessWeight: 0.3, directnessWeight: 0.4, teasingWeight: 0.2 },
  coeIntegrator: DEFAULT_COE_INTEGRATOR_CONFIG as CoEIntegratorConfig,
};

export const ENTRY_PHASE = { mode: 'entry' as const, adultIntimacyEligibility: 'never' as const };
export const RELATIONSHIP_PHASE = { mode: 'relationship' as const, adultIntimacyEligibility: 'conditional' as const };

export function buildMetrics(overrides: Partial<RelationshipMetrics> = {}): RelationshipMetrics {
  return { trust: 50, affinity: 50, conflict: 0, intimacyReadiness: 10, ...overrides };
}

export function buildAppraisal(overrides: Partial<RelationalAppraisal> = {}): RelationalAppraisal {
  return {
    warmthImpact: 0, rejectionImpact: 0, respectImpact: 0, threatImpact: 0,
    pressureImpact: 0, repairImpact: 0, reciprocityImpact: 0,
    intimacySignal: 0, boundarySignal: 0, certainty: 0.5,
    ...overrides,
  };
}

export function buildOpenThread(overrides: Partial<OpenThread> = {}): OpenThread {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    pairId: '00000000-0000-4000-8000-000000000002',
    key: 'test_thread', summary: 'Test thread', severity: 0.6,
    status: 'open', openedByEventId: null, resolvedByEventId: null,
    updatedAt: new Date('2026-03-25T00:00:00.000Z'),
    ...overrides,
  };
}

export function runIntegrator(overrides: Partial<CoEIntegratorInput>) {
  return integrateCoEAppraisal({
    currentEmotion: createRuntimeEmotionState({ pleasure: 0, arousal: 0, dominance: 0 }),
    currentMetrics: buildMetrics(),
    appraisal: buildAppraisal(),
    emotionSpec: DEFAULT_EMOTION_SPEC,
    currentPhase: ENTRY_PHASE,
    openThreads: [],
    turnsSinceLastUpdate: 1,
    ...overrides,
  });
}

export { integrateCoEAppraisal, createRuntimeEmotionState };
