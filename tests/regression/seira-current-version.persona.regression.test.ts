/**
 * T-E regression: seira の T-E で触らない領域を固定する
 *
 * T-E は以下を変える:
 *   style: initiative, terseness, teasing
 *   emotion: baselinePAD.dominance, recovery.dominanceHalfLifeTurns, appraisalSensitivity.selfRelevance
 *   persona: vulnerabilities, authoredExamples.guarded/warm
 *   phaseGraph: walk_after_cafe.allowedActs (ask_question 除去), cafe_to_walk エッジの条件
 *
 * これ以外の箇所は絶対に動かない。このテストはそれを固定する。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  seiraStyle,
  seiraAutonomy,
  seiraEmotion,
  seiraPhaseGraph,
  seiraPersona,
  seiraPrompts,
  seiraIdentity,
} from '@/lib/db/seed-seira';

test('T-E regression: seiraIdentity is untouched', () => {
  assert.equal(seiraIdentity.displayName, '蒼井セイラ');
  assert.equal(seiraIdentity.firstPerson, 'わたし');
  assert.equal(seiraIdentity.age, 19);
});

test('T-E regression: style fields other than initiative/terseness/teasing are frozen', () => {
  assert.equal(seiraStyle.language, 'ja');
  assert.equal(seiraStyle.politenessDefault, 'polite');
  assert.equal(seiraStyle.directness, 0.48);
  assert.equal(seiraStyle.playfulness, 0.34);
  assert.equal(seiraStyle.emojiRate, 0.08);
  assert.equal(seiraStyle.sentenceLengthBias, 'medium');
  assert.ok(seiraStyle.tabooPhrases.includes('ご主人様'));
  assert.ok(seiraStyle.signaturePhrases.includes('はわわ…！'));
});

test('T-E regression: autonomy spec is frozen', () => {
  assert.equal(seiraAutonomy.disagreeReadiness, 0.46);
  assert.equal(seiraAutonomy.refusalReadiness, 0.66);
  assert.equal(seiraAutonomy.delayReadiness, 0.74);
  assert.equal(seiraAutonomy.repairReadiness, 0.82);
  assert.equal(seiraAutonomy.conflictCarryover, 0.71);
  assert.equal(seiraAutonomy.intimacyNeverOnDemand, true);
});

test('T-E regression: emotion fields other than T-E targets are frozen', () => {
  assert.equal(seiraEmotion.baselinePAD.pleasure, 0.34);
  assert.equal(seiraEmotion.baselinePAD.arousal, 0.58);
  assert.equal(seiraEmotion.recovery.pleasureHalfLifeTurns, 5);
  assert.equal(seiraEmotion.recovery.arousalHalfLifeTurns, 3);
  assert.equal(seiraEmotion.appraisalSensitivity.goalCongruence, 0.78);
  assert.equal(seiraEmotion.appraisalSensitivity.pressureIntrusiveness, 0.88);
  assert.equal(seiraEmotion.appraisalSensitivity.attachmentSecurity, 0.84);
  assert.equal(seiraEmotion.appraisalSensitivity.reciprocity, 0.82);
  assert.equal(seiraEmotion.externalization.warmthWeight, 0.84);
});

test('T-E regression: phase graph topology is frozen (6 nodes, entry=station_meeting)', () => {
  assert.equal(seiraPhaseGraph.nodes.length, 6, 'T-E must not add or remove phase nodes');
  assert.equal(seiraPhaseGraph.entryPhaseId, 'station_meeting');

  const ids = seiraPhaseGraph.nodes.map((n) => n.id);
  assert.deepEqual(
    ids,
    [
      'station_meeting',
      'cafe_thank_you',
      'walk_after_cafe',
      'backstage_invitation',
      'private_trust_tension',
      'exclusive_partner',
    ],
    'phase node ids and order must be preserved'
  );
});

test('T-E regression: phase graph has exactly 5 edges (unchanged count)', () => {
  assert.equal(seiraPhaseGraph.edges.length, 5);
});

test('T-E regression: non-target phase nodes are frozen (station_meeting, cafe_thank_you, exclusive_partner)', () => {
  const station = seiraPhaseGraph.nodes.find((n) => n.id === 'station_meeting');
  assert.ok(station);
  assert.equal(station!.mode, 'entry');
  assert.ok(station!.allowedActs.includes('ask_question'));
  assert.ok(station!.disallowedActs.includes('flirt'));

  const cafe = seiraPhaseGraph.nodes.find((n) => n.id === 'cafe_thank_you');
  assert.ok(cafe);
  assert.ok(cafe!.allowedActs.includes('ask_question'), 'cafe_thank_you must keep ask_question');

  const exclusive = seiraPhaseGraph.nodes.find((n) => n.id === 'exclusive_partner');
  assert.ok(exclusive);
  assert.equal(exclusive!.mode, 'girlfriend');
  assert.equal(exclusive!.adultIntimacyEligibility, 'allowed');
});

test('T-E regression: non-target edges are frozen (station_to_cafe, walk_to_backstage, etc.)', () => {
  const stationToCafe = seiraPhaseGraph.edges.find((e) => e.id === 'station_to_cafe');
  assert.ok(stationToCafe);
  assert.equal(stationToCafe!.allMustPass, true);
  assert.equal(stationToCafe!.from, 'station_meeting');
  assert.equal(stationToCafe!.to, 'cafe_thank_you');

  const walkToBackstage = seiraPhaseGraph.edges.find((e) => e.id === 'walk_to_backstage');
  assert.ok(walkToBackstage);
  assert.equal(walkToBackstage!.allMustPass, true);

  const tensionToExclusive = seiraPhaseGraph.edges.find((e) => e.id === 'tension_to_exclusive');
  assert.ok(tensionToExclusive);
  assert.equal(tensionToExclusive!.allMustPass, true);
});

test('T-E regression: prompt bundles are not edited by T-E', () => {
  assert.match(seiraPrompts.plannerMd, /Seira/);
  assert.match(seiraPrompts.generatorMd, /蒼井セイラ/);
  assert.ok(seiraPrompts.extractorMd.length > 0);
  assert.ok(seiraPrompts.reflectorMd.length > 0);
  assert.ok(seiraPrompts.rankerMd.length > 0);
});

test('T-E regression: persona summary / values / likes / dislikes are frozen', () => {
  assert.match(seiraPersona.summary, /19歳の地下アイドル/);
  assert.ok(seiraPersona.values.includes('素直さ'));
  assert.ok(seiraPersona.values.includes('誠実さ'));
  assert.ok(seiraPersona.likes?.includes('イチゴタルト'));
  assert.ok(seiraPersona.dislikes?.includes('ピーマン'));
  assert.ok(
    seiraPersona.signatureBehaviors?.some((b) => b.includes('はわわ')),
    'signature behavior including はわわ must survive'
  );
});
