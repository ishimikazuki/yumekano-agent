'use client';

import { useState, useEffect } from 'react';

interface Release {
  id: string;
  characterId: string;
  characterVersionId: string;
  channel: string;
  publishedBy: string;
  publishedAt: string;
  rollbackOfReleaseId: string | null;
}

interface Character {
  id: string;
  slug: string;
  displayName: string;
}

export default function ReleasesPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // Fetch characters
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

  // Fetch releases when character changes
  useEffect(() => {
    if (!selectedCharacterId) return;

    const fetchReleases = async () => {
      try {
        setDataLoading(true);
        const res = await fetch(`/api/releases?characterId=${selectedCharacterId}`);
        const data = await res.json();
        setReleases(data.releases || []);
        setCurrentRelease(data.currentRelease);
      } catch (error) {
        console.error('Failed to fetch releases:', error);
        setReleases([]);
        setCurrentRelease(null);
      } finally {
        setDataLoading(false);
      }
    };
    fetchReleases();
  }, [selectedCharacterId]);

  const handleRollback = async (targetReleaseId: string) => {
    if (!confirm('このバージョンにロールバックしますか？')) return;

    setRollingBack(targetReleaseId);
    try {
      const res = await fetch('/api/releases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetReleaseId,
          rolledBackBy: 'dashboard-user',
        }),
      });

      if (res.ok) {
        // Refresh releases
        const refreshRes = await fetch(`/api/releases?characterId=${selectedCharacterId}`);
        const data = await refreshRes.json();
        setReleases(data.releases || []);
        setCurrentRelease(data.currentRelease);
      } else {
        const errorData = await res.json();
        alert(`Rollback failed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Rollback error:', error);
      alert('Rollback failed');
    } finally {
      setRollingBack(null);
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
          <h1 className="text-2xl font-semibold text-gray-900">リリース</h1>
          <p className="mt-2 text-sm text-gray-700">
            キャラクターバージョンの公開・ロールバック管理
          </p>
        </div>
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

      {/* Current Release */}
      {dataLoading ? (
        <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
          リリース情報を読み込み中...
        </div>
      ) : currentRelease && (
        <div className="mb-6 p-6 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-green-900">現在のリリース</h2>
              <p className="text-sm text-green-700 mt-1">
                Version ID: <span className="font-mono">{currentRelease.characterVersionId.slice(0, 8)}...</span>
              </p>
              <p className="text-xs text-green-600 mt-1">
                公開者: {currentRelease.publishedBy} |
                公開日: {new Date(currentRelease.publishedAt).toLocaleString('ja-JP')}
              </p>
            </div>
            <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full">
              LIVE
            </span>
          </div>
        </div>
      )}

      {/* Release History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">リリース履歴</h2>
        </div>

        {dataLoading ? (
          <div className="p-6 text-center text-gray-500">
            リリース履歴を読み込み中...
          </div>
        ) : releases.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            リリース履歴がありません
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {releases.map((release, index) => {
              const isCurrent = currentRelease?.id === release.id;
              const isRollback = release.rollbackOfReleaseId !== null;

              return (
                <div
                  key={release.id}
                  className={`p-6 ${isCurrent ? 'bg-green-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-900">
                          {release.characterVersionId.slice(0, 8)}...
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                            LIVE
                          </span>
                        )}
                        {isRollback && (
                          <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">
                            ROLLBACK
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {release.publishedBy} · {new Date(release.publishedAt).toLocaleString('ja-JP')}
                      </p>
                      {isRollback && (
                        <p className="text-xs text-yellow-600 mt-1">
                          Rollback of: {release.rollbackOfReleaseId?.slice(0, 8)}...
                        </p>
                      )}
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => handleRollback(release.id)}
                        disabled={rollingBack === release.id}
                        className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                      >
                        {rollingBack === release.id ? 'ロールバック中...' : 'ロールバック'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-2">リリース管理について</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 新しいバージョンを公開すると、即座に本番環境に反映されます</li>
          <li>• ロールバックは過去のリリースを新しいリリースとして再公開します</li>
          <li>• すべてのリリース履歴は永続的に保存されます</li>
        </ul>
      </div>
    </div>
  );
}
