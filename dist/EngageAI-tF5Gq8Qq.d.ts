interface EngageAIConfig {
    serverUrl: string;
    appId: string;
    apiKey: string;
    appName: string;
    domain?: string;
    description?: string;
    debug?: boolean;
    timeoutSeconds?: number;
}
interface EngageUserContext {
    userId: string;
    displayName?: string;
    data?: Record<string, unknown>;
}
type FunctionHandler = (params: Record<string, unknown>) => Promise<unknown>;
interface AppFunction {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: FunctionHandler;
    requiresConfirmation?: boolean;
}
type AgentActionType = 'respond' | 'function_call' | 'confirm' | 'clarify' | 'error';
interface FunctionCallRequest {
    functionName: string;
    arguments: Record<string, unknown>;
    callId: string;
}
interface AgentAction {
    actionType: AgentActionType;
    message: string | null;
    functionCalls: FunctionCallRequest[];
}
type MessageSender = 'user' | 'agent';
interface ChatMessage {
    id: string;
    content: string;
    sender: MessageSender;
    timestamp: Date;
    isConfirmation?: boolean;
}

declare class EngageAI {
    readonly config: EngageAIConfig;
    private readonly _client;
    private readonly _functions;
    private _messages;
    private _sessionId;
    private _userContext?;
    private _initialized;
    private _characterUrl;
    onAgentAction?: (action: AgentAction) => void;
    onFunctionExecuting?: (name: string) => void;
    onMessagesChanged?: (messages: ChatMessage[]) => void;
    constructor(config: EngageAIConfig);
    get isInitialized(): boolean;
    get currentSessionId(): string;
    get characterUrl(): string | null;
    get messages(): ChatMessage[];
    registerFunction(fn: AppFunction): void;
    registerFunctions(fns: AppFunction[]): void;
    setUserContext(ctx: EngageUserContext): void;
    initialize(): Promise<void>;
    sendMessage(text: string): Promise<AgentAction>;
    confirm(): Promise<AgentAction>;
    deny(): Promise<AgentAction>;
    resetSession(): void;
    private _handle;
    private _execFunctions;
    private _push;
    private _notify;
    private _ensureInit;
}

export { type AgentAction as A, type ChatMessage as C, type EngageAIConfig as E, type FunctionCallRequest as F, type MessageSender as M, type EngageUserContext as a, type AgentActionType as b, type AppFunction as c, EngageAI as d, type FunctionHandler as e };
