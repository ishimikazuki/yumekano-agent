import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConversationExportFilename,
  buildConversationMarkdown,
} from '@/lib/workspaces/conversation-export';

test('buildConversationMarkdown exports session metadata and assistant annotations', () => {
  const exportedAt = new Date('2026-03-24T08:15:30.000Z');
  const markdown = buildConversationMarkdown({
    title: 'Seira sandbox conversation',
    mode: 'sandbox',
    characterName: 'セイラ',
    workspaceName: 'テスト用ワークスペース',
    sessionId: '12345678-90ab-cdef-1234-567890abcdef',
    exportedAt,
    messages: [
      {
        role: 'user',
        content: 'こんにちは',
      },
      {
        role: 'assistant',
        content: 'やっほー、来てくれたんだね。',
        phaseId: 'station_meeting',
        turnId: 'turn-123',
        emotion: {
          pleasure: 0.25,
          arousal: 0.5,
          dominance: -0.1,
        },
        coe: {
          summary: '安心感が少し上がって、返答が柔らかくなった。',
        },
      },
    ],
  });

  assert.match(markdown, /^# Seira sandbox conversation/m);
  assert.match(markdown, /- Exported at: 2026-03-24T08:15:30.000Z/);
  assert.match(markdown, /- Mode: sandbox/);
  assert.match(markdown, /- Character: セイラ/);
  assert.match(markdown, /- Workspace: テスト用ワークスペース/);
  assert.match(markdown, /- Session ID: 12345678-90ab-cdef-1234-567890abcdef/);
  assert.match(markdown, /### 1\. User[\s\S]*```text\nこんにちは\n```/);
  assert.match(markdown, /### 2\. Assistant[\s\S]*- Phase: station_meeting/);
  assert.match(markdown, /- Turn ID: turn-123/);
  assert.match(markdown, /- Emotion: P=0.25, A=0.50, D=-0.10/);
  assert.match(markdown, /- CoE: 安心感が少し上がって、返答が柔らかくなった。/);
});

test('buildConversationExportFilename includes timestamp and session prefix', () => {
  const filename = buildConversationExportFilename(
    new Date(2026, 2, 24, 8, 15, 30),
    '12345678-90ab-cdef-1234-567890abcdef'
  );

  assert.equal(filename, 'conversation-history-20260324-081530-12345678.md');
});
