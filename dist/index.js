"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ApiClient: () => ApiClient,
  AudioService: () => AudioService,
  EngageAI: () => EngageAI,
  EngageAIApiException: () => EngageAIApiException
});
module.exports = __toCommonJS(src_exports);

// src/core/ApiClient.ts
var EngageAIApiException = class extends Error {
  constructor(statusCode, path, message) {
    super(`EngageAIApiException(${statusCode} on ${path}): ${message}`);
    this.statusCode = statusCode;
    this.path = path;
    this.name = "EngageAIApiException";
  }
};
var ApiClient = class {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.serverUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      "X-EngageAI-Key": config.apiKey
    };
    this.timeoutMs = (config.timeoutSeconds ?? 30) * 1e3;
  }
  async registerManifest(manifest) {
    const data = await this.post(
      "/api/v1/register",
      { manifest }
    );
    if (!data.success) throw new Error("Failed to register manifest");
    return data.character_url ?? null;
  }
  async sendMessage(opts) {
    const body = {
      session_id: opts.sessionId,
      app_id: this.config.appId,
      message: opts.message
    };
    if (opts.userContext) body["user_context"] = opts.userContext;
    return this.parseChatResponse(await this.post("/api/v1/chat", body));
  }
  async sendFunctionResults(opts) {
    return this.parseChatResponse(
      await this.post("/api/v1/results", {
        session_id: opts.sessionId,
        app_id: this.config.appId,
        results: opts.results
      })
    );
  }
  async sendConfirmation(opts) {
    return this.parseChatResponse(
      await this.post("/api/v1/confirm", {
        session_id: opts.sessionId,
        app_id: this.config.appId,
        confirmed: opts.confirmed
      })
    );
  }
  /** Upload a recorded audio Blob and return the transcribed text. */
  async transcribeBlob(blob) {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("language", "en");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/voice/transcribe`, {
        method: "POST",
        headers: { "X-EngageAI-Key": this.config.apiKey },
        body: form,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new EngageAIApiException(response.status, "/api/v1/voice/transcribe", await response.text());
    const data = await response.json();
    return data.text ?? "";
  }
  /** Fetch TTS audio and return an ArrayBuffer (MP3). */
  async synthesizeSpeech(text, voice = "nova") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/voice/synthesize`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ text, voice, speed: 1 }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new EngageAIApiException(response.status, "/api/v1/voice/synthesize", await response.text());
    return response.arrayBuffer();
  }
  // ─── Private ─────────────────────────────────────────────────────────────
  async post(path, body) {
    const url = `${this.baseUrl}${path}`;
    if (this.config.debug) console.log(`[EngageAI] POST ${path}`, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    if (this.config.debug) console.log(`[EngageAI] ${response.status}:`, text);
    if (response.ok) return JSON.parse(text);
    throw new EngageAIApiException(response.status, path, text);
  }
  parseChatResponse(data) {
    const raw = data["action"];
    return {
      sessionId: data["session_id"],
      conversationLength: data["conversation_length"] ?? 0,
      action: {
        actionType: raw["action_type"],
        message: raw["message"] ?? null,
        functionCalls: (raw["function_calls"] ?? []).map((fc) => ({
          functionName: fc["function_name"],
          arguments: fc["arguments"],
          callId: fc["call_id"]
        }))
      }
    };
  }
};

