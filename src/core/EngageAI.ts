import type { EngageAIConfig, EngageUserContext, AppFunction, AgentAction, ChatMessage, FunctionCallRequest } from '../models';
import { ApiClient } from './ApiClient';

let _counter = 0;
function uid(): string {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class EngageAI {
  private readonly _client: ApiClient;
  private readonly _functions = new Map<string, AppFunction>();
  private _messages: ChatMessage[] = [];
  private _sessionId: string = `sess_${uid()}`;
  private _userContext?: EngageUserContext;
  private _initialized = false;
  private _characterUrl: string | null = null;

  onAgentAction?: (action: AgentAction) => void;
  onFunctionExecuting?: (name: string) => void;
  onMessagesChanged?: (messages: ChatMessage[]) => void;

  constructor(readonly config: EngageAIConfig) {
    this._client = new ApiClient(config);
  }

  get isInitialized() { return this._initialized; }
  get currentSessionId() { return this._sessionId; }
  get characterUrl() { return this._characterUrl; }
  get messages(): ChatMessage[] { return [...this._messages]; }

  registerFunction(fn: AppFunction): void {
    this._functions.set(fn.name, fn);
    if (this.config.debug) console.log(`[EngageAI] registered: ${fn.name}`);
  }

  registerFunctions(fns: AppFunction[]): void {
    fns.forEach((fn) => this.registerFunction(fn));
  }

  setUserContext(ctx: EngageUserContext): void {
    this._userContext = ctx;
  }

  async initialize(): Promise<void> {
    if (this._functions.size === 0) {
      throw new Error('No functions registered. Call registerFunction() before initialize().');
    }
    const manifest = {
      app_id: this.config.appId,
      app_name: this.config.appName,
      version: '1.0.0',
      description: this.config.description ?? '',
      domain: this.config.domain ?? 'other',
      functions: Array.from(this._functions.values()).map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
        requires_confirmation: fn.requiresConfirmation ?? false,
      })),
    };
    this._characterUrl = await this._client.registerManifest(manifest);
    this._initialized = true;
    if (this.config.debug) console.log(`[EngageAI] initialized with ${this._functions.size} functions`);
  }

  async sendMessage(text: string): Promise<AgentAction> {
    this._ensureInit();
    this._push({ content: text, sender: 'user' });
    const res = await this._client.sendMessage({
      sessionId: this._sessionId,
      message: text,
      userContext: this._userContext,
    });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }

  async confirm(): Promise<AgentAction> {
    this._ensureInit();
    this._push({ content: 'Confirmed ✓', sender: 'user' });
    const res = await this._client.sendConfirmation({ sessionId: this._sessionId, confirmed: true });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }

  async deny(): Promise<AgentAction> {
    this._ensureInit();
    this._push({ content: 'Cancelled ✗', sender: 'user' });
    const res = await this._client.sendConfirmation({ sessionId: this._sessionId, confirmed: false });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }

  resetSession(): void {
    this._sessionId = `sess_${uid()}`;
    this._messages = [];
    this._notify();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async _handle(action: AgentAction): Promise<AgentAction> {
    switch (action.actionType) {
      case 'respond':
      case 'clarify':
      case 'error':
        if (action.message) this._push({ content: action.message, sender: 'agent' });
        this.onAgentAction?.(action);
        return action;

      case 'confirm':
        if (action.message) {
          this._messages.push({ id: uid(), content: action.message, sender: 'agent', timestamp: new Date(), isConfirmation: true });
          this._notify();
        }
        this.onAgentAction?.(action);
        return action;

      case 'function_call':
        if (action.message) this._push({ content: action.message, sender: 'agent' });
        return this._execFunctions(action.functionCalls);
    }
  }

  private async _execFunctions(calls: FunctionCallRequest[]): Promise<AgentAction> {
    const results: Array<Record<string, unknown>> = [];
    for (const call of calls) {
      const fn = this._functions.get(call.functionName);
      if (!fn) {
        results.push({ call_id: call.callId, function_name: call.functionName, success: false, error: `Function "${call.functionName}" not registered` });
        continue;
      }
      this.onFunctionExecuting?.(call.functionName);
      try {
        const result = await fn.handler(call.arguments);
        results.push({ call_id: call.callId, function_name: call.functionName, success: true, result });
      } catch (err) {
        results.push({ call_id: call.callId, function_name: call.functionName, success: false, error: String(err) });
      }
    }
    const res = await this._client.sendFunctionResults({ sessionId: this._sessionId, results });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }

  private _push(opts: { content: string; sender: 'user' | 'agent' }): void {
    this._messages.push({ id: uid(), content: opts.content, sender: opts.sender, timestamp: new Date() });
    this._notify();
  }

  private _notify(): void { this.onMessagesChanged?.(this.messages); }

  private _ensureInit(): void {
    if (!this._initialized) throw new Error('EngageAI not initialized. Call initialize() first.');
  }
}
