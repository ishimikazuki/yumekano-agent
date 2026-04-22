/**
 * question-saturation scorer
 *
 * Deterministic guard for the "push-pull" design: questions are valuable, but
 * N consecutive assistant turns each ending in a question drain emotional
 * progress (the user answers and answers without the character ever showing
 * vulnerability, proposing, or sharing). This scorer applies a penalty when
 * the candidate would extend such a streak.
 *
 * No LLM is used — pattern detection only.
 */

export type QuestionSaturationConfig = {
  /** Trigger when this many consecutive assistant turns (including the candidate) all contain questions. Default 3. */
  windowTurns?: number;
  /** Score applied when saturated. Default 0.3. */
  saturationScore?: number;
};

export type QuestionSaturationInput = {
  candidate: { text: string };
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
  config?: QuestionSaturationConfig;
};

export type QuestionSaturationResult = {
  score: number;
  reasoning: string;
  issues: string[];
};

const DEFAULT_CONFIG: Required<QuestionSaturationConfig> = {
  windowTurns: 3,
  saturationScore: 0.3,
};

const QUESTION_MARK_RE = /[？?]/;

function containsQuestion(text: string): boolean {
  return QUESTION_MARK_RE.test(text);
}

export function scoreQuestionSaturation(
  input: QuestionSaturationInput
): QuestionSaturationResult {
  const config = { ...DEFAULT_CONFIG, ...(input.config ?? {}) };
  const { windowTurns, saturationScore } = config;

  if (!containsQuestion(input.candidate.text)) {
    return {
      score: 1.0,
      reasoning: 'Candidate contains no question — no saturation risk',
      issues: [],
    };
  }

  // Count how many of the most recent assistant turns (walking backwards)
  // contained a question, stopping at the first non-question assistant turn.
  const assistantTurns = input.recentDialogue.filter((m) => m.role === 'assistant');
  let consecutivePriorQuestions = 0;
  for (let i = assistantTurns.length - 1; i >= 0; i -= 1) {
    if (containsQuestion(assistantTurns[i].content)) {
      consecutivePriorQuestions += 1;
    } else {
      break;
    }
  }

  // "windowTurns" counts the current candidate as well, so we need
  // (windowTurns - 1) prior consecutive question-turns to trigger.
  const triggerThreshold = Math.max(1, windowTurns - 1);
  if (consecutivePriorQuestions >= triggerThreshold) {
    return {
      score: saturationScore,
      reasoning: `Candidate would extend a ${consecutivePriorQuestions + 1}-turn consecutive question streak (window=${windowTurns}), draining the push-pull rhythm.`,
      issues: [
        `question saturation: ${consecutivePriorQuestions + 1} consecutive question-turns detected (質問連発)`,
      ],
    };
  }

  return {
    score: 1.0,
    reasoning: `Candidate asks a question but prior streak (${consecutivePriorQuestions}) is below threshold (${triggerThreshold})`,
    issues: [],
  };
}
