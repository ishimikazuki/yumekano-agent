import {
  AppraisalVector,
  PairState,
  WorkingMemory,
  OpenThread,
  CharacterVersion,
} from '../schemas';

/**
 * Input for computing appraisal vector
 */
export type AppraisalInput = {
  userMessage: string;
  characterVersion: CharacterVersion;
  pairState: PairState;
  workingMemory: WorkingMemory;
  openThreads: OpenThread[];
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>;
};

/**
 * Compute appraisal vector from message and context.
 *
 * This is a heuristic-based implementation. In a production system,
 * this could be augmented with ML-based sentiment/intent analysis.
 */
export function computeAppraisal(input: AppraisalInput): AppraisalVector {
  const {
    userMessage,
    characterVersion,
    pairState,
    workingMemory,
    openThreads,
  } = input;

  const message = userMessage.toLowerCase();
  const sensitivity = characterVersion.emotion.appraisalSensitivity;

  // Goal congruence: Is this aligned with what the character wants?
  const goalCongruence = computeGoalCongruence(
    message,
    pairState,
    workingMemory,
    sensitivity.goalCongruence
  );

  // Controllability: Does the character feel in control?
  const controllability = computeControllability(
    message,
    pairState,
    openThreads,
    sensitivity.controllability
  );

  // Certainty: Is the situation clear?
  const certainty = computeCertainty(
    message,
    workingMemory,
    sensitivity.certainty
  );

  // Norm alignment: Does this follow expected relationship norms?
  const normAlignment = computeNormAlignment(
    message,
    pairState,
    sensitivity.normAlignment
  );

  // Attachment security: Does the character feel secure in the relationship?
  const attachmentSecurity = computeAttachmentSecurity(
    pairState,
    openThreads,
    sensitivity.attachmentSecurity
  );

  // Reciprocity: Is the interaction balanced?
  const reciprocity = computeReciprocity(
    message,
    input.recentDialogue,
    sensitivity.reciprocity
  );

  // Pressure intrusiveness: Is the user being pushy?
  const pressureIntrusiveness = computePressureIntrusiveness(
    message,
    pairState,
    sensitivity.pressureIntrusiveness
  );

  // Novelty: Is this unexpected?
  const novelty = computeNovelty(
    message,
    workingMemory,
    sensitivity.novelty
  );

  // Self relevance: How much does this matter to the character?
  const selfRelevance = computeSelfRelevance(
    message,
    characterVersion
  );

  return {
    goalCongruence,
    controllability,
    certainty,
    normAlignment,
    attachmentSecurity,
    reciprocity,
    pressureIntrusiveness,
    novelty,
    selfRelevance,
  };
}

function computeGoalCongruence(
  message: string,
  pairState: PairState,
  workingMemory: WorkingMemory,
  sensitivity: number
): number {
  let score = 0;

  // Positive signals
  const positivePatterns = [
    /好き/,
    /愛してる/,
    /会いたい/,
    /嬉しい/,
    /ありがとう/,
    /楽しい/,
    /一緒に/,
    /大切/,
  ];
  for (const pattern of positivePatterns) {
    if (pattern.test(message)) score += 0.2;
  }

  // Negative signals
  const negativePatterns = [
    /嫌い/,
    /うざい/,
    /面倒/,
    /別れ/,
    /やめ/,
    /無視/,
    /どうでもいい/,
  ];
  for (const pattern of negativePatterns) {
    if (pattern.test(message)) score -= 0.3;
  }

  // Adjust for relationship state
  if (pairState.conflict > 50) score -= 0.2;
  if (pairState.affinity > 70) score += 0.1;

  // Adjust for tension
  if (workingMemory.activeTensionSummary) score -= 0.15;

  return Math.max(-1, Math.min(1, score * sensitivity));
}

function computeControllability(
  message: string,
  pairState: PairState,
  openThreads: OpenThread[],
  sensitivity: number
): number {
  let score = 0.5; // Baseline

  // Demanding patterns reduce controllability
  const demandingPatterns = [
    /しろ/,
    /やれ/,
    /命令/,
    /今すぐ/,
    /絶対/,
    /必ず/,
    /従え/,
  ];
  for (const pattern of demandingPatterns) {
    if (pattern.test(message)) score -= 0.2;
  }

  // Open threads reduce perceived control
  score -= openThreads.length * 0.1;

  // High conflict reduces control
  if (pairState.conflict > 50) score -= 0.2;

  return Math.max(0, Math.min(1, score * sensitivity));
}

