'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LabelWithTooltip, Tooltip, PARAM_DESCRIPTIONS } from '@/components/Tooltip';

interface CharacterVersion {
  id: string;
  characterId: string;
  versionNumber: number;
  status: string;
  persona: {
    summary: string;
    values: string[];
    flaws: string[];
    insecurities: string[];
    likes: string[];
    dislikes: string[];
    signatureBehaviors: string[];
    authoredExamples: {
      warm?: string[];
      playful?: string[];
      guarded?: string[];
      conflict?: string[];
    };
    innerWorld?: {
      coreDesire: string;
      fear: string;
      wound?: string;
      coping?: string;
      growthArc?: string;
    };
    surfaceLoop?: {
      defaultMood: string;
      stressBehavior: string;
      joyBehavior: string;
      conflictStyle: string;
      affectionStyle: string;
    };
    anchors?: Array<{
      key: string;
      label: string;
      description: string;
      emotionalSignificance: string;
    }>;
  };
  style: {
    language: string;
    politenessDefault: string;
    terseness: number;
    directness: number;
    playfulness: number;
    teasing: number;
    initiative: number;
    emojiRate: number;
    sentenceLengthBias: string;
    tabooPhrases: string[];
    signaturePhrases: string[];
  };
  autonomy: {
    disagreeReadiness: number;
    refusalReadiness: number;
    delayReadiness: number;
    repairReadiness: number;
    conflictCarryover: number;
    intimacyNeverOnDemand: boolean;
  };
  emotion: {
    baselinePAD: { pleasure: number; arousal: number; dominance: number };
  };
  memory: {
    eventSalienceThreshold: number;
    factConfidenceThreshold: number;
    retrievalTopK: { episodes: number; facts: number; observations: number };
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

interface Workspace {
  id: string;
  characterId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function CharacterDetailPage() {
  const params = useParams();
  const characterId = params.id as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [version, setVersion] = useState<CharacterVersion | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'workspace'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [charRes, wsRes] = await Promise.all([
          fetch(`/api/characters/${characterId}`),
          fetch(`/api/workspaces?characterId=${characterId}`),
        ]);

        const charData = await charRes.json();
        setCharacter(charData.character);
        setVersion(charData.latestVersion);

        const wsData = await wsRes.json();
        setWorkspaces(Array.isArray(wsData) ? wsData : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
          <div className="flex items-center gap-3">
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
            {workspaces.length > 0 && (
              <Link
                href={`/playground?workspaceId=${workspaces[0].id}`}
                className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm font-medium"
              >
                サンドボックス
              </Link>
            )}
          </div>
        </div>

        {/* Sub Navigation */}
        <nav className="mt-4 flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'overview'
                ? 'text-pink-600 border-pink-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            概要
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'workspace'
                ? 'text-pink-600 border-pink-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            ワークスペース
          </button>
          <Link
            href={`/characters/${characterId}/phases`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            フェーズ
          </Link>
          <Link
            href={`/characters/${characterId}/memory`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            メモリ
          </Link>
        </nav>
      </div>

      {activeTab === 'workspace' ? (
        <WorkspaceTab characterId={characterId} workspaces={workspaces} setWorkspaces={setWorkspaces} />
      ) : (
        <OverviewTab version={version} />
      )}
    </div>
  );
}

function OverviewTab({ version }: { version: CharacterVersion | null }) {
  if (!version) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
        <p className="text-gray-500">バージョンがありません</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Persona Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">ペルソナ</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium">
              <LabelWithTooltip label="サマリー" paramKey="summary" className="text-gray-500" />
            </dt>
            <dd className="text-sm text-gray-900 mt-1">{version.persona.summary}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium">
              <LabelWithTooltip label="価値観" paramKey="values" className="text-gray-500" />
            </dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {version.persona.values.map((value, i) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                  {value}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">
              <LabelWithTooltip label="欠点" paramKey="flaws" className="text-gray-500" />
            </dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {version.persona.flaws.map((flaw, i) => (
                <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {flaw}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">
              <LabelWithTooltip label="好きなもの" paramKey="likes" className="text-gray-500" />
            </dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {version.persona.likes.map((like, i) => (
                <span key={i} className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded">
                  {like}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">
              <LabelWithTooltip label="嫌いなもの" paramKey="dislikes" className="text-gray-500" />
            </dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {version.persona.dislikes.map((d, i) => (
                <span key={i} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                  {d}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>

      {/* Style Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">スタイル</h2>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <LabelWithTooltip label="敬語レベル" paramKey="politenessDefault" className="text-gray-500" />
            <span className="text-gray-900">{version.style.politenessDefault}</span>
          </div>
          {[
            { key: 'terseness' as const, label: '簡潔さ' },
            { key: 'directness' as const, label: '直接性' },
            { key: 'playfulness' as const, label: '遊び心' },
            { key: 'teasing' as const, label: 'からかい' },
            { key: 'initiative' as const, label: '主導性' },
            { key: 'emojiRate' as const, label: '絵文字率' },
          ].map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between text-sm">
                <LabelWithTooltip label={label} paramKey={key} className="text-gray-500" />
                <span className="text-gray-900">
                  {(version.style[key] * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-500 rounded-full"
                  style={{ width: `${version.style[key] * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div>
            <dt className="text-sm font-medium text-gray-500 mt-4">
              <LabelWithTooltip label="シグネチャフレーズ" paramKey="signaturePhrases" className="text-gray-500" />
            </dt>
            <dd className="flex flex-wrap gap-1 mt-2">
              {version.style.signaturePhrases.map((p, i) => (
                <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                  {p}
                </span>
              ))}
            </dd>
          </div>
        </div>
      </div>

      {/* Autonomy Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">自律性</h2>
        <div className="space-y-4">
          {[
            { key: 'disagreeReadiness' as const, label: '反論しやすさ' },
            { key: 'refusalReadiness' as const, label: '断りやすさ' },
            { key: 'delayReadiness' as const, label: '待たせやすさ' },
            { key: 'repairReadiness' as const, label: '仲直りしやすさ' },
            { key: 'conflictCarryover' as const, label: '引きずりやすさ' },
          ].map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between text-sm">
                <LabelWithTooltip label={label} paramKey={key} className="text-gray-500" />
                <span className="text-gray-900">
                  {(version.autonomy[key] * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${version.autonomy[key] * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <LabelWithTooltip label="親密さはオンデマンド不可" paramKey="intimacyNeverOnDemand" className="text-sm text-gray-500" />
            <span className={`px-2 py-1 rounded text-xs ${
              version.autonomy.intimacyNeverOnDemand
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {version.autonomy.intimacyNeverOnDemand ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      {/* Emotion Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">感情ベースライン</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <LabelWithTooltip label="快" paramKey="pleasure" className="text-gray-500" />
              <span className="font-mono">{version.emotion.baselinePAD.pleasure.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${(version.emotion.baselinePAD.pleasure + 1) * 50}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <LabelWithTooltip label="覚醒" paramKey="arousal" className="text-gray-500" />
              <span className="font-mono">{version.emotion.baselinePAD.arousal.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full"
                style={{ width: `${(version.emotion.baselinePAD.arousal + 1) * 50}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <LabelWithTooltip label="支配感" paramKey="dominance" className="text-gray-500" />
              <span className="font-mono">{version.emotion.baselinePAD.dominance.toFixed(2)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(version.emotion.baselinePAD.dominance + 1) * 50}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inner World Panel */}
      {version.persona.innerWorld && (
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">インナーワールド</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium">
                <LabelWithTooltip label="コア欲求" paramKey="coreDesire" className="text-gray-500" />
              </dt>
              <dd className="text-sm text-gray-900 mt-1">{version.persona.innerWorld.coreDesire}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium">
                <LabelWithTooltip label="恐れ" paramKey="fear" className="text-gray-500" />
              </dt>
              <dd className="text-sm text-gray-900 mt-1">{version.persona.innerWorld.fear}</dd>
            </div>
            {version.persona.innerWorld.wound && (
              <div>
                <dt className="text-sm font-medium">
                  <LabelWithTooltip label="傷" paramKey="wound" className="text-gray-500" />
                </dt>
                <dd className="text-sm text-gray-900 mt-1">{version.persona.innerWorld.wound}</dd>
              </div>
            )}
            {version.persona.innerWorld.coping && (
              <div>
                <dt className="text-sm font-medium">
                  <LabelWithTooltip label="対処法" paramKey="coping" className="text-gray-500" />
                </dt>
                <dd className="text-sm text-gray-900 mt-1">{version.persona.innerWorld.coping}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Anchors Panel */}
      {version.persona.anchors && version.persona.anchors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-gray-900 mb-4">アンカー</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {version.persona.anchors.map((anchor) => (
              <div key={anchor.key} className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900">{anchor.label}</h3>
                <p className="text-sm text-gray-600 mt-1">{anchor.description}</p>
                <p className="text-xs text-gray-500 mt-2 italic">{anchor.emotionalSignificance}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authored Examples */}
      <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
        <h2 className="text-lg font-medium text-gray-900 mb-4">オーサードサンプル</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {version.persona.authoredExamples.warm && (
            <div>
              <h3 className="text-sm font-medium text-pink-600 mb-2">Warm</h3>
              <ul className="space-y-1">
                {version.persona.authoredExamples.warm.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-3 border-l-2 border-pink-200">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {version.persona.authoredExamples.playful && (
            <div>
              <h3 className="text-sm font-medium text-purple-600 mb-2">Playful</h3>
              <ul className="space-y-1">
                {version.persona.authoredExamples.playful.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-3 border-l-2 border-purple-200">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {version.persona.authoredExamples.guarded && (
            <div>
              <h3 className="text-sm font-medium text-yellow-600 mb-2">Guarded</h3>
              <ul className="space-y-1">
                {version.persona.authoredExamples.guarded.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-3 border-l-2 border-yellow-200">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {version.persona.authoredExamples.conflict && (
            <div>
              <h3 className="text-sm font-medium text-red-600 mb-2">Conflict</h3>
              <ul className="space-y-1">
                {version.persona.authoredExamples.conflict.map((ex, i) => (
                  <li key={i} className="text-sm text-gray-700 pl-3 border-l-2 border-red-200">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab({
  characterId,
  workspaces,
  setWorkspaces
}: {
  characterId: string;
  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          name: newName,
          createdBy: 'dashboard',
        }),
      });

      if (res.ok) {
        const newWorkspace = await res.json();
        setWorkspaces([newWorkspace, ...workspaces]);
        setNewName('');
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Workspace */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">新規ワークスペース</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ワークスペース名"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
          >
            {creating ? '作成中...' : '作成'}
          </button>
        </div>
      </div>

      {/* Workspace List */}
      {workspaces.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">ワークスペースがありません</p>
          <p className="text-sm text-gray-400 mt-1">上のフォームから作成してください</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((ws) => (
            <div key={ws.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{ws.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    更新: {new Date(ws.updatedAt).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/characters/${characterId}/workspace/${ws.id}`}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                >
                  編集
                </Link>
                <Link
                  href={`/playground?workspaceId=${ws.id}`}
                  className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded text-sm hover:bg-pink-200"
                >
                  サンドボックス
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
