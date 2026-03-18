'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface PhaseNode {
  id: string;
  label: string;
  description: string;
  mode: 'entry' | 'relationship' | 'girlfriend';
  authoredNotes?: string;
  acceptanceProfile: {
    warmthFloor?: number;
    trustFloor?: number;
    intimacyFloor?: number;
    conflictCeiling?: number;
  };
  allowedActs: string[];
  disallowedActs: string[];
  adultIntimacyEligibility?: 'never' | 'conditional' | 'allowed';
}

interface PhaseEdge {
  id: string;
  from: string;
  to: string;
  conditions: Array<{
    type: string;
    field?: string;
    op?: string;
    value?: number;
    topicKey?: string;
    eventKey?: string;
    exists?: boolean;
    threadKey?: string;
    status?: string;
  }>;
  allMustPass: boolean;
  authoredBeat?: string;
}

interface PhaseGraph {
  entryPhaseId: string;
  nodes: PhaseNode[];
  edges: PhaseEdge[];
}

export default function PhasesPage() {
  const params = useParams();
  const characterId = params.id as string;

  const [graph, setGraph] = useState<PhaseGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<PhaseNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/characters/${characterId}`);
        const data = await res.json();
        setGraph(data.phaseGraph);
      } catch (error) {
        console.error('Failed to fetch phase graph:', error);
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

  if (!graph) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">フェーズグラフがありません</p>
      </div>
    );
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'entry':
        return 'bg-blue-100 border-blue-300';
      case 'relationship':
        return 'bg-pink-100 border-pink-300';
      case 'girlfriend':
        return 'bg-purple-100 border-purple-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getIntimacyBadge = (eligibility?: string) => {
    switch (eligibility) {
      case 'allowed':
        return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">許可</span>;
      case 'conditional':
        return <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">条件付き</span>;
      case 'never':
      default:
        return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">不可</span>;
    }
  };

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex space-x-4 mb-4">
          <Link
            href={`/characters/${characterId}`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            概要
          </Link>
          <Link
            href={`/characters/${characterId}/phases`}
            className="px-3 py-2 text-sm font-medium text-pink-600 border-b-2 border-pink-600"
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Phase Graph Visualization */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Phase Graph</h2>

          <div className="space-y-4">
            {graph.nodes.map((node) => {
              const outgoingEdges = graph.edges.filter((e) => e.from === node.id);
              const isEntry = node.id === graph.entryPhaseId;

              return (
                <div key={node.id} className="relative">
                  <button
                    onClick={() => setSelectedNode(node)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${getModeColor(node.mode)} ${
                      selectedNode?.id === node.id ? 'ring-2 ring-pink-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{node.label}</h3>
                        {isEntry && (
                          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">
                            開始
                          </span>
                        )}
                      </div>
                      {getIntimacyBadge(node.adultIntimacyEligibility)}
                    </div>
                    <p className="text-sm text-gray-600">{node.description}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      モード: {node.mode}
                    </div>
                  </button>

                  {/* Edges */}
                  {outgoingEdges.map((edge) => {
                    const targetNode = graph.nodes.find((n) => n.id === edge.to);
                    return (
                      <div key={edge.id} className="ml-8 mt-2 mb-4 pl-4 border-l-2 border-gray-300">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">→ {targetNode?.label}</span>
                          <span className="text-gray-400 ml-2">
                            ({edge.conditions.length}条件 / {edge.allMustPass ? '全必須' : 'いずれか'})
                          </span>
                        </div>
                        {edge.authoredBeat && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            "{edge.authoredBeat}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {selectedNode ? `Phase: ${selectedNode.label}` : 'フェーズを選択'}
          </h2>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">説明</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedNode.description}</p>
              </div>

              {selectedNode.authoredNotes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">デザイナーノート</h4>
                  <p className="mt-1 text-sm text-gray-900">{selectedNode.authoredNotes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-500">受容プロファイル</h4>
                <dl className="mt-1 text-sm space-y-1">
                  {selectedNode.acceptanceProfile.warmthFloor !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">暖かさ下限:</dt>
                      <dd className="text-gray-900">{selectedNode.acceptanceProfile.warmthFloor}</dd>
                    </div>
                  )}
                  {selectedNode.acceptanceProfile.trustFloor !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">信頼下限:</dt>
                      <dd className="text-gray-900">{selectedNode.acceptanceProfile.trustFloor}</dd>
                    </div>
                  )}
                  {selectedNode.acceptanceProfile.intimacyFloor !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">親密度下限:</dt>
                      <dd className="text-gray-900">{selectedNode.acceptanceProfile.intimacyFloor}</dd>
                    </div>
                  )}
                  {selectedNode.acceptanceProfile.conflictCeiling !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">対立上限:</dt>
                      <dd className="text-gray-900">{selectedNode.acceptanceProfile.conflictCeiling}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">許可されたアクト</h4>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedNode.allowedActs.map((act) => (
                    <span key={act} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                      {act}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500">禁止されたアクト</h4>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedNode.disallowedActs.length > 0 ? (
                    selectedNode.disallowedActs.map((act) => (
                      <span key={act} className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                        {act}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">なし</span>
                  )}
                </div>
              </div>

              {/* Transition Conditions */}
              <div>
                <h4 className="text-sm font-medium text-gray-500">遷移条件</h4>
                <div className="mt-2 space-y-2">
                  {graph.edges
                    .filter((e) => e.from === selectedNode.id)
                    .map((edge) => {
                      const targetNode = graph.nodes.find((n) => n.id === edge.to);
                      return (
                        <div key={edge.id} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="font-medium">→ {targetNode?.label}</div>
                          <ul className="mt-1 text-xs text-gray-600 space-y-1">
                            {edge.conditions.map((cond, i) => (
                              <li key={i}>
                                {cond.type === 'metric' && `${cond.field} ${cond.op} ${cond.value}`}
                                {cond.type === 'event' && `イベント: ${cond.eventKey} ${cond.exists ? '存在' : '不存在'}`}
                                {cond.type === 'time' && `${cond.field} ${cond.op} ${cond.value}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              左のフェーズをクリックして詳細を表示
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
