import {
  PhaseGraph,
  PhaseNode,
  PhaseEdge,
  TransitionCondition,
  PairState,
  PADState,
  OpenThread,
  type DialogueAct,
} from '../schemas';

export type PhaseEngineContext = {
  pairState: PairState;
  pad: PADState;
  openThreads: OpenThread[];
  events: Map<string, boolean>; // eventKey -> exists
  topics: Map<string, number>; // topicKey -> count
  turnsSinceLastTransition: number;
  daysSinceEntry: number;
};

export type PhaseTransitionResult = {
  shouldTransition: boolean;
  targetPhaseId: string | null;
  reason: string;
  satisfiedConditions: string[];
  failedConditions: string[];
};

/**
 * Phase engine for evaluating and executing phase transitions.
 */
export class PhaseEngine {
  private graph: PhaseGraph;
  private nodesById: Map<string, PhaseNode>;

  constructor(graph: PhaseGraph) {
    this.graph = graph;
    this.nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  }

  /**
   * Get a phase node by ID.
   */
  getPhase(phaseId: string): PhaseNode | undefined {
    return this.nodesById.get(phaseId);
  }

  /**
   * Get the entry phase.
   */
  getEntryPhase(): PhaseNode {
    const entry = this.nodesById.get(this.graph.entryPhaseId);
    if (!entry) {
      throw new Error(`Entry phase ${this.graph.entryPhaseId} not found`);
    }
    return entry;
  }

  /**
   * Get available edges from a phase.
   */
  getEdgesFrom(phaseId: string): PhaseEdge[] {
    return this.graph.edges
      .filter((e) => e.from === phaseId)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  /**
   * Evaluate if a transition should occur.
   */
  evaluateTransition(
    currentPhaseId: string,
    context: PhaseEngineContext
  ): PhaseTransitionResult {
    const edges = this.getEdgesFrom(currentPhaseId);

    for (const edge of edges) {
      const result = this.evaluateEdge(edge, context);
      if (result.shouldTransition) {
        return result;
      }
    }

    return {
      shouldTransition: false,
      targetPhaseId: null,
      reason: 'No transition conditions met',
      satisfiedConditions: [],
      failedConditions: [],
    };
  }

  /**
   * Evaluate a single edge.
   */
  private evaluateEdge(
    edge: PhaseEdge,
    context: PhaseEngineContext
  ): PhaseTransitionResult {
    const results = edge.conditions.map((c) => ({
      condition: c,
      satisfied: this.evaluateCondition(c, context),
    }));

    const satisfied = results.filter((r) => r.satisfied);
    const failed = results.filter((r) => !r.satisfied);

    const shouldTransition = edge.allMustPass
      ? failed.length === 0
      : satisfied.length > 0;

    return {
      shouldTransition,
      targetPhaseId: shouldTransition ? edge.to : null,
      reason: shouldTransition
        ? edge.authoredBeat ?? `Transition to ${edge.to}`
        : `${failed.length} conditions not met`,
      satisfiedConditions: satisfied.map((r) => this.describeCondition(r.condition)),
      failedConditions: failed.map((r) => this.describeCondition(r.condition)),
    };
  }

  /**
   * Evaluate a single condition.
   */
  private evaluateCondition(
    condition: TransitionCondition,
    context: PhaseEngineContext
  ): boolean {
    switch (condition.type) {
      case 'metric': {
        const value = this.getMetricValue(condition.field, context);
        return condition.op === '>='
          ? value >= condition.value
          : value <= condition.value;
      }
      case 'topic': {
        const count = context.topics.get(condition.topicKey) ?? 0;
        return count >= (condition.minCount ?? 1);
      }
      case 'event': {
        const exists = context.events.get(condition.eventKey) ?? false;
        return exists === condition.exists;
      }
      case 'emotion': {
        const value = context.pad[condition.field];
        return condition.op === '>='
          ? value >= condition.value
          : value <= condition.value;
      }
      case 'openThread': {
        const thread = context.openThreads.find((t) => t.key === condition.threadKey);
        if (!thread) return condition.status === 'resolved';
        return thread.status === condition.status;
      }
      case 'time': {
        const value =
          condition.field === 'turnsSinceLastTransition'
            ? context.turnsSinceLastTransition
            : context.daysSinceEntry;
        return value >= condition.value;
      }
      default:
        return false;
    }
  }

  /**
   * Get metric value from context.
   */
  private getMetricValue(
    field: 'trust' | 'affinity' | 'intimacy_readiness' | 'conflict',
    context: PhaseEngineContext
  ): number {
    switch (field) {
      case 'trust':
        return context.pairState.trust;
      case 'affinity':
        return context.pairState.affinity;
      case 'intimacy_readiness':
        return context.pairState.intimacyReadiness;
      case 'conflict':
        return context.pairState.conflict;
    }
  }

  /**
   * Describe a condition for logging/tracing.
   */
  private describeCondition(condition: TransitionCondition): string {
    switch (condition.type) {
      case 'metric':
        return `${condition.field} ${condition.op} ${condition.value}`;
      case 'topic':
        return `topic:${condition.topicKey} >= ${condition.minCount ?? 1}`;
      case 'event':
        return `event:${condition.eventKey} ${condition.exists ? 'exists' : 'not exists'}`;
      case 'emotion':
        return `emotion.${condition.field} ${condition.op} ${condition.value}`;
      case 'openThread':
        return `thread:${condition.threadKey} is ${condition.status}`;
      case 'time':
        return `${condition.field} >= ${condition.value}`;
      default:
        return 'unknown condition';
    }
  }

  /**
   * Check if an act is allowed in a phase.
   */
  isActAllowed(phaseId: string, act: string | DialogueAct): boolean {
    const phase = this.getPhase(phaseId);
    if (!phase) return false;

    const dialogueAct = act as DialogueAct;

    if (phase.disallowedActs.includes(dialogueAct)) return false;
    if (phase.allowedActs.length > 0 && !phase.allowedActs.includes(dialogueAct)) {
      return false;
    }
    return true;
  }

  /**
   * Check intimacy eligibility for a phase.
   */
  getIntimacyEligibility(phaseId: string): 'never' | 'conditional' | 'allowed' {
    const phase = this.getPhase(phaseId);
    return phase?.adultIntimacyEligibility ?? 'never';
  }
}

/**
 * Create a phase engine from a graph.
 */
export function createPhaseEngine(graph: PhaseGraph): PhaseEngine {
  return new PhaseEngine(graph);
}
