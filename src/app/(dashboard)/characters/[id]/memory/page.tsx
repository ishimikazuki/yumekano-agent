'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface MemoryEvent {
  id: string;
  eventType: string;
  summary: string;
  salience: number;
  retrievalKeys: string[];
  emotionSignature: { pleasure: number; arousal: number; dominance: number } | null;
  createdAt: string;
}

interface MemoryFact {
  id: string;
  subject: string;
  predicate: string;
  object: unknown;
  confidence: number;
  status: 'active' | 'superseded' | 'disputed';
  createdAt: string;
}

interface OpenThread {
  id: string;
  key: string;
  summary: string;
  severity: number;
  status: 'open' | 'resolved';
  updatedAt: string;
}

interface WorkingMemory {
  preferredAddressForm: string | null;
  knownLikes: string[];
  knownDislikes: string[];
  activeTensionSummary: string | null;
  relationshipStance: string | null;
  knownCorrections: string[];
}

export default function MemoryPage() {
  const params = useParams();
  const characterId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [threads, setThreads] = useState<OpenThread[]>([]);
  const [workingMemory, setWorkingMemory] = useState<WorkingMemory | null>(null);
  const [selectedTab, setSelectedTab] = useState<'events' | 'facts' | 'threads' | 'working'>('events');

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        // For demo purposes - in production this would fetch from API
        // The API would need to accept a userId to get pair-specific memory
        setEvents([]);
        setFacts([]);
        setThreads([]);
        setWorkingMemory({
          preferredAddressForm: null,
          knownLikes: [],
          knownDislikes: [],
          activeTensionSummary: null,
          relationshipStance: null,
          knownCorrections: [],
        });
      } catch (error) {
        console.error('Failed to fetch memory:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMemory();
  }, [characterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const tabs = [
    { key: 'events' as const, label: 'エピソード', count: events.length },
    { key: 'facts' as const, label: 'ファクト', count: facts.length },
    { key: 'threads' as const, label: 'オープンスレッド', count: threads.filter(t => t.status === 'open').length },
    { key: 'working' as const, label: 'ワーキングメモリ', count: null },
  ];

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex space-x-4 mb-4">
          <Link
            href={`/characters/${characterId}`}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
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
            className="px-3 py-2 text-sm font-medium text-pink-600 border-b-2 border-pink-600"
          >
            Memory
          </Link>
        </nav>
      </div>

      {/* Info Notice */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          メモリはユーザー×キャラクターのペアごとに保存されます。
          ここではPlaygroundで作成されたペアのメモリを閲覧できます。
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {selectedTab === 'events' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">エピソードイベント</h3>
            {events.length === 0 ? (
              <p className="text-gray-500 text-center py-8">まだエピソードがありません</p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                        {event.eventType}
                      </span>
                      <span className="text-xs text-gray-400">
                        salience: {(event.salience * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{event.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {event.retrievalKeys.map((key, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          {key}
                        </span>
                      ))}
                    </div>
                    {event.emotionSignature && (
                      <div className="mt-2 text-xs text-gray-500">
                        P:{event.emotionSignature.pleasure.toFixed(2)}
                        A:{event.emotionSignature.arousal.toFixed(2)}
                        D:{event.emotionSignature.dominance.toFixed(2)}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(event.createdAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'facts' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">グラフファクト</h3>
            {facts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">まだファクトがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Predicate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Object</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {facts.map((fact) => (
                      <tr key={fact.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{fact.subject}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{fact.predicate}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{JSON.stringify(fact.object)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{(fact.confidence * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              fact.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : fact.status === 'superseded'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {fact.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'threads' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">オープンスレッド</h3>
            {threads.length === 0 ? (
              <p className="text-gray-500 text-center py-8">未解決のスレッドはありません</p>
            ) : (
              <div className="space-y-4">
                {threads.map((thread) => (
                  <div key={thread.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{thread.key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          severity: {(thread.severity * 100).toFixed(0)}%
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            thread.status === 'open'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {thread.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{thread.summary}</p>
                    <div className="mt-2 text-xs text-gray-400">
                      更新: {new Date(thread.updatedAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'working' && (
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">ワーキングメモリ</h3>
            {workingMemory ? (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">呼び方</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workingMemory.preferredAddressForm ?? '未設定'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">好きなもの</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {workingMemory.knownLikes.length > 0 ? (
                      workingMemory.knownLikes.map((like, i) => (
                        <span key={i} className="px-2 py-1 bg-pink-100 text-pink-700 text-xs rounded">
                          {like}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">なし</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">嫌いなもの</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {workingMemory.knownDislikes.length > 0 ? (
                      workingMemory.knownDislikes.map((dislike, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {dislike}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">なし</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">現在の緊張</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workingMemory.activeTensionSummary ?? 'なし'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">関係スタンス</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {workingMemory.relationshipStance ?? '未設定'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">訂正事項</dt>
                  <dd className="mt-1">
                    {workingMemory.knownCorrections.length > 0 ? (
                      <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                        {workingMemory.knownCorrections.map((correction, i) => (
                          <li key={i}>{correction}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-gray-400">なし</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-gray-500 text-center py-8">ワーキングメモリがありません</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
