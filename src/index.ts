// ─── Core ─────────────────────────────────────────────────────────────────────
export { EngageAI } from './core/EngageAI';
export { ApiClient, EngageAIApiException } from './core/ApiClient';
export type { ChatApiResponse } from './core/ApiClient';

// ─── Services ────────────────────────────────────────────────────────────────
export { AudioService } from './services/AudioService';

// ─── Models ──────────────────────────────────────────────────────────────────
export type {
  EngageAIConfig,
  EngageUserContext,
  AppFunction,
  FunctionHandler,
  AgentAction,
  AgentActionType,
  FunctionCallRequest,
  ChatMessage,
  MessageSender,
} from './models';
