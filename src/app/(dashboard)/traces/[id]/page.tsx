'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CoEExplanationCard } from '@/components/CoEExplanationCard';
import { buildCoEExplanation } from '@/lib/rules/coe';

interface PADState {
  pleasure: number;
  arousal: number;
  dominance: number;
}

interface AppraisalVector {
  goalCongruence: number;
  controllability: number;
  certainty: number;
  normAlignment: number;
  attachmentSecurity: number;
  reciprocity: number;
  pressureIntrusiveness: number;
  novelty: number;
  selfRelevance: number;
}

interface Candidate {
  index: number;
  text: string;
  scores: {
    personaConsistency: number;
    phaseCompliance: number;
    memoryGrounding: number;
    emotionalCoherence: number;
    autonomy: number;
    naturalness: number;
    overall: number;
  };
  rejected: boolean;
  rejectionReason: string | null;
}

interface TurnTrace {
  id: string;
  pairId: string;
  characterVersionId: string;
  promptBundleVersionId: string;
  modelIds: {
    planner: string;
    generator: string;
    ranker: string;
    extractor: string | null;
  };
  phaseIdBefore: string;
  phaseIdAfter: string;
  emotionBefore: PADState;
  emotionAfter: PADState;
  appraisal: AppraisalVector;
  retrievedMemoryIds: {
    events: string[];
    facts: string[];
    observations: string[];
    threads: string[];
  };
  plan: {
    stance: string;
    primaryActs: string[];
    secondaryActs: string[];
    intimacyDecision: string;
    plannerReasoning: string;
    mustAvoid: string[];
    emotionDeltaIntent?: {
      pleasureDelta: number;
      arousalDelta: number;
      dominanceDelta: number;
      reason: string;
    };
  };
  candidates: Candidate[];
  winnerIndex: number;
  memoryWrites: Array<{ type: string; summary: string }>;
  userMessage: string;
  assistantMessage: string;
  createdAt: string;
}

