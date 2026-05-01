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

export {
  EngageAIApiException,
  ApiClient,
  AudioService
};
//# sourceMappingURL=chunk-66GOFHXP.mjs.map