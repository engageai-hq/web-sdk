import type { EngageAIConfig, EngageUserContext, AgentAction } from '../models';

export interface ChatApiResponse {
  sessionId: string;
  action: AgentAction;
  conversationLength: number;
}

export class EngageAIApiException extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly path: string,
    message: string,
  ) {
    super(`EngageAIApiException(${statusCode} on ${path}): ${message}`);
    this.name = 'EngageAIApiException';
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(private readonly config: EngageAIConfig) {
    this.baseUrl = config.serverUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      'X-EngageAI-Key': config.apiKey,
    };
    this.timeoutMs = (config.timeoutSeconds ?? 30) * 1000;
  }

  async registerManifest(manifest: Record<string, unknown>): Promise<string | null> {
    const data = await this.post<{ success: boolean; character_url?: string }>(
      '/api/v1/register',
      { manifest },
    );
    if (!data.success) throw new Error('Failed to register manifest');
    return data.character_url ?? null;
  }

  async sendMessage(opts: {
    sessionId: string;
    message: string;
    userContext?: EngageUserContext;
  }): Promise<ChatApiResponse> {
    const body: Record<string, unknown> = {
      session_id: opts.sessionId,
      app_id: this.config.appId,
      message: opts.message,
    };
    if (opts.userContext) body['user_context'] = opts.userContext;
    return this.parseChatResponse(await this.post<Record<string, unknown>>('/api/v1/chat', body));
  }

  async sendFunctionResults(opts: {
    sessionId: string;
    results: Array<Record<string, unknown>>;
  }): Promise<ChatApiResponse> {
    return this.parseChatResponse(
      await this.post<Record<string, unknown>>('/api/v1/results', {
        session_id: opts.sessionId,
        app_id: this.config.appId,
        results: opts.results,
      }),
    );
  }

  async sendConfirmation(opts: {
    sessionId: string;
    confirmed: boolean;
  }): Promise<ChatApiResponse> {
    return this.parseChatResponse(
      await this.post<Record<string, unknown>>('/api/v1/confirm', {
        session_id: opts.sessionId,
        app_id: this.config.appId,
        confirmed: opts.confirmed,
      }),
    );
  }

  /** Upload a recorded audio Blob and return the transcribed text. */
  async transcribeBlob(blob: Blob): Promise<string> {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('file', blob, `audio.${ext}`);
    form.append('language', 'en');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/voice/transcribe`, {
        method: 'POST',
        headers: { 'X-EngageAI-Key': this.config.apiKey },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new EngageAIApiException(response.status, '/api/v1/voice/transcribe', await response.text());
    const data = await response.json() as { text?: string };
    return data.text ?? '';
  }

  /** Fetch TTS audio and return an ArrayBuffer (MP3). */
  async synthesizeSpeech(text: string, voice = 'nova'): Promise<ArrayBuffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/voice/synthesize`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ text, voice, speed: 1.0 }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new EngageAIApiException(response.status, '/api/v1/voice/synthesize', await response.text());
    return response.arrayBuffer();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    if (this.config.debug) console.log(`[EngageAI] POST ${path}`, body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    if (this.config.debug) console.log(`[EngageAI] ${response.status}:`, text);
    if (response.ok) return JSON.parse(text) as T;
    throw new EngageAIApiException(response.status, path, text);
  }

  private parseChatResponse(data: Record<string, unknown>): ChatApiResponse {
    const raw = data['action'] as Record<string, unknown>;
    return {
      sessionId: data['session_id'] as string,
      conversationLength: (data['conversation_length'] as number) ?? 0,
      action: {
        actionType: raw['action_type'] as AgentAction['actionType'],
        message: (raw['message'] as string) ?? null,
        functionCalls: ((raw['function_calls'] as Array<Record<string, unknown>>) ?? []).map((fc) => ({
          functionName: fc['function_name'] as string,
          arguments: fc['arguments'] as Record<string, unknown>,
          callId: fc['call_id'] as string,
        })),
      },
    };
  }
}
