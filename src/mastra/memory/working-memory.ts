import { memoryRepo } from '@/lib/repositories';
import type { WorkingMemory } from '@/lib/schemas';

/**
 * Working memory operations for pair-level state that must be cheap to inject every turn.
 */

export async function getOrCreateWorkingMemory(pairId: string): Promise<WorkingMemory> {
  const existing = await memoryRepo.getWorkingMemory(pairId);
  if (existing) {
    return existing;
  }

  const defaultMemory = memoryRepo.getDefaultWorkingMemory();
  await memoryRepo.setWorkingMemory(pairId, defaultMemory);
  return defaultMemory;
}

export async function updateWorkingMemory(
  pairId: string,
  patch: Partial<WorkingMemory>
): Promise<WorkingMemory> {
  const current = await getOrCreateWorkingMemory(pairId);
  const updated: WorkingMemory = {
    ...current,
    ...patch,
    // Merge arrays instead of replacing
    knownLikes: patch.knownLikes
      ? [...new Set([...current.knownLikes, ...patch.knownLikes])]
      : current.knownLikes,
    knownDislikes: patch.knownDislikes
      ? [...new Set([...current.knownDislikes, ...patch.knownDislikes])]
      : current.knownDislikes,
    knownCorrections: patch.knownCorrections
      ? [...current.knownCorrections, ...patch.knownCorrections]
      : current.knownCorrections,
    intimacyContextHints: patch.intimacyContextHints
      ? [...new Set([...current.intimacyContextHints, ...patch.intimacyContextHints])]
      : current.intimacyContextHints,
    // Merge cooldowns
    currentCooldowns: {
      ...current.currentCooldowns,
      ...patch.currentCooldowns,
    },
  };

  await memoryRepo.setWorkingMemory(pairId, updated);
  return updated;
}

export async function addCooldown(
  pairId: string,
  topic: string,
  expiresAt: Date
): Promise<void> {
  const current = await getOrCreateWorkingMemory(pairId);
  await memoryRepo.setWorkingMemory(pairId, {
    ...current,
    currentCooldowns: {
      ...current.currentCooldowns,
      [topic]: expiresAt,
    },
  });
}

export async function clearExpiredCooldowns(pairId: string): Promise<void> {
  const current = await getOrCreateWorkingMemory(pairId);
  const now = new Date();
  const activeCooldowns: Record<string, Date> = {};

  for (const [topic, expiry] of Object.entries(current.currentCooldowns)) {
    const expiryDate = expiry instanceof Date ? expiry : new Date(expiry);
    if (expiryDate > now) {
      activeCooldowns[topic] = expiryDate;
    }
  }

  if (Object.keys(activeCooldowns).length !== Object.keys(current.currentCooldowns).length) {
    await memoryRepo.setWorkingMemory(pairId, {
      ...current,
      currentCooldowns: activeCooldowns,
    });
  }
}

export async function addCorrection(
  pairId: string,
  correction: string
): Promise<void> {
  const current = await getOrCreateWorkingMemory(pairId);
  await memoryRepo.setWorkingMemory(pairId, {
    ...current,
    knownCorrections: [...current.knownCorrections, correction],
  });
}

export async function updateRelationshipStance(
  pairId: string,
  stance: string
): Promise<void> {
  const current = await getOrCreateWorkingMemory(pairId);
  await memoryRepo.setWorkingMemory(pairId, {
    ...current,
    relationshipStance: stance,
  });
}

export async function updateTensionSummary(
  pairId: string,
  summary: string | null
): Promise<void> {
  const current = await getOrCreateWorkingMemory(pairId);
  await memoryRepo.setWorkingMemory(pairId, {
    ...current,
    activeTensionSummary: summary,
  });
}
