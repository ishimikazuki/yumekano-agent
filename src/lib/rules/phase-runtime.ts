import type {
  AppraisalVector,
  OpenThread,
  PADState,
  PairState,
  PhaseEdge,
} from '../schemas';
import type { PhaseEngineContext, PhaseTransitionResult } from './phase-engine';

export type DialogueTurnLike = {
  role: 'user' | 'assistant';
  content: string;
};

export type PhaseHistoryTurnLike = {
  createdAt: Date | string;
  traceJson?: unknown;
};

type RelationshipMetrics = Pick<
  PairState,
  'affinity' | 'trust' | 'intimacyReadiness' | 'conflict'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

const TOPIC_PATTERNS: Record<string, RegExp[]> = {
  thanks_or_kindness: [
    /ありがとう/,
    /感謝/,
    /助か(る|った)/,
    /優し/,
    /親切/,
    /拾/,
    /落とし物/,
    /忘れ物/,
    /届け/,
    /返(して|す|した)/,
  ],
  idol_dream: [
    /夢/,
    /アイドル/,
    /メジャー/,
    /デビュー/,
    /ステージ/,
    /歌手/,
    /レッスン/,
    /練習/,
  ],
  dream: [
    /夢/,
    /将来/,
    /目標/,
    /なりたい/,
    /メジャー/,
    /デビュー/,
    /ステージ/,
  ],
};

const INSECURITY_PATTERNS = [
  /不安/,
  /緊張/,
  /こわ/,
  /怖/,
  /自信(がない|ない)/,
  /大丈夫かな/,
  /できるかな/,
  /心配/,
  /うまくいくかな/,
];

const SUPPORT_PATTERNS = [
  /大丈夫/,
  /応援/,
  /味方/,
  /支える/,
  /信じて/,
  /きっと/,
  /できる/,
  /助ける/,
  /守る/,
];

const CONFESSION_PATTERNS = [
  /好き/,
  /付き合(って|おう)/,
  /恋人/,
  /彼女/,
  /彼氏/,
];

