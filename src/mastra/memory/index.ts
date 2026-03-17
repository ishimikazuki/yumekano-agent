export { retrieveMemory, type RetrievalInput, type RetrievalResult } from './retrieval';
export {
  getOrCreateWorkingMemory,
  updateWorkingMemory,
  addCooldown,
  clearExpiredCooldowns,
  addCorrection,
  updateRelationshipStance,
  updateTensionSummary,
} from './working-memory';
export {
  mergeDuplicateFacts,
  pruneLowSalienceEvents,
  resolveStaleThreads,
  getMemoryStats,
  shouldTriggerConsolidationFromStats,
  getEventsForObservation,
  createObservationFromEvents,
  type ConsolidationConfig,
} from './consolidation';
export {
  updateQualityScore,
  markAsHelpful,
  markAsUnhelpful,
  linkEvalFailure,
  decayUnusedQuality,
  getQualityDistribution,
  boostRetrievedMemoryQuality,
  type QualityLabel,
} from './quality-labels';
