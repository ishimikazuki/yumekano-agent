import type { CoEExplanation } from '@/lib/rules/coe';

export type ConversationExportMessage = {
  role: 'user' | 'assistant';
  content: string;
  phaseId?: string;
  turnId?: string;
  traceId?: string;
  emotion?: {
    pleasure: number;
    arousal: number;
    dominance: number;
  };
  coe?: Pick<CoEExplanation, 'summary'>;
};

export type ConversationExportOptions = {
  title: string;
  messages: ConversationExportMessage[];
  sessionId?: string | null;
  characterName?: string | null;
  workspaceName?: string | null;
  mode?: string | null;
  exportedAt?: Date;
};

function formatIsoTimestamp(date: Date): string {
  return date.toISOString();
}

function formatTimestampForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function formatFloat(value: number): string {
  return value.toFixed(2);
}

function buildMessageMetadata(message: ConversationExportMessage): string[] {
  const metadata: string[] = [];

  if (message.phaseId) {
    metadata.push(`- Phase: ${message.phaseId}`);
  }

  if (message.turnId) {
    metadata.push(`- Turn ID: ${message.turnId}`);
  }

  if (message.traceId) {
    metadata.push(`- Trace ID: ${message.traceId}`);
  }

  if (message.emotion) {
    metadata.push(
      `- Emotion: P=${formatFloat(message.emotion.pleasure)}, A=${formatFloat(message.emotion.arousal)}, D=${formatFloat(message.emotion.dominance)}`
    );
  }

  if (message.coe?.summary) {
    metadata.push(`- CoE: ${message.coe.summary}`);
  }

  return metadata;
}

function buildMessageSection(message: ConversationExportMessage, index: number): string {
  const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
  const metadata = buildMessageMetadata(message);
  const lines = [
    `### ${index + 1}. ${roleLabel}`,
    '',
    '```text',
    message.content.replace(/\r\n/g, '\n'),
    '```',
  ];

  if (metadata.length > 0) {
    lines.push('', ...metadata);
  }

  return lines.join('\n');
}

export function buildConversationExportFilename(
  exportedAt: Date,
  sessionId?: string | null
): string {
  const sessionSuffix = sessionId ? `-${sessionId.slice(0, 8)}` : '';
  return `conversation-history-${formatTimestampForFilename(exportedAt)}${sessionSuffix}.md`;
}

export function buildConversationMarkdown(options: ConversationExportOptions): string {
  const exportedAt = options.exportedAt ?? new Date();
  const lines = [
    `# ${options.title}`,
    '',
    `- Exported at: ${formatIsoTimestamp(exportedAt)}`,
  ];

  if (options.mode) {
    lines.push(`- Mode: ${options.mode}`);
  }

  if (options.characterName) {
    lines.push(`- Character: ${options.characterName}`);
  }

  if (options.workspaceName) {
    lines.push(`- Workspace: ${options.workspaceName}`);
  }

  if (options.sessionId) {
    lines.push(`- Session ID: ${options.sessionId}`);
  }

  lines.push('', '## Conversation', '');

  if (options.messages.length === 0) {
    lines.push('_No messages_');
  } else {
    lines.push(options.messages.map((message, index) => buildMessageSection(message, index)).join('\n\n'));
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function downloadConversationMarkdown(options: ConversationExportOptions): string {
  const exportedAt = options.exportedAt ?? new Date();
  const filename = buildConversationExportFilename(exportedAt, options.sessionId);
  const content = buildConversationMarkdown({ ...options, exportedAt });
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return filename;
}
