/**
 * Local Development Adapter
 *
 * An in-memory implementation of GameContextAdapter for local development
 * and testing. State is stored in memory and resets on server restart.
 */

import type {
  GameContextAdapter,
  UserIdentity,
  PairContext,
  TurnResultInput,
} from './game-context-adapter';

// In-memory storage for development
const userIdentities = new Map<string, UserIdentity>();
const pairContexts = new Map<string, PairContext>();
const turnResults: TurnResultInput[] = [];
const availableActions = new Map<string, Array<{
  actionId: string;
  name: string;
  cost?: number;
  cooldownRemaining?: number;
}>>();

/**
 * Create a local development adapter with in-memory storage.
 */
export function createLocalDevAdapter(options?: {
  defaultUserId?: string;
  defaultDisplayName?: string;
}): GameContextAdapter {
  const defaultUserId = options?.defaultUserId || 'dev-user-1';
  const defaultDisplayName = options?.defaultDisplayName || 'Developer';

  return {
    async getUserIdentity(): Promise<UserIdentity> {
      const existing = userIdentities.get(defaultUserId);
      if (existing) return existing;

      const identity: UserIdentity = {
        userId: defaultUserId,
        displayName: defaultDisplayName,
        tier: 'vip', // VIP for dev to unlock all features
      };
      userIdentities.set(defaultUserId, identity);
      return identity;
    },

    async getPairContext(input: {
      userId: string;
      characterId: string;
    }): Promise<PairContext> {
      const key = `${input.userId}:${input.characterId}`;
      const existing = pairContexts.get(key);
      if (existing) return existing;

      // Default dev context with some starter items
      const context: PairContext = {
        currency: 10000, // Lots of currency for testing
        inventory: ['flower', 'chocolate', 'letter', 'ring'],
        eventFlags: {
          tutorial_complete: true,
          first_date_available: true,
        },
        relationshipOverrides: {},
        unlockedPhases: [], // All phases available
        achievementCount: 0,
      };
      pairContexts.set(key, context);
      return context;
    },

    async recordTurnResult(input: TurnResultInput): Promise<void> {
      // Store the turn result
      turnResults.push(input);

      // Update pair context based on state delta
      const key = `${input.userId}:${input.characterId}`;
      const context = pairContexts.get(key) || {};

      // Apply event flags from state delta
      if (input.stateDelta.eventFlags) {
        context.eventFlags = {
          ...context.eventFlags,
          ...(input.stateDelta.eventFlags as Record<string, boolean>),
        };
      }

      // Apply currency changes
      if (typeof input.stateDelta.currencyDelta === 'number') {
        context.currency = (context.currency || 0) + input.stateDelta.currencyDelta;
      }

      pairContexts.set(key, context);

      // Log for debugging
      console.log('[LocalDevAdapter] Turn recorded:', {
        userId: input.userId,
        characterId: input.characterId,
        turnId: input.turnId,
        phaseId: input.phaseId,
      });
    },

    async checkFeatureAccess(): Promise<boolean> {
      // All features available in dev mode
      return true;
    },

    async getAvailableActions(input: {
      userId: string;
      characterId: string;
    }): Promise<Array<{
      actionId: string;
      name: string;
      cost?: number;
      cooldownRemaining?: number;
    }>> {
      const key = `${input.userId}:${input.characterId}`;
      const existing = availableActions.get(key);
      if (existing) return existing;

      // Default actions for development
      const actions = [
        { actionId: 'give_flower', name: 'Give Flower', cost: 100 },
        { actionId: 'give_chocolate', name: 'Give Chocolate', cost: 150 },
        { actionId: 'send_letter', name: 'Send Letter', cost: 50 },
        { actionId: 'request_date', name: 'Request Date', cost: 500 },
        { actionId: 'virtual_hug', name: 'Virtual Hug', cost: 0, cooldownRemaining: 0 },
      ];
      availableActions.set(key, actions);
      return actions;
    },

    async executeAction(input: {
      userId: string;
      characterId: string;
      actionId: string;
      turnId: string;
    }): Promise<{ success: boolean; message?: string }> {
      const key = `${input.userId}:${input.characterId}`;
      const context = pairContexts.get(key) || {};
      const actions = availableActions.get(key) || [];

      const action = actions.find(a => a.actionId === input.actionId);
      if (!action) {
        return { success: false, message: 'Action not found' };
      }

      // Check cost
      if (action.cost && (context.currency || 0) < action.cost) {
        return { success: false, message: 'Not enough currency' };
      }

      // Deduct cost
      if (action.cost) {
        context.currency = (context.currency || 0) - action.cost;
        pairContexts.set(key, context);
      }

      console.log('[LocalDevAdapter] Action executed:', {
        ...input,
        actionName: action.name,
        cost: action.cost,
      });

      return { success: true, message: `${action.name} completed!` };
    },
  };
}

/**
 * Get all recorded turn results (for testing/debugging).
 */
export function getTurnResults(): TurnResultInput[] {
  return [...turnResults];
}

/**
 * Clear all in-memory state (for testing).
 */
export function clearLocalState(): void {
  userIdentities.clear();
  pairContexts.clear();
  turnResults.length = 0;
  availableActions.clear();
}

/**
 * Set up a specific user identity for testing.
 */
export function setUserIdentity(identity: UserIdentity): void {
  userIdentities.set(identity.userId, identity);
}

/**
 * Set up specific pair context for testing.
 */
export function setPairContext(
  userId: string,
  characterId: string,
  context: PairContext
): void {
  pairContexts.set(`${userId}:${characterId}`, context);
}
