'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Character {
  id: string;
  slug: string;
  displayName: string;
  createdAt: string;
}

interface CharacterWithVersion extends Character {
  latestVersion?: {
    versionNumber: number;
    status: string;
  };
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterWithVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const res = await fetch('/api/characters');
        const data = await res.json();
        setCharacters(Array.isArray(data) ? data : data.characters || []);
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

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">キャラクター</h1>
          <p className="mt-2 text-sm text-gray-700">
            キャラクター設定の管理。ペルソナ、スタイル、自律性、感情などを調整できます。
          </p>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="mt-8 text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">まだキャラクターがありません</p>
          <p className="text-sm text-gray-400 mt-1">
            /api/init を呼び出してシードデータを作成してください
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {character.displayName}
                  </h3>
                  {character.latestVersion && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        character.latestVersion.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      v{character.latestVersion.versionNumber}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">@{character.slug}</p>
                <p className="mt-3 text-xs text-gray-400">
                  作成: {new Date(character.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
