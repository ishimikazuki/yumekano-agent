/**
 * T-C integration: question-saturation scorer is wired into the ranker.
 *
 * Verifies the structural integration points (import, aggregate shape,
 * multiplicative score application). The pure scorer behaviour is
 * covered in `tests/unit/scorer-question-saturation.unit.test.ts`.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RANKER_SRC = readFileSync(
  resolve(process.cwd(), 'src/mastra/agents/ranker.ts'),
  'utf8'
);

const SCORERS_INDEX = readFileSync(
  resolve(process.cwd(), 'src/mastra/scorers/index.ts'),
  'utf8'
);

test('T-C integration: scoreQuestionSaturation is exported from scorers index', () => {
  assert.match(SCORERS_INDEX, /export\s*\{[^}]*scoreQuestionSaturation[^}]*\}/);
  assert.match(SCORERS_INDEX, /QuestionSaturationConfig|QuestionSaturationResult/);
});

test('T-C integration: ranker imports scoreQuestionSaturation', () => {
  assert.match(
    RANKER_SRC,
    /import\s*\{[^}]*scoreQuestionSaturation[^}]*\}\s*from\s*['"]..\/scorers['"]/s
  );
});

test('T-C integration: CandidateScorerAggregate type includes questionSaturation field', () => {
  assert.match(
    RANKER_SRC,
    /type\s+CandidateScorerAggregate\s*=\s*\{[\s\S]*questionSaturation:\s*number[\s\S]*\}/,
    'CandidateScorerAggregate must carry the question-saturation score for trace visibility'
  );
});

test('T-C integration: ranker invokes scoreQuestionSaturation on each candidate', () => {
  assert.match(
    RANKER_SRC,
    /scoreQuestionSaturation\s*\(\s*\{\s*candidate:\s*\{\s*text:\s*candidate\.text\s*\}/,
    'ranker must call scoreQuestionSaturation with the candidate text'
  );
});

test('T-C integration: deterministicOverall is multiplicatively attenuated by question-saturation score', () => {
  // The design: baseOverall * questionSaturationResult.score. This keeps the
  // existing weighted aggregate stable when saturation=1.0 (no-op) and fades
  // the score when saturation is low (penalty).
  assert.match(
    RANKER_SRC,
    /baseOverall\s*\*\s*questionSaturationResult\.score/,
    'ranker must multiply baseOverall by the saturation score'
  );
});

test('T-C integration: hard-rejected candidates still carry a questionSaturation field (0 is fine)', () => {
  // Consistency: all CandidateScorerAggregate instances expose the new field,
  // otherwise downstream code could crash on `undefined`.
  const hardRejectBlock = RANKER_SRC.match(
    /if\s*\(\s*deterministic\.rejected\s*\)\s*\{\s*return\s*\{[\s\S]*?\};\s*\}/
  );
  assert.ok(hardRejectBlock, 'hard-reject return block must exist');
  assert.match(
    hardRejectBlock![0],
    /questionSaturation:\s*0/,
    'hard-reject branch must assign questionSaturation: 0 for shape consistency'
  );
});

test('T-C integration: questionSaturation issues are merged into the aggregate issues list', () => {
  assert.match(
    RANKER_SRC,
    /\.\.\.questionSaturationResult\.issues/,
    'saturation issues must be visible in the aggregate issues array'
  );
});
