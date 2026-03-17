export {
  type GameContextAdapter,
  type UserIdentity,
  type PairContext,
  type TurnResultInput,
  createNoOpAdapter,
} from './game-context-adapter';

export {
  createLocalDevAdapter,
  getTurnResults,
  clearLocalState,
  setUserIdentity,
  setPairContext,
} from './local-dev-adapter';
