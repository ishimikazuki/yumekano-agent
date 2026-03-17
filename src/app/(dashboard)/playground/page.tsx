'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  traceId?: string;
  phaseId?: string;
  emotion?: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
};

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [characterId, setCharacterId] = useState('');
  const [userId, setUserId] = useState('test-user-1');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInit = async () => {
    setIsLoading(true);
    setInitError(null);
    try {
      const response = await fetch('/api/init', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setIsInitialized(true);
        // Fetch character ID (hardcoded for MVP)
        // In a real app, we'd fetch from /api/characters
        setCharacterId(''); // Will be set when first message is sent
      } else {
        setInitError(data.error);
      }
    } catch {
      setInitError('Failed to initialize database');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // For MVP, we need to get the character ID first
      // This would normally come from character selection
      let currentCharacterId = characterId;
      if (!currentCharacterId) {
        // Fetch character list and use first one
        const charResponse = await fetch('/api/characters');
        if (charResponse.ok) {
          const chars = await charResponse.json();
          if (chars.length > 0) {
            currentCharacterId = chars[0].id;
            setCharacterId(currentCharacterId);
          }
        }
      }

      if (!currentCharacterId) {
        throw new Error('No character available. Please initialize the database first.');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          characterId: currentCharacterId,
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
        },
      ]);
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Playground</h1>
        <div className="flex items-center space-x-4">
          {!isInitialized && (
            <button
              onClick={handleInit}
              disabled={isLoading}
              className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50"
            >
              {isLoading ? 'Initializing...' : 'Initialize DB'}
            </button>
          )}
          <div className="text-sm text-gray-500">
            User: <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="border rounded px-2 py-1 w-32"
            />
          </div>
        </div>
      </div>

      {initError && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {initError}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>Start a conversation with the character.</p>
            <p className="text-sm mt-2">
              {isInitialized
                ? 'Type a message below to begin.'
                : 'Click "Initialize DB" first to set up the database.'}
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
              {message.role === 'assistant' && message.traceId && (
                <div className="mt-2 text-xs opacity-70 border-t pt-2">
                  <div>Phase: {message.phaseId}</div>
                  {message.emotion && (
                    <div>
                      PAD: P={message.emotion.pleasure.toFixed(2)}, A=
                      {message.emotion.arousal.toFixed(2)}, D=
                      {message.emotion.dominance.toFixed(2)}
                    </div>
                  )}
                  <a
                    href={`/traces/${message.traceId}`}
                    className="underline hover:no-underline"
                  >
                    View Trace
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500">
              Thinking...
            </div>
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
          placeholder="Type a message..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-6 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