export default function TraceViewerPage() {
  const params = useParams();
  const traceId = params.id as string;

  const [trace, setTrace] = useState<TurnTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrace = async () => {
      try {
        const res = await fetch(`/api/traces/${traceId}`);
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setTrace(data.trace);
        }
      } catch (err) {
        setError('Failed to fetch trace');
      } finally {
        setLoading(false);
      }
    };
    fetchTrace();
  }, [traceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error ?? 'Trace not found'}</p>
        <Link href="/playground" className="mt-4 text-pink-600 hover:underline">
          Playgroundに戻る
        </Link>
      </div>
    );
  }

  const formatPAD = (pad: PADState) =>
    `P:${pad.pleasure.toFixed(2)} A:${pad.arousal.toFixed(2)} D:${pad.dominance.toFixed(2)}`;

  const getPADChange = (before: PADState, after: PADState) => {
    const changes = [];
    const pDiff = after.pleasure - before.pleasure;
    const aDiff = after.arousal - before.arousal;
    const dDiff = after.dominance - before.dominance;

    if (Math.abs(pDiff) > 0.05) changes.push(`P ${pDiff > 0 ? '+' : ''}${pDiff.toFixed(2)}`);
    if (Math.abs(aDiff) > 0.05) changes.push(`A ${aDiff > 0 ? '+' : ''}${aDiff.toFixed(2)}`);
    if (Math.abs(dDiff) > 0.05) changes.push(`D ${dDiff > 0 ? '+' : ''}${dDiff.toFixed(2)}`);

    return changes.length > 0 ? changes.join(', ') : 'No significant change';
  };

  const coe = buildCoEExplanation({
    emotionBefore: trace.emotionBefore,
    emotionAfter: trace.emotionAfter,
    appraisal: trace.appraisal,
    intentReason: trace.plan.emotionDeltaIntent?.reason ?? null,
    intentDelta: trace.plan.emotionDeltaIntent
      ? {
          pleasure: trace.plan.emotionDeltaIntent.pleasureDelta,
          arousal: trace.plan.emotionDeltaIntent.arousalDelta,
          dominance: trace.plan.emotionDeltaIntent.dominanceDelta,
        }
      : null,
  });

  return (
    <div className="px-4 sm:px-0 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">トレースビューア</h1>
            <p className="text-sm text-gray-500 font-mono">{trace.id}</p>
          </div>
          <Link
            href="/playground"
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Playgroundに戻る
          </Link>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {new Date(trace.createdAt).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">メッセージ</h2>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-600 mb-1">ユーザー</p>
            <p className="text-sm text-gray-900">{trace.userMessage}</p>
          </div>
          <div className="p-3 bg-pink-50 rounded-lg">
            <p className="text-xs font-medium text-pink-600 mb-1">キャラクター</p>
            <p className="text-sm text-gray-900">{trace.assistantMessage}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Phase Transition */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">フェーズ</h2>
          <div className="flex items-center gap-4">
            <div className="px-3 py-2 bg-gray-100 rounded text-sm font-mono">
              {trace.phaseIdBefore}
            </div>
            <span className="text-gray-400">→</span>
            <div
              className={`px-3 py-2 rounded text-sm font-mono ${
                trace.phaseIdBefore !== trace.phaseIdAfter
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100'
              }`}
            >
              {trace.phaseIdAfter}
            </div>
          </div>
        </div>

        {/* Emotion (PAD) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">感情 (PAD)</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変化前:</span>
              <span className="font-mono">{formatPAD(trace.emotionBefore)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">変化後:</span>
              <span className="font-mono">{formatPAD(trace.emotionAfter)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">差分:</span>
              <span className="font-mono text-pink-600">
                {getPADChange(trace.emotionBefore, trace.emotionAfter)}
              </span>
            </div>
          </div>
          <CoEExplanationCard coe={coe} variant="detailed" className="mt-4" />
        </div>

        {/* Appraisal */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">アプレイザルベクトル</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(trace.appraisal).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-500 text-xs">{key}:</span>
                <span className="font-mono">{(value as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">ターンプラン</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Stance</dt>
              <dd className="font-medium">{trace.plan.stance}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Primary Acts</dt>
              <dd className="flex flex-wrap gap-1 mt-1">
                {trace.plan.primaryActs.map((act, i) => (
                  <span key={i} className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded">
                    {act}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Intimacy Decision</dt>
              <dd>{trace.plan.intimacyDecision}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Must Avoid</dt>
              <dd>{trace.plan.mustAvoid.length > 0 ? trace.plan.mustAvoid.join(', ') : 'None'}</dd>
            </div>
          </dl>
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-500 mb-1">Planner Reasoning:</p>
            <p className="text-sm text-gray-700">{trace.plan.plannerReasoning}</p>
          </div>
        </div>

        {/* Retrieved Memory */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">取得されたメモリ</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Events:</dt>
              <dd>{trace.retrievedMemoryIds.events.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Facts:</dt>
              <dd>{trace.retrievedMemoryIds.facts.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Observations:</dt>
              <dd>{trace.retrievedMemoryIds.observations.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Threads:</dt>
              <dd>{trace.retrievedMemoryIds.threads.length}</dd>
            </div>
          </dl>
        </div>

        {/* Memory Writes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">メモリ書き込み</h2>
          {trace.memoryWrites.length === 0 ? (
            <p className="text-sm text-gray-500">メモリ書き込みなし</p>
          ) : (
            <ul className="space-y-2">
              {trace.memoryWrites.map((write, i) => (
                <li key={i} className="text-sm">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded mr-2">
                    {write.type}
                  </span>
                  <span className="text-gray-700">{write.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Candidates */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          候補 ({trace.candidates.length})
        </h2>
        <div className="space-y-4">
          {trace.candidates.map((candidate) => (
            <div
              key={candidate.index}
              className={`p-4 rounded-lg border-2 ${
                candidate.index === trace.winnerIndex
                  ? 'border-green-400 bg-green-50'
                  : candidate.rejected
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">候補 {candidate.index}</span>
                  {candidate.index === trace.winnerIndex && (
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                      採用
                    </span>
                  )}
                  {candidate.rejected && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded">
                      却下
                    </span>
                  )}
                </div>
                <span className="text-sm font-mono text-gray-500">
                  overall: {(candidate.scores.overall * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-gray-900 mb-3">{candidate.text}</p>
              {candidate.rejectionReason && (
                <p className="text-sm text-red-600 mb-2">理由: {candidate.rejectionReason}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(candidate.scores)
                  .filter(([k]) => k !== 'overall')
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className={`px-2 py-0.5 rounded ${
                        value >= 0.7
                          ? 'bg-green-100 text-green-700'
                          : value >= 0.4
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {key}: {(value * 100).toFixed(0)}%
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Info */}
      <div className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">モデル情報</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Planner</dt>
            <dd className="font-mono text-xs">{trace.modelIds.planner}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Generator</dt>
            <dd className="font-mono text-xs">{trace.modelIds.generator}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Ranker</dt>
            <dd className="font-mono text-xs">{trace.modelIds.ranker}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Extractor</dt>
            <dd className="font-mono text-xs">{trace.modelIds.extractor ?? 'N/A'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