// src/core/EngageAI.ts
var _counter = 0;
function uid() {
  return `${Date.now().toString(36)}-${(++_counter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
var EngageAI = class {
  constructor(config) {
    this.config = config;
    this._functions = /* @__PURE__ */ new Map();
    this._messages = [];
    this._sessionId = `sess_${uid()}`;
    this._initialized = false;
    this._characterUrl = null;
    this._client = new ApiClient(config);
  }
  get isInitialized() {
    return this._initialized;
  }
  get currentSessionId() {
    return this._sessionId;
  }
  get characterUrl() {
    return this._characterUrl;
  }
  get messages() {
    return [...this._messages];
  }
  registerFunction(fn) {
    this._functions.set(fn.name, fn);
    if (this.config.debug) console.log(`[EngageAI] registered: ${fn.name}`);
  }
  registerFunctions(fns) {
    fns.forEach((fn) => this.registerFunction(fn));
  }
  setUserContext(ctx) {
    this._userContext = ctx;
  }
  async initialize() {
    if (this._functions.size === 0) {
      throw new Error("No functions registered. Call registerFunction() before initialize().");
    }
    const manifest = {
      app_id: this.config.appId,
      app_name: this.config.appName,
      version: "1.0.0",
      description: this.config.description ?? "",
      domain: this.config.domain ?? "other",
      functions: Array.from(this._functions.values()).map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
        requires_confirmation: fn.requiresConfirmation ?? false
      }))
    };
    this._characterUrl = await this._client.registerManifest(manifest);
    this._initialized = true;
    if (this.config.debug) console.log(`[EngageAI] initialized with ${this._functions.size} functions`);
  }
  async sendMessage(text) {
    this._ensureInit();
    this._push({ content: text, sender: "user" });
    const res = await this._client.sendMessage({
      sessionId: this._sessionId,
      message: text,
      userContext: this._userContext
    });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }
  async confirm() {
    this._ensureInit();
    this._push({ content: "Confirmed \u2713", sender: "user" });
    const res = await this._client.sendConfirmation({ sessionId: this._sessionId, confirmed: true });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }
  async deny() {
    this._ensureInit();
    this._push({ content: "Cancelled \u2717", sender: "user" });
    const res = await this._client.sendConfirmation({ sessionId: this._sessionId, confirmed: false });
    this._sessionId = res.sessionId;
    return this._handle(res.action);
  }
  resetSession() {
    this._sessionId = `sess_${uid()}`;
    this._messages = [];
    this._notify();
  }
  // ─── Private ───────────────────────────────────────────────────────────────
  async _handle(action) {
    switch (action.actionType) {
      case "respond":
      case "clarify":
      case "error":
        if (action.message) this._push({ content: action.message, sender: "agent" });
        this.onAgentAction?.(action);
        return action;
      case "confirm":
        if (action.message) {
          this._messages.push({ id: uid(), content: action.message, sender: "agent", timestamp: /* @__PURE__ */ new Date(), isConfirmation: true });
          this._notify();
        }
        this.onAgentAction?.(action);
        return action;
      case "function_call":
        if (action.message) this._push({ content: action.message, sender: "agent" });
        return this._execFunctions(action.functionCalls);
    }
  }
  async _execFunctions(calls) {
    const results = [];
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
  _push(opts) {
    this._messages.push({ id: uid(), content: opts.content, sender: opts.sender, timestamp: /* @__PURE__ */ new Date() });
    this._notify();
  }
  _notify() {
    this.onMessagesChanged?.(this.messages);
  }
  _ensureInit() {
    if (!this._initialized) throw new Error("EngageAI not initialized. Call initialize() first.");
  }
};

// src/services/AudioService.ts
var AudioService = class {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioCtx = null;
    this.currentSource = null;
    this.currentStream = null;
  }
  async requestPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }
  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.currentStream = stream;
    this.audioChunks = [];
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => MediaRecorder.isTypeSupported(t)
    ) ?? "";
    this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : void 0);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start();
  }
  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recording"));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType ?? "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.currentStream?.getTracks().forEach((t) => t.stop());
        this.currentStream = null;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
  async playArrayBuffer(buffer) {
    this.stopPlayback();
    this.audioCtx ?? (this.audioCtx = new AudioContext());
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
    const audioBuffer = await this.audioCtx.decodeAudioData(buffer);
    return new Promise((resolve) => {
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      source.onended = () => {
        this.currentSource = null;
        resolve();
      };
      this.currentSource = source;
      source.start();
    });
  }
  stopPlayback() {
    try {
      this.currentSource?.stop();
    } catch {
    }
    this.currentSource = null;
  }
  get isRecording() {
    return this.mediaRecorder?.state === "recording";
  }
  get isPlaying() {
    return this.currentSource !== null;
  }
  dispose() {
    this.stopPlayback();
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.stop();
    this.currentStream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ApiClient,
  AudioService,
  EngageAI,
  EngageAIApiException
});
//# sourceMappingURL=index.js.map