function computeCertainty(
  message: string,
  workingMemory: WorkingMemory,
  sensitivity: number
): number {
  let score = 0.5;

  // Uncertain language
  const uncertainPatterns = [
    /かも/,
    /たぶん/,
    /わからない/,
    /どうしよう/,
    /迷/,
  ];
  for (const pattern of uncertainPatterns) {
    if (pattern.test(message)) score -= 0.1;
  }

  // Clear communication increases certainty
  const clearPatterns = [/だよ/, /です/, /ます/];
  for (const pattern of clearPatterns) {
    if (pattern.test(message)) score += 0.05;
  }

  // Corrections in memory suggest past uncertainties
  if (workingMemory.knownCorrections.length > 0) score -= 0.1;

  return Math.max(0, Math.min(1, score * sensitivity));
}

function computeNormAlignment(
  message: string,
  pairState: PairState,
  sensitivity: number
): number {
  let score = 0;

  // Phase-appropriate behavior
  if (pairState.trust > 50) {
    // More norms are acceptable at higher trust
    score += 0.2;
  }

  // Inappropriate requests reduce alignment
  const inappropriatePatterns = [
    /エッチ/,
    /脱/,
    /裸/,
    /セックス/,
  ];
  for (const pattern of inappropriatePatterns) {
    if (pattern.test(message)) {
      if (pairState.intimacyReadiness < 50) {
        score -= 0.5;
      }
    }
  }

  return Math.max(-1, Math.min(1, score * sensitivity));
}

function computeAttachmentSecurity(
  pairState: PairState,
  openThreads: OpenThread[],
  sensitivity: number
): number {
  let score = 0.5;

  // Trust directly affects security
  score += (pairState.trust - 50) / 100;

  // Affinity affects security
  score += (pairState.affinity - 50) / 200;

  // Open threads (especially severe ones) reduce security
  for (const thread of openThreads) {
    score -= thread.severity * 0.2;
  }

  // Conflict reduces security
  score -= pairState.conflict / 200;

  return Math.max(0, Math.min(1, score * sensitivity));
}

function computeReciprocity(
  message: string,
  recentDialogue: Array<{ role: 'user' | 'assistant'; content: string }>,
  sensitivity: number
): number {
  let score = 0;

  // Check for appreciation/thanks
  if (/ありがとう|感謝|助かる/.test(message)) score += 0.3;

  // Check for questions back (interest in character)
  if (/[？?]/.test(message)) score += 0.1;

  // Check dialogue balance
  const userMessages = recentDialogue.filter((m) => m.role === 'user').length;
  const assistantMessages = recentDialogue.filter((m) => m.role === 'assistant').length;
  if (userMessages > 0 && assistantMessages > 0) {
    const ratio = userMessages / assistantMessages;
    if (ratio > 0.5 && ratio < 2) score += 0.1; // Balanced
  }

  return Math.max(-1, Math.min(1, score * sensitivity));
}

function computePressureIntrusiveness(
  message: string,
  pairState: PairState,
  sensitivity: number
): number {
  let score = 0;

  // Pushy patterns
  const pushyPatterns = [
    /早く/,
    /今すぐ/,
    /まだ[？?]/,
    /いつになったら/,
    /待てない/,
    /もう/,
  ];
  for (const pattern of pushyPatterns) {
    if (pattern.test(message)) score += 0.15;
  }

  // Repeated intimacy requests when not ready
  if (pairState.intimacyReadiness < 30) {
    const intimacyPatterns = [/したい/, /触/, /キス/, /抱/];
    for (const pattern of intimacyPatterns) {
      if (pattern.test(message)) score += 0.3;
    }
  }

  return Math.max(0, Math.min(1, score * sensitivity));
}

function computeNovelty(
  message: string,
  workingMemory: WorkingMemory,
  sensitivity: number
): number {
  let score = 0.5;

  // Check if message mentions known topics (reduces novelty)
  for (const like of workingMemory.knownLikes) {
    if (message.includes(like)) score -= 0.1;
  }
  for (const dislike of workingMemory.knownDislikes) {
    if (message.includes(dislike)) score -= 0.1;
  }

  // Question marks suggest new information seeking
  const questionCount = (message.match(/[？?]/g) || []).length;
  score += questionCount * 0.1;

  return Math.max(0, Math.min(1, score * sensitivity));
}

function computeSelfRelevance(
  message: string,
  characterVersion: CharacterVersion
): number {
  let score = 0.5;

  // Direct address increases relevance
  for (const phrase of characterVersion.style.signaturePhrases) {
    if (message.includes(phrase)) score += 0.2;
  }

  // Questions about the character
  if (/君|あなた|お前|名前/.test(message)) score += 0.1;

  // Emotional content increases relevance
  if (/好き|嫌|愛|心配|寂しい/.test(message)) score += 0.2;

  return Math.max(0, Math.min(1, score));
}
