import { generateObject } from 'ai';
import { z } from 'zod';
import { EmotionNarrativeSchema, type EmotionNarrative } from '@/lib/schemas/narrative';
import { getProviderRegistry, type ProviderRegistry } from '../providers/registry';
import type {
  ExtractedInteractionAct,
  RelationalAppraisal,
  PADState,
  RelationshipMetrics,
} from '@/lib/schemas';

export type EmotionNarratorInput = {
  userMessage: string;
  assistantMessage: string;
  interactionActs: ExtractedInteractionAct[];
  relationalAppraisal: RelationalAppraisal;
  emotionBefore: PADState;
  emotionAfter: PADState;
  relationshipBefore: RelationshipMetrics;
  relationshipAfter: RelationshipMetrics;
  characterName: string;
  currentPhaseId: string;
};

type NarratorGenerateObject = (input: {
  model: unknown;
  schema: z.ZodTypeAny;
  system: string;
  prompt: string;
}) => Promise<{ object: unknown }>;

type NarratorDeps = {
  generateObject?: NarratorGenerateObject;
  registry?: Pick<ProviderRegistry, 'getModel' | 'getModelInfo'>;
};

function formatPADDelta(before: PADState, after: PADState): string {
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
  return `快${fmt(after.pleasure - before.pleasure)} / 覚醒${fmt(after.arousal - before.arousal)} / 支配感${fmt(after.dominance - before.dominance)}`;
}

function formatRelDelta(before: RelationshipMetrics, after: RelationshipMetrics): string {
  const parts: string[] = [];
  const d = (key: keyof RelationshipMetrics) => {
    const diff = after[key] - before[key];
    if (Math.abs(diff) >= 0.5) parts.push(`${key}: ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`);
  };
  d('affinity');
  d('trust');
  d('intimacyReadiness');
  d('conflict');
  return parts.length > 0 ? parts.join(', ') : 'ほぼ変化なし';
}

const SYSTEM_PROMPT = `あなたは感情分析レポーターです。チャットターンの感情変化を、第三者の客観的な視点で簡潔に日本語で報告してください。

## 出力ルール
- characterNarrative: キャラクターの感情がどう変化したかを1〜3文で。ユーザーの具体的な発言を引用して因果を示す。
- relationshipNarrative: 関係性指標への影響を1文で。
- drivers: 感情変化の主要ドライバーを1〜3個。「{行為} → {軸} {変化量}」の形式。

## 制約
- 第三者の客観的な視点で書く（キャラ一人称NG）
- 抽象的な表現を避け、具体的な発言やaction actを参照する
- 各フィールドは必ず日本語で書く`;

export async function runEmotionNarrator(
  input: EmotionNarratorInput,
  deps: NarratorDeps = {}
): Promise<EmotionNarrative> {
  const gen = deps.generateObject ?? generateObject;
  const registry = deps.registry ?? getProviderRegistry();

  const actsText = input.interactionActs
    .map((act) => {
      const spans = act.evidenceSpans.map((s) => `"${s.text}"`).join(', ');
      return `- ${act.act} (${act.polarity}, intensity=${act.intensity.toFixed(2)}): ${spans}`;
    })
    .join('\n');

  const appraisalText = Object.entries(input.relationalAppraisal)
    .map(([key, val]) => `${key}: ${(val as number).toFixed(2)}`)
    .join(', ');

  const prompt = `## ターンデータ

ユーザー発言: "${input.userMessage}"
キャラクター応答: "${input.assistantMessage}"
キャラクター名: ${input.characterName}
フェーズ: ${input.currentPhaseId}

## 抽出された行為
${actsText}

## 関係性評価
${appraisalText}

## 感情変化 (PAD)
${formatPADDelta(input.emotionBefore, input.emotionAfter)}
Before: P=${input.emotionBefore.pleasure.toFixed(2)} A=${input.emotionBefore.arousal.toFixed(2)} D=${input.emotionBefore.dominance.toFixed(2)}
After:  P=${input.emotionAfter.pleasure.toFixed(2)} A=${input.emotionAfter.arousal.toFixed(2)} D=${input.emotionAfter.dominance.toFixed(2)}

## 関係性指標変化
${formatRelDelta(input.relationshipBefore, input.relationshipAfter)}

上記データに基づき、感情変化の要約を生成してください。`;

  const { object } = await gen({
    model: registry.getModel('analysisMedium'),
    schema: EmotionNarrativeSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  return EmotionNarrativeSchema.parse(object);
}
