'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

interface ScenarioSet {
  id: string;
  characterId: string;
  name: string;
  description: string;
  version: number;
}

interface Character {
  id: string;
  slug: string;
  displayName: string;
}

export default function EvalsPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [scenarioSets, setScenarioSets] = useState<ScenarioSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const res = await fetch('/api/characters');
        const data = await res.json();
        setCharacters(data.characters || []);
        if (data.characters && data.characters.length > 0) {
          setSelectedCharacterId(data.characters[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch characters:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">完了</span>;
      case 'running':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">実行中</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">失敗</span>;
      case 'pending':
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">待機中</span>;
    }
  };

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Evaluations</h1>
          <p className="mt-2 text-sm text-gray-700">
            シナリオパックを実行してキャラクターの品質を評価
          </p>
        </div>
        <button
          disabled
          className="mt-4 sm:mt-0 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          新規Eval実行
        </button>
      </div>

      {/* Character Selector */}
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

      {/* Scenario Sets */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">シナリオセット</h2>
        <div className="bg-white rounded-lg shadow">
          {scenarioSets.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">シナリオセットがありません</p>
              <p className="text-sm text-gray-400">
                シナリオセットを作成するには、<code className="bg-gray-100 px-1 rounded">tests/evals/</code> ディレクトリにケースを追加してください
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {scenarioSets.map((set) => (
                <div key={set.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{set.name}</h3>
                    <p className="text-sm text-gray-500">{set.description}</p>
                    <p className="text-xs text-gray-400 mt-1">v{set.version}</p>
                  </div>
                  <button
                    disabled
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                  >
                    実行
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Eval Runs History */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">実行履歴</h2>
        <div className="bg-white rounded-lg shadow">
          {evalRuns.length === 0 ? (
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
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-600">
                        Total: {run.summary.totalCases}
                      </span>
                      <span className="text-green-600">
                        Pass: {run.summary.passed}
                      </span>
                      <span className="text-red-600">
                        Fail: {run.summary.failed}
                      </span>
                      <span className="text-blue-600">
                        Avg: {(run.summary.avgScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scorer Info */}
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

      {/* Coming Soon Notice */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="text-sm font-medium text-yellow-900 mb-2">Coming Soon</h3>
        <p className="text-sm text-yellow-700">
          評価システムは現在開発中です。シナリオセットの作成、自動評価実行、
          結果の詳細表示機能が今後追加される予定です。
        </p>
      </div>
    </div>
  );
}
