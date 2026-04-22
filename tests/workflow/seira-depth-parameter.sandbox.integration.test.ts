/**
 * T-E sandbox: seira の T-E パラメータ変更を構造的に検証する
 *
 * 実 LLM を呼ばず、seed データそのものに対して「押して引く」挙動を
 * 誘発する静的条件が揃っていることを確認する。
 *
 * 具体値の根拠は PLANS.md の T-E セクションを参照。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  seiraStyle,
  seiraEmotion,
  seiraPersona,
  seiraPhaseGraph,
} from '@/lib/db/seed-seira';

test('T-E: style.initiative lowered from 0.72 to 0.55 (less proactive questioning)', () => {
  assert.equal(
    seiraStyle.initiative,
    0.55,
    'initiative must be 0.55 to dampen question frequency'
  );
});

test('T-E: style.terseness lifted to 0.50 (shorter turns, less info-dump)', () => {
  assert.equal(seiraStyle.terseness, 0.5);
});

test('T-E: style.teasing lifted to 0.18 (creates "pull" texture)', () => {
  assert.equal(seiraStyle.teasing, 0.18);
});

test('T-E: emotion.baselinePAD.dominance lowered to -0.22 (user-oriented lead)', () => {
  assert.equal(seiraEmotion.baselinePAD.dominance, -0.22);
});

test('T-E: emotion.recovery.dominanceHalfLifeTurns extended to 10 (D stays low longer)', () => {
  assert.equal(seiraEmotion.recovery.dominanceHalfLifeTurns, 10);
});

test('T-E: emotion.appraisalSensitivity.selfRelevance lifted to 0.80 (reacts to self-focused cues)', () => {
  assert.equal(seiraEmotion.appraisalSensitivity.selfRelevance, 0.8);
});

test('T-E: persona.vulnerabilities contains 3+ new seira-specific items', () => {
  const vulns = seiraPersona.vulnerabilities;
  assert.ok(vulns.length >= 3, `vulnerabilities must have 3+ items, got ${vulns.length}`);

  const hasStrongFrontNewItem = vulns.some((v) => /強がって|強がり/.test(v));
  const hasHesitationNewItem = vulns.some((v) => /遠慮/.test(v));
  const hasPrivateCryNewItem = vulns.some((v) => /一人で泣/.test(v));

  assert.ok(hasStrongFrontNewItem, 'vulnerabilities must include a 強がる item');
  assert.ok(hasHesitationNewItem, 'vulnerabilities must include a 遠慮 item');
  assert.ok(hasPrivateCryNewItem, 'vulnerabilities must include a 一人で泣く item');
});

test('T-E: authoredExamples.guarded has 2+ new push-pull sample lines', () => {
  const guarded = seiraPersona.authoredExamples.guarded ?? [];
  assert.ok(guarded.length >= 4, `guarded examples must have 4+ (2 base + 2 new), got ${guarded.length}`);

  const hasLivePerfSample = guarded.some((s) => /ライブ|歌詞|足が震/.test(s));
  const hasSpinOutSample = guarded.some((s) => /空回り|ちゃんとしたい/.test(s));
  assert.ok(hasLivePerfSample, 'a guarded sample about ライブ failure is required');
  assert.ok(hasSpinOutSample, 'a guarded sample about 空回り is required');
});

test('T-E: authoredExamples.warm has 2+ new push-pull sample lines', () => {
  const warm = seiraPersona.authoredExamples.warm ?? [];
  assert.ok(warm.length >= 4, `warm examples must have 4+ (2 base + 2 new), got ${warm.length}`);

  const hasWeakAdmissionSample = warm.some((s) => /弱音/.test(s));
  const hasMutualTurnSample = warm.some((s) => /わたしの話も|聞いてほしい/.test(s));
  assert.ok(hasWeakAdmissionSample, 'a warm sample that offers 弱音 is required');
  assert.ok(hasMutualTurnSample, 'a warm sample that asks for reciprocal listening is required');
});

test('T-E: phaseGraph.walk_after_cafe allows a push-pull act mix (questions + disclosure + invitation)', () => {
  const walk = seiraPhaseGraph.nodes.find((n) => n.id === 'walk_after_cafe');
  assert.ok(walk, 'walk_after_cafe phase must exist');

  // Questions stay available — original feedback: 質問は正解。バランスの問題。
  assert.ok(
    walk!.allowedActs.includes('ask_question'),
    'walk_after_cafe must keep ask_question (questions are good — the push-pull comes from mixing in other acts)'
  );

  // Self-disclosure vessel (no self_disclose act yet; share_information carries vulnerable content via authoredExamples)
  assert.ok(
    walk!.allowedActs.includes('share_information'),
    'walk_after_cafe must allow share_information (self-disclosure vessel)'
  );

  // Invitation vessel for "お茶しませんか" style beats
  assert.ok(
    walk!.allowedActs.includes('suggest'),
    'walk_after_cafe must allow suggest (invitation beat)'
  );

  assert.ok(walk!.allowedActs.includes('express_concern'));
  assert.ok(walk!.allowedActs.includes('offer_support'));
  assert.equal(walk!.disallowedActs.length, 0, 'no blanket bans — planner chooses via authored guidance');

  // authoredNotes must signal the push-pull intent so the planner can bias without a schema change
  assert.match(
    walk!.authoredNotes ?? '',
    /(自己開示|弱音).*(提案|お茶)|(提案|お茶).*(自己開示|弱音)/,
    'authoredNotes must describe mixing self-disclosure with invitation beats'
  );
});

test('T-E: cafe_to_walk edge is OR-gated with D-drop and time conditions', () => {
  const edge = seiraPhaseGraph.edges.find((e) => e.id === 'cafe_to_walk');
  assert.ok(edge, 'cafe_to_walk edge must exist');
  assert.equal(
    edge!.allMustPass,
    false,
    'cafe_to_walk must be OR-gated (allMustPass=false) so any one trigger can advance the phase'
  );

  const conds = edge!.conditions;
  const hasDominanceDrop = conds.some(
    (c) =>
      c.type === 'emotion' &&
      c.field === 'dominance' &&
      c.op === '<=' &&
      c.value <= -0.3
  );
  const hasTimeAdvance = conds.some(
    (c) =>
      c.type === 'time' &&
      c.field === 'turnsSinceLastTransition' &&
      c.value >= 4
  );
  assert.ok(hasDominanceDrop, 'cafe_to_walk must have emotion.dominance<=-0.3 condition');
  assert.ok(hasTimeAdvance, 'cafe_to_walk must have time.turnsSinceLastTransition>=4 condition');
});

test('T-E: full push-pull wiring check (parameters + graph together)', () => {
  // If any of these decouple, the "push-pull" scenario breaks.
  assert.ok(seiraStyle.initiative < seiraStyle.directness + 0.15, 'initiative must not dominate directness');
  assert.ok(seiraEmotion.baselinePAD.dominance <= -0.2, 'baseline D must be clearly sub-zero');
  assert.ok(
    seiraEmotion.recovery.dominanceHalfLifeTurns >= 10,
    'D recovery half-life must be long enough for the dropped D to matter for several turns'
  );
});
