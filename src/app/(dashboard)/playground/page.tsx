'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CoEExplanationCard } from '@/components/CoEExplanationCard';
import type { CoEExplanation } from '@/lib/rules/coe';
import { downloadConversationMarkdown } from '@/lib/workspaces/conversation-export';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  traceId?: string;
  turnId?: string;
  phaseId?: string;
  coe?: CoEExplanation;
  emotion?: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
};

type Workspace = {
  id: string;
  characterId: string;
  name: string;
};

type Character = {
  id: string;
  slug: string;
  displayName: string;
};

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState('test-user-1');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Mode state
  const [mode, setMode] = useState<'production' | 'sandbox'>(workspaceId ? 'sandbox' : 'production');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [initError, setInitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load workspace or characters on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setMessages([]);
        setSessionId(null);

        if (workspaceId) {
          // Sandbox mode - load workspace
          const wsRes = await fetch(`/api/workspaces/${workspaceId}`);
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            setWorkspace(wsData);
            setMode('sandbox');

            // Load character info
            const charRes = await fetch(`/api/characters/${wsData.characterId}`);
            if (charRes.ok) {
              const charData = await charRes.json();
              setCharacter(charData.character);
            }
          }

          const sessionRes = await fetch(
            `/api/workspaces/${workspaceId}/playground-session?userId=${encodeURIComponent(userId)}`
          );

          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setSessionId(sessionData.sessionId);
            setMessages(sessionData.messages);
          }
        } else {
          // Production mode - load character list
          const charRes = await fetch('/api/characters');
          if (charRes.ok) {
            const data = await charRes.json();
            const chars = data.characters || [];
            setCharacters(chars);
            if (chars.length > 0) {
              setSelectedCharacterId(chars[0].id);
              setCharacter(chars[0]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setInitError('Failed to load data');
      }
    };
    loadData();
  }, [userId, workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      if (mode === 'sandbox' && workspaceId) {
        // Sandbox mode - use draft chat
        const response = await fetch('/api/draft-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            sessionId: sessionId || undefined,
            userId,
            message: userMessage,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Draft chat request failed');
        }

        const data = await response.json();
        if (!sessionId && data.sessionId) {
          setSessionId(data.sessionId);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.text,
            turnId: data.turnId,
            phaseId: data.phaseId,
            emotion: data.emotion,
            coe: data.coe,
          },
        ]);
      } else {
        // Production mode - use regular chat
        if (!selectedCharacterId) {
          throw new Error('No character selected');
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            characterId: selectedCharacterId,
            message: userMessage,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Chat request failed');
        }

        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.text,
            traceId: data.traceId,
            phaseId: data.phaseId,
            emotion: data.emotion,
            coe: data.coe,
          },
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    }

    setIsLoading(false);
  };

  const handleReset = async () => {
    if (mode === 'sandbox' && workspaceId) {
      const response = await fetch(`/api/workspaces/${workspaceId}/playground-session`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset sandbox session');
      }
    }

    setMessages([]);
    setSessionId(null);
  };

  const handleExportMarkdown = () => {
    if (messages.length === 0) {
      return;
    }

    downloadConversationMarkdown({
      title: `${character?.displayName ?? 'Yumekano'} conversation`,
      mode,
      characterName: character?.displayName ?? null,
      workspaceName: workspace?.name ?? null,
      sessionId,
      messages,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">プレイグラウンド</h1>
          {mode === 'sandbox' && workspace && character && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                サンドボックス
              </span>
              <span className="text-sm text-gray-600">
                {character.displayName} / {workspace.name}
              </span>
              <Link
                href={`/characters/${character.id}`}
                className="text-sm text-pink-600 hover:underline"
              >
                キャラクターに戻る
              </Link>
            </div>
          )}
          {mode === 'production' && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
              プロダクション
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {mode === 'production' && characters.length > 0 && (
            <select
              value={selectedCharacterId}
              onChange={(e) => {
                setSelectedCharacterId(e.target.value);
                const char = characters.find((c) => c.id === e.target.value);
                if (char) setCharacter(char);
                void handleReset();
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          )}
          <div className="text-sm text-gray-500">
            ユーザー:{' '}
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="border rounded px-2 py-1 w-32"
            />
          </div>
          <button
            onClick={handleExportMarkdown}
            disabled={messages.length === 0}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
          >
            MD出力
          </button>
          <button
            onClick={() => {
              void handleReset().catch((error) => {
                console.error('Failed to reset playground:', error);
              });
            }}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            リセット
          </button>
        </div>
      </div>

      {initError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">{initError}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>
              {mode === 'sandbox'
                ? 'ドラフトキャラクターとの会話を始めましょう'
                : 'キャラクターとの会話を始めましょう'}
            </p>
            <p className="text-sm mt-2">
              {mode === 'sandbox'
                ? '編集中のドラフト設定でテストできます'
                : '公開中のキャラクター設定で会話できます'}
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === 'assistant' && (message.traceId || message.turnId) && (
                <div className="mt-2 border-t pt-2 text-xs text-gray-500">
                  <div>フェーズ: {message.phaseId}</div>
                  {message.emotion && (
                    <div>
                      PAD: P={message.emotion.pleasure.toFixed(2)}, A=
                      {message.emotion.arousal.toFixed(2)}, D=
                      {message.emotion.dominance.toFixed(2)}
                    </div>
                  )}
                  {message.traceId && (
                    <Link
                      href={`/traces/${message.traceId}`}
                      className="underline hover:no-underline"
                    >
                      トレースを見る
                    </Link>
                  )}
                  {message.turnId && mode === 'sandbox' && (
                    <span className="text-gray-400">Turn: {message.turnId.slice(0, 8)}...</span>
                  )}
                  {message.coe && <CoEExplanationCard coe={message.coe} className="mt-2" />}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500">考え中...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          送信
        </button>
      </form>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <PlaygroundContent />
    </Suspense>
  );
}
