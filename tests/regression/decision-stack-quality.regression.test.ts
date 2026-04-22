/**
 * T5: decision-stack quality regression
 *
 * Locks in the defaults for planner / ranker / CoE extractor so a silent
 * tier downgrade cannot land without updating this test.
 *
 * The intent: "when T5 says 'default held', the defaults must actually hold."
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultModelRoles } from '@/mastra/providers/model-roles';

const REPO_ROOT = resolve(__dirname, '..', '..');

function hasAlias(relPath: string, alias: string): boolean {
  const src = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
  const pattern = new RegExp(
    `registry\\.(getModel|getModelInfo)\\(\\s*['"]${alias}['"]\\s*\\)`
  );
  return pattern.test(src);
}

test('planner still uses decisionHigh', () => {
  assert.ok(
    hasAlias('src/mastra/agents/planner.ts', 'decisionHigh'),
    'T5: planner must still resolve to decisionHigh'
  );
});

test('ranker still uses decisionHigh', () => {
  assert.ok(
    hasAlias('src/mastra/agents/ranker.ts', 'decisionHigh'),
    'T5: ranker must still resolve to decisionHigh'
  );
});

test('CoE extractor still uses decisionHigh', () => {
  assert.ok(
    hasAlias('src/mastra/agents/coe-evidence-extractor.ts', 'decisionHigh'),
    'T5: CoE extractor must still resolve to decisionHigh'
  );
});

test('decisionHigh provider + model id match T0/T1 baseline', () => {
  const cfg = defaultModelRoles.decisionHigh;
  assert.equal(cfg.provider, 'xai', 'decisionHigh provider must stay xai');
  assert.ok(
    /grok-4/.test(cfg.modelId),
    `decisionHigh modelId "${cfg.modelId}" must be a grok-4 variant`
  );

  // If ANALYSIS_MODEL env is not set, we expect grok-4-1-fast-reasoning.
  if (!process.env.ANALYSIS_MODEL) {
    assert.equal(
      cfg.modelId,
      'grok-4-1-fast-reasoning',
      'decisionHigh default must match T0 baseline model id'
    );
  }
});

test('decisionHigh stays separate from the fast tier (no silent merge)', () => {
  const decision = defaultModelRoles.decisionHigh.modelId;
  const fast = defaultModelRoles.structuredPostturnFast.modelId;
  if (!process.env.STRUCTURED_POSTTURN_MODEL && !process.env.ANALYSIS_MODEL) {
    assert.notEqual(
      decision,
      fast,
      'decisionHigh and fast tier must stay on different models by default'
    );
  }
});
