import { E as EngageAIConfig, a as EngageUserContext, A as AgentAction } from './EngageAI-tF5Gq8Qq.mjs';
export { b as AgentActionType, c as AppFunction, C as ChatMessage, d as EngageAI, F as FunctionCallRequest, e as FunctionHandler, M as MessageSender } from './EngageAI-tF5Gq8Qq.mjs';

interface ChatApiResponse {
    sessionId: string;
    action: AgentAction;
    conversationLength: number;
}
declare class EngageAIApiException extends Error {
    readonly statusCode: number;
    readonly path: string;
    constructor(statusCode: number, path: string, message: string);
}
declare class ApiClient {
    private readonly config;
    private readonly baseUrl;
    private readonly headers;
    private readonly timeoutMs;
    constructor(config: EngageAIConfig);
    registerManifest(manifest: Record<string, unknown>): Promise<string | null>;
    sendMessage(opts: {
        sessionId: string;
        message: string;
        userContext?: EngageUserContext;
    }): Promise<ChatApiResponse>;
    sendFunctionResults(opts: {
        sessionId: string;
        results: Array<Record<string, unknown>>;
    }): Promise<ChatApiResponse>;
    sendConfirmation(opts: {
        sessionId: string;
        confirmed: boolean;
    }): Promise<ChatApiResponse>;
    /** Upload a recorded audio Blob and return the transcribed text. */
    transcribeBlob(blob: Blob): Promise<string>;
    /** Fetch TTS audio and return an ArrayBuffer (MP3). */
    synthesizeSpeech(text: string, voice?: string): Promise<ArrayBuffer>;
    private post;
    private parseChatResponse;
}

declare class AudioService {
    private mediaRecorder;
    private audioChunks;
    private audioCtx;
    private currentSource;
    private currentStream;
    requestPermissions(): Promise<boolean>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<Blob>;
    playArrayBuffer(buffer: ArrayBuffer): Promise<void>;
    stopPlayback(): void;
    get isRecording(): boolean;
    get isPlaying(): boolean;
    dispose(): void;
}

export { AgentAction, ApiClient, AudioService, type ChatApiResponse, EngageAIApiException, EngageAIConfig, EngageUserContext };
