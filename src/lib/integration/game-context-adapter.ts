/**
 * Game Context Adapter Interface
 *
 * Defines the contract for integrating with external game backends.
 * Because game integration is undecided, this interface allows different
 * implementations to be swapped in later.
 */

export interface UserIdentity {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  tier?: 'free' | 'premium' | 'vip';
}

export interface PairContext {
  currency?: number;
  inventory?: string[];
  eventFlags?: Record<string, boolean>;
  relationshipOverrides?: Record<string, unknown>;
  unlockedPhases?: string[];
  achievementCount?: number;
}

export interface TurnResultInput {
  userId: string;
  characterId: string;
  turnId: string;
  phaseId: string;
  stateDelta: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * GameContextAdapter interface for game backend integration.
 *
 * Implement this interface to connect the agent to your game backend.
 */
export interface GameContextAdapter {
  /**
   * Get the current user's identity from the game session.
   */
  getUserIdentity(): Promise<UserIdentity>;

  /**
   * Get game context for a user-character pair.
   * This includes currency, inventory, event flags, and relationship overrides.
   */
  getPairContext(input: {
    userId: string;
    characterId: string;
  }): Promise<PairContext>;

  /**
   * Record the result of a conversation turn back to the game.
   * This allows the game to update state based on conversation outcomes.
   */
  recordTurnResult(input: TurnResultInput): Promise<void>;

  /**
   * Check if a feature or action is available for this user.
   */
  checkFeatureAccess?(input: {
    userId: string;
    featureId: string;
  }): Promise<boolean>;

  /**
   * Get available actions/gifts the user can trigger during conversation.
   */
  getAvailableActions?(input: {
    userId: string;
    characterId: string;
  }): Promise<Array<{
    actionId: string;
    name: string;
    cost?: number;
    cooldownRemaining?: number;
  }>>;

  /**
   * Execute a game action triggered during conversation.
   */
  executeAction?(input: {
    userId: string;
    characterId: string;
    actionId: string;
    turnId: string;
  }): Promise<{ success: boolean; message?: string }>;
}

/**
 * Create a no-op adapter that returns empty/default values.
 * Useful for testing or when no game backend is connected.
 */
export function createNoOpAdapter(): GameContextAdapter {
  return {
    async getUserIdentity() {
      return { userId: 'unknown' };
    },
    async getPairContext() {
      return {};
    },
    async recordTurnResult() {
      // No-op
    },
    async checkFeatureAccess() {
      return true;
    },
    async getAvailableActions() {
      return [];
    },
    async executeAction() {
      return { success: false, message: 'No adapter configured' };
    },
  };
}
