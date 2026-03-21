'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Character {
  id: string;
  slug: string;
  displayName: string;
}

interface ScenarioSet {
  key: string;
  name: string;
  description: string;
  caseCount: number;
}

interface EvalRun {
  id: string;
  scenarioSetId: string;
  characterVersionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    avgScore: number;
  } | null;
  createdAt: string;
}

interface EvalCaseResult {
  id: string;
  scenarioCaseId: string;
  passed: boolean;
  traceId: string;
  failureReasons: string[];
  scores: Record<string, number>;
  createdAt: string;
}

interface CurrentVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  status: string;
}

export default function EvalsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [scenarioSets, setScenarioSets] = useState<ScenarioSet[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [currentVersion, setCurrentVersion] = useState<CurrentVersion | null>(null);
  const [latestCaseResults, setLatestCaseResults] = useState<EvalCaseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [runningScenarioKey, setRunningScenarioKey] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const res = await fetch('/api/characters');
        const data = await res.json();
        const nextCharacters = data.characters || [];
        setCharacters(nextCharacters);
        if (nextCharacters.length > 0) {
          setSelectedCharacterId(nextCharacters[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch characters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
  }, []);

  const fetchEvalData = useCallback(async () => {
    if (!selectedCharacterId) {
      return;
    }

    try {
      setDataLoading(true);
      const res = await fetch(`/api/evals?characterId=${selectedCharacterId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch eval data');
      }

      const data = await res.json();
      const nextEvalRuns = data.evalRuns || [];
      setScenarioSets(data.scenarioSets || []);
      setEvalRuns(nextEvalRuns);
      setCurrentVersion(data.currentVersion ?? null);
      setLatestCaseResults(data.latestCaseResults || []);

      const hasInFlightRun = nextEvalRuns.some(
        (run: EvalRun) => run.status === 'pending' || run.status === 'running'
      );

      if (!hasInFlightRun) {
        setRunningScenarioKey(null);
      }
    } catch (error) {
      console.error('Failed to fetch eval data:', error);
      setScenarioSets([]);
      setEvalRuns([]);
      setCurrentVersion(null);
    } finally {
      setDataLoading(false);
    }
  }, [selectedCharacterId]);

  useEffect(() => {
    void fetchEvalData();
  }, [fetchEvalData]);

  useEffect(() => {
    const hasInFlightRun = evalRuns.some(
      (run) => run.status === 'pending' || run.status === 'running'
    );

    if (!hasInFlightRun || !selectedCharacterId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchEvalData();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [evalRuns, fetchEvalData, selectedCharacterId]);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );

  const handleRun = async (scenarioSetKey: string) => {
    if (!selectedCharacterId) {
      return;
    }

    setRunError(null);
    setRunningScenarioKey(scenarioSetKey);

    try {
      const res = await fetch('/api/evals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: selectedCharacterId,
          scenarioSetKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Eval run failed');
      }

      if (data.evalRun) {
        setEvalRuns((prev) => [data.evalRun, ...prev.filter((run) => run.id !== data.evalRun.id)]);
      }

      await fetchEvalData();
    } catch (error) {
      console.error('Eval run failed:', error);
      setRunError(error instanceof Error ? error.message : 'Eval run failed');
      setRunningScenarioKey(null);
    }
  };

  const hasInFlightRun = evalRuns.some(
    (run) => run.status === 'pending' || run.status === 'running'
  );

  const getStatusBadge = (status: EvalRun['status']) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">完了</span>;
      case 'running':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">実行中</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">失敗</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">待機中</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">評価</h1>
          <p className="mt-2 text-sm text-gray-700">
            シナリオパックを実行してキャラクターの品質を評価
          </p>
        </div>
        <div className="mt-4 sm:mt-0 text-sm text-gray-600">
          {dataLoading ? (
            <span>評価データを読み込み中...</span>
          ) : selectedCharacter && currentVersion ? (
            <span>
              {selectedCharacter.displayName} / v{currentVersion.versionNumber}
              {currentVersion.label ? ` - ${currentVersion.label}` : ''}
            </span>
          ) : (
            <span>公開済みバージョンが必要です</span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          キャラクター選択
        </label>
        <select
          value={selectedCharacterId ?? ''}
          onChange={(e) => setSelectedCharacterId(e.target.value)}
          className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-pink-500 focus:border-pink-500"
        >
          {characters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.displayName} (@{char.slug})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">シナリオセット</h2>
        {hasInFlightRun && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            評価をバックグラウンド実行中です。履歴は自動更新されます。
          </div>
        )}
        {runError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {runError}
          </div>
        )}
        <div className="bg-white rounded-lg shadow">
          {dataLoading ? (
            <div className="p-6 text-center text-gray-500">
              評価データを読み込み中...
            </div>
          ) : scenarioSets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              シナリオセットがありません
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {scenarioSets.map((set) => (
                <div key={set.key} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{set.name}</h3>
                    <p className="text-sm text-gray-500">{set.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{set.caseCount} ケース</p>
                  </div>
                  <button
                    onClick={() => handleRun(set.key)}
                    disabled={!currentVersion || hasInFlightRun}
                    className="px-3 py-1.5 text-sm bg-pink-600 text-white rounded hover:bg-pink-700 disabled:opacity-50"
                  >
                    {runningScenarioKey === set.key || (hasInFlightRun && runningScenarioKey === null)
                      ? '実行中...'
                      : '実行'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">実行履歴</h2>
        <div className="bg-white rounded-lg shadow">
          {dataLoading ? (
            <div className="p-6 text-center text-gray-500">
              実行履歴を読み込み中...
            </div>
          ) : evalRuns.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              評価実行履歴がありません
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {evalRuns.map((run) => (
                <div key={run.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{run.id.slice(0, 8)}...</span>
                      {getStatusBadge(run.status)}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(run.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  {run.summary && (
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-600">合計: {run.summary.totalCases}</span>
                      <span className="text-green-600">成功: {run.summary.passed}</span>
                      <span className="text-red-600">失敗: {run.summary.failed}</span>
                      <span className="text-blue-600">
                        平均: {(run.summary.avgScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {latestCaseResults.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">直近の完了ケース結果</h2>
          <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
            {latestCaseResults.map((result) => (
              <div key={result.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-gray-700">
                    {result.scenarioCaseId.slice(0, 8)}...
                  </span>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      result.passed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {result.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(result.scores).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 text-xs bg-gray-100 rounded text-gray-700">
                      {key}: {(value * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
                {result.failureReasons.length > 0 && (
                  <ul className="mt-3 list-disc list-inside text-sm text-red-700 space-y-1">
                    {result.failureReasons.map((reason, index) => (
                      <li key={`${result.id}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Trace: {result.traceId}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">利用可能なスコアラー</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'persona_consistency', desc: 'キャラクターらしさ' },
            { name: 'phase_compliance', desc: 'フェーズ準拠' },
            { name: 'memory_grounding', desc: 'メモリ活用' },
            { name: 'emotional_coherence', desc: '感情的整合性' },
            { name: 'autonomy', desc: '自律性（非迎合）' },
            { name: 'refusal_naturalness', desc: '拒否の自然さ' },
            { name: 'contradiction_penalty', desc: '矛盾ペナルティ' },
          ].map((scorer) => (
            <div key={scorer.name} className="p-3 bg-gray-50 rounded">
              <p className="font-mono text-sm text-gray-900">{scorer.name}</p>
              <p className="text-xs text-gray-500 mt-1">{scorer.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
