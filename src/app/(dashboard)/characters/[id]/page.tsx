'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface CharacterVersion {
  id: string;
  characterId: string;
  versionNumber: number;
  status: string;
  persona: {
    name: string;
    age: number;
    occupation: string;
    coreTraits: string[];
    background: string;
    values: string[];
    flaws: string[];
  };
  style: {
    formality: number;
    verbosity: number;
    emoji: number;
    humor: number;
    assertiveness: number;
  };
  autonomy: {
    boundaries: string[];
    redirectStrategies: string[];
    refusalPatterns: string[];
    repairPatterns: string[];
  };
  emotion: {
    initialPAD: { P: number; A: number; D: number };
    moodInertia: number;
    expressionThresholds: {
      joyThreshold: number;
      sadnessThreshold: number;
      angerThreshold: number;
    };
  };
  memory: {
    eventRetention: string;
    factRetention: string;
    consolidationInterval: string;
    maxWorkingMemoryTokens: number;
  };
  createdAt: string;
  createdBy: string;
}

interface Character {
  id: string;
  slug: string;
  displayName: string;
  createdAt: string;
}

export default function CharacterDetailPage() {
  const params = useParams();
  const characterId = params.id as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [version, setVersion] = useState<CharacterVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}`);
        const data = await res.json();
        setCharacter(data.character);
        setVersion(data.latestVersion);
      } catch (error) {
        console.error('Failed to fetch character:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacter();
  }, [characterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">キャラクターが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {character.displayName}
            </h1>
            <p className="text-sm text-gray-500">@{character.slug}</p>
          </div>
          {version && (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                version.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              v{version.versionNumber} ({version.status})
            </span>
          )}
        </div>

        {/* Sub Navigation */}
        <nav className="mt-4 flex space-x-4">
          <Link
            href={`/characters/${characterId}`}
            className="px-3 py-2 text-sm font-medium text-pink-600 border-b-2 border-pink-600"
          >
            Overview
          </Link>
          <Link
            href={`/characters/${characterId}/phases`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Phases
          </Link>
          <Link
            href={`/characters/${characterId}/memory`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Memory
          </Link>
        </nav>
      </div>

      {!version ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">バージョンがありません</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Persona Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Persona</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">名前</dt>
                <dd className="text-sm text-gray-900">{version.persona.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">年齢</dt>
                <dd className="text-sm text-gray-900">{version.persona.age}歳</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">職業</dt>
                <dd className="text-sm text-gray-900">{version.persona.occupation}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">背景</dt>
                <dd className="text-sm text-gray-900">{version.persona.background}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">特性</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {version.persona.coreTraits.map((trait, i) => (
                    <span key={i} className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded">
                      {trait}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">価値観</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {version.persona.values.map((value, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {value}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">欠点</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {version.persona.flaws.map((flaw, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {flaw}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          {/* Style Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Style</h2>
            <div className="space-y-4">
              {Object.entries(version.style).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-500 capitalize">{key}</span>
                    <span className="text-gray-900">{(value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomy Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Autonomy</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">境界線</dt>
                <dd className="mt-1">
                  <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                    {version.autonomy.boundaries.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">リダイレクト戦略</dt>
                <dd className="mt-1">
                  <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                    {version.autonomy.redirectStrategies.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>

          {/* Emotion Panel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Emotion</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">初期PAD状態</dt>
                <dd className="flex gap-4 mt-1">
                  <span className="text-sm">
                    P: <span className="font-mono">{version.emotion.initialPAD.P}</span>
                  </span>
                  <span className="text-sm">
                    A: <span className="font-mono">{version.emotion.initialPAD.A}</span>
                  </span>
                  <span className="text-sm">
                    D: <span className="font-mono">{version.emotion.initialPAD.D}</span>
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ムード慣性</dt>
                <dd className="text-sm text-gray-900">{version.emotion.moodInertia}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">表出閾値</dt>
                <dd className="text-sm text-gray-900 space-y-1 mt-1">
                  <div>喜び: {version.emotion.expressionThresholds.joyThreshold}</div>
                  <div>悲しみ: {version.emotion.expressionThresholds.sadnessThreshold}</div>
                  <div>怒り: {version.emotion.expressionThresholds.angerThreshold}</div>
                </dd>
              </div>
            </dl>
          </div>

          {/* Memory Policy Panel */}
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Memory Policy</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">イベント保持期間</dt>
                <dd className="text-sm text-gray-900">{version.memory.eventRetention}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ファクト保持期間</dt>
                <dd className="text-sm text-gray-900">{version.memory.factRetention}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">統合間隔</dt>
                <dd className="text-sm text-gray-900">{version.memory.consolidationInterval}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">最大作業メモリトークン</dt>
                <dd className="text-sm text-gray-900">{version.memory.maxWorkingMemoryTokens.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