const ACCEPTANCE_PATTERNS = [
  /いいよ/,
  /もちろん/,
  /うれしい/,
  /よろしく/,
  /私も/,
  /おっけー/,
  /OK/i,
  /付き合(おう|って)/,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getFallbackPatterns(key: string): RegExp[] {
  return key
    .split(/[_\s-]+/)
    .filter((token) => token.length >= 3 && !['and', 'or', 'the'].includes(token))
    .map((token) => new RegExp(escapeRegExp(token), 'i'));
}

function getPatternsForKey(key: string): RegExp[] {
  return TOPIC_PATTERNS[key] ?? getFallbackPatterns(key);
}

function normalizeDialogue(input: DialogueTurnLike[], currentUserMessage: string): DialogueTurnLike[] {
  return [...input, { role: 'user' as const, content: currentUserMessage }]
    .map(
      (entry): DialogueTurnLike => ({
        role: entry.role,
        content: entry.content.trim(),
      })
    )
    .filter((entry) => entry.content.length > 0)
    .slice(-12);
}

function countMatchingUtterances(dialogue: DialogueTurnLike[], patterns: RegExp[]): number {
  if (patterns.length === 0) {
    return 0;
  }

  return dialogue.reduce((count, entry) => {
    return count + (patterns.some((pattern) => pattern.test(entry.content)) ? 1 : 0);
  }, 0);
}

function hasAnyMatch(dialogue: DialogueTurnLike[], patterns: RegExp[]): boolean {
  return countMatchingUtterances(dialogue, patterns) > 0;
}

function detectEvent(eventKey: string, dialogue: DialogueTurnLike[]): boolean {
  switch (eventKey) {
    case 'supported_after_insecurity':
      return hasAnyMatch(dialogue, INSECURITY_PATTERNS) && hasAnyMatch(dialogue, SUPPORT_PATTERNS);
    case 'confession_accepted':
      return hasAnyMatch(dialogue, CONFESSION_PATTERNS) && hasAnyMatch(dialogue, ACCEPTANCE_PATTERNS);
    default:
      return hasAnyMatch(dialogue, getFallbackPatterns(eventKey));
  }
}

function clampMetric(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function phaseTraceSnapshot(
  traceJson: unknown
): { phaseIdBefore: string; phaseIdAfter: string } | null {
  if (!traceJson || typeof traceJson !== 'object') {
    return null;
  }

  const trace = traceJson as Record<string, unknown>;
  return typeof trace.phaseIdBefore === 'string' && typeof trace.phaseIdAfter === 'string'
    ? {
        phaseIdBefore: trace.phaseIdBefore,
        phaseIdAfter: trace.phaseIdAfter,
      }
    : null;
}

export function collectTransitionSignalKeys(edges: PhaseEdge[]): {
  topicKeys: string[];
  eventKeys: string[];
} {
  const topicKeys = new Set<string>();
  const eventKeys = new Set<string>();

  for (const edge of edges) {
    for (const condition of edge.conditions) {
      if (condition.type === 'topic') {
        topicKeys.add(condition.topicKey);
      }
      if (condition.type === 'event') {
        eventKeys.add(condition.eventKey);
      }
    }
  }

  return {
    topicKeys: [...topicKeys],
    eventKeys: [...eventKeys],
  };
}

export function buildPhaseEngineRuntimeContext(input: {
  edges: PhaseEdge[];
  pairState: PairState;
  pad: PADState;
  openThreads: OpenThread[];
  recentDialogue: DialogueTurnLike[];
  currentUserMessage: string;
  turnsSinceLastTransition: number;
  daysSinceEntry: number;
}): PhaseEngineContext {
  const { topicKeys, eventKeys } = collectTransitionSignalKeys(input.edges);
  const dialogue = normalizeDialogue(input.recentDialogue, input.currentUserMessage);

  const topics = new Map<string, number>();
  for (const topicKey of topicKeys) {
    topics.set(topicKey, countMatchingUtterances(dialogue, getPatternsForKey(topicKey)));
  }

  const events = new Map<string, boolean>();
  for (const eventKey of eventKeys) {
    events.set(eventKey, detectEvent(eventKey, dialogue));
  }

  return {
    pairState: input.pairState,
    pad: input.pad,
    openThreads: input.openThreads,
    events,
    topics,
    turnsSinceLastTransition: input.turnsSinceLastTransition,
    daysSinceEntry: input.daysSinceEntry,
  };
}

export function deriveSandboxPhaseTiming(input: {
  sessionCreatedAt: Date | string;
  turns: PhaseHistoryTurnLike[];
  currentPhaseId: string;
  now?: Date;
}): {
  turnsSinceLastTransition: number;
  daysSinceEntry: number;
} {
  const now = input.now ?? new Date();
  let phaseEntryAt = new Date(input.sessionCreatedAt);
  let turnsSinceLastTransition = input.turns.length;

  for (let index = input.turns.length - 1; index >= 0; index -= 1) {
    const trace = phaseTraceSnapshot(input.turns[index].traceJson);
    if (!trace) {
      continue;
    }

    if (
      trace.phaseIdBefore !== trace.phaseIdAfter &&
      trace.phaseIdAfter === input.currentPhaseId
    ) {
      phaseEntryAt = new Date(input.turns[index].createdAt);
      turnsSinceLastTransition = input.turns.length - index - 1;
      break;
    }
  }

  return {
    turnsSinceLastTransition,
    daysSinceEntry: Math.max(0, Math.floor((now.getTime() - phaseEntryAt.getTime()) / DAY_MS)),
  };
}

export function resolvePhaseTransition(
  transitionResult: PhaseTransitionResult,
  proposedTargetPhaseId: string | null
): string | null {
  if (!transitionResult.shouldTransition || !transitionResult.targetPhaseId) {
    return null;
  }

  if (!proposedTargetPhaseId) {
    return transitionResult.targetPhaseId;
  }

  return proposedTargetPhaseId === transitionResult.targetPhaseId
    ? transitionResult.targetPhaseId
    : null;
}
