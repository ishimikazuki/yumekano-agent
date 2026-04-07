import { memoryRepo, workspaceRepo } from '@/lib/repositories';
import type {
  WorkingMemory,
  MemoryEvent,
  MemoryFact,
  MemoryFactStatus,
  MemoryObservation,
  OpenThread,
  PADState,
  MemoryUsage,
} from '@/lib/schemas';

export type MemoryScopeId = string;

export type MemoryStore = {
  getWorkingMemory(scopeId: MemoryScopeId): Promise<WorkingMemory | null>;
  setWorkingMemory(scopeId: MemoryScopeId, data: WorkingMemory): Promise<void>;
  getDefaultWorkingMemory(): WorkingMemory;
  getOpenThreads(scopeId: MemoryScopeId): Promise<OpenThread[]>;
  getFacts(scopeId: MemoryScopeId, options?: { status?: MemoryFactStatus }): Promise<MemoryFact[]>;
  getFactsBySubject(scopeId: MemoryScopeId, subject: string): Promise<MemoryFact[]>;
  getEvents(scopeId: MemoryScopeId, limit?: number): Promise<MemoryEvent[]>;
  getObservations(scopeId: MemoryScopeId, limit?: number): Promise<MemoryObservation[]>;
  createEvent(input: {
    scopeId: MemoryScopeId;
    sourceTurnId: string | null;
    eventType: string;
    summary: string;
    salience: number;
    retrievalKeys: string[];
    emotionSignature: PADState | null;
    participants: string[];
    supersedesEventId?: string | null;
  }): Promise<MemoryEvent>;
  createFact(input: {
    scopeId: MemoryScopeId;
    subject: string;
    predicate: string;
    object: unknown;
    confidence: number;
    sourceEventId?: string | null;
    supersedesFactId?: string | null;
  }): Promise<MemoryFact>;
  createObservation(input: {
    scopeId: MemoryScopeId;
    summary: string;
    retrievalKeys: string[];
    salience: number;
    windowStartAt: Date;
    windowEndAt: Date;
  }): Promise<MemoryObservation>;
  createOrUpdateThread(input: {
    scopeId: MemoryScopeId;
    key: string;
    summary: string;
    severity: number;
    openedByEventId?: string | null;
  }): Promise<OpenThread>;
  resolveThread(
    scopeId: MemoryScopeId,
    key: string,
    resolvedByEventId?: string | null
  ): Promise<void>;
  updateEventQuality(eventId: string, qualityScore: number): Promise<void>;
  updateFactStatus(factId: string, status: MemoryFactStatus): Promise<void>;
  updateObservationQuality(observationId: string, qualityScore: number): Promise<void>;
  createMemoryUsage(input: {
    scopeId: MemoryScopeId;
    memoryItemType: MemoryUsage['memoryItemType'];
    memoryItemId: string;
    turnId: string;
    wasSelected: boolean;
    wasHelpful: boolean | null;
    scoreDelta: number | null;
  }): Promise<MemoryUsage>;
};

export function createProductionMemoryStore(): MemoryStore {
  return {
    getWorkingMemory: (scopeId) => memoryRepo.getWorkingMemory(scopeId),
    setWorkingMemory: (scopeId, data) => memoryRepo.setWorkingMemory(scopeId, data),
    getDefaultWorkingMemory: () => memoryRepo.getDefaultWorkingMemory(),
    getOpenThreads: (scopeId) => memoryRepo.getOpenThreads(scopeId),
    getFacts: (scopeId, options) => memoryRepo.getFactsByPair(scopeId, options),
    getFactsBySubject: (scopeId, subject) => memoryRepo.getFactsBySubject(scopeId, subject),
    getEvents: (scopeId, limit) => memoryRepo.getEventsByPair(scopeId, limit),
    getObservations: (scopeId, limit) => memoryRepo.getObservationsByPair(scopeId, limit),
    createEvent: ({ scopeId, ...rest }) => memoryRepo.createEvent({ pairId: scopeId, ...rest }),
    createFact: ({ scopeId, ...rest }) => memoryRepo.createFact({ pairId: scopeId, ...rest }),
    createObservation: ({ scopeId, ...rest }) =>
      memoryRepo.createObservation({ pairId: scopeId, ...rest }),
    createOrUpdateThread: ({ scopeId, ...rest }) =>
      memoryRepo.createOrUpdateThread({ pairId: scopeId, ...rest }),
    resolveThread: (scopeId, key, resolvedByEventId) =>
      memoryRepo.resolveThread(scopeId, key, resolvedByEventId ?? null),
    updateEventQuality: (eventId, qualityScore) => memoryRepo.updateEventQuality(eventId, qualityScore),
    updateFactStatus: (factId, status) => memoryRepo.updateFactStatus(factId, status),
    updateObservationQuality: (observationId, qualityScore) =>
      memoryRepo.updateObservationQuality(observationId, qualityScore),
    createMemoryUsage: ({ scopeId: _scopeId, ...rest }) => memoryRepo.createMemoryUsage(rest),
  };
}

export function createSandboxMemoryStore(): MemoryStore {
  return {
    getWorkingMemory: (scopeId) => workspaceRepo.getSandboxWorkingMemory(scopeId),
    setWorkingMemory: (scopeId, data) => workspaceRepo.saveSandboxWorkingMemory(scopeId, data),
    getDefaultWorkingMemory: () => workspaceRepo.getDefaultSandboxWorkingMemory(),
    getOpenThreads: (scopeId) => workspaceRepo.getSandboxOpenThreads(scopeId),
    getFacts: (scopeId, options) => workspaceRepo.getSandboxFactsBySession(scopeId, options),
    getFactsBySubject: (scopeId, subject) => workspaceRepo.getSandboxFactsBySubject(scopeId, subject),
    getEvents: (scopeId, limit) => workspaceRepo.getSandboxEventsBySession(scopeId, limit),
    getObservations: (scopeId, limit) => workspaceRepo.getSandboxObservationsBySession(scopeId, limit),
    createEvent: ({ scopeId, ...rest }) => workspaceRepo.createSandboxEvent({ sessionId: scopeId, ...rest }),
    createFact: ({ scopeId, ...rest }) => workspaceRepo.createSandboxFact({ sessionId: scopeId, ...rest }),
    createObservation: ({ scopeId, ...rest }) =>
      workspaceRepo.createSandboxObservation({ sessionId: scopeId, ...rest }),
    createOrUpdateThread: ({ scopeId, ...rest }) =>
      workspaceRepo.createOrUpdateSandboxThread({ sessionId: scopeId, ...rest }),
    resolveThread: (scopeId, key, resolvedByEventId) =>
      workspaceRepo.resolveSandboxThread(scopeId, key, resolvedByEventId ?? null),
    updateEventQuality: (eventId, qualityScore) =>
      workspaceRepo.updateSandboxEventQuality(eventId, qualityScore),
    updateFactStatus: (factId, status) => workspaceRepo.updateSandboxFactStatus(factId, status),
    updateObservationQuality: (observationId, qualityScore) =>
      workspaceRepo.updateSandboxObservationQuality(observationId, qualityScore),
    createMemoryUsage: ({ scopeId, ...rest }) =>
      workspaceRepo.createSandboxMemoryUsage({ sessionId: scopeId, ...rest }),
  };
}
