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

// src/react/index.ts
var react_exports = {};
__export(react_exports, {
  EngageChatWidget: () => EngageChatWidget,
  EngageFab: () => EngageFab,
  useEngageAI: () => useEngageAI
});
module.exports = __toCommonJS(react_exports);

// src/react/useEngageAI.ts
var import_react = require("react");
function useEngageAI(engageAI) {
  const [messages, setMessages] = (0, import_react.useState)([]);
  const [status, setStatus] = (0, import_react.useState)("idle");
  const [lastAction, setLastAction] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  const aiRef = (0, import_react.useRef)(engageAI);
  aiRef.current = engageAI;
  (0, import_react.useEffect)(() => {
    engageAI.onMessagesChanged = (msgs) => setMessages([...msgs]);
    engageAI.onFunctionExecuting = () => setStatus("executing");
    engageAI.onAgentAction = (action) => {
      setLastAction(action);
      setStatus("idle");
    };
    return () => {
      engageAI.onMessagesChanged = void 0;
      engageAI.onFunctionExecuting = void 0;
      engageAI.onAgentAction = void 0;
    };
  }, [engageAI]);
  const sendMessage = (0, import_react.useCallback)(async (text) => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.sendMessage(text);
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const confirm = (0, import_react.useCallback)(async () => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.confirm();
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const deny = (0, import_react.useCallback)(async () => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.deny();
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const resetSession = (0, import_react.useCallback)(() => {
    aiRef.current.resetSession();
    setMessages([]);
    setStatus("idle");
    setLastAction(null);
    setError(null);
  }, []);
  const clearError = (0, import_react.useCallback)(() => {
    setError(null);
    setStatus("idle");
  }, []);
  return { messages, status, lastAction, error, sendMessage, confirm, deny, resetSession, clearError };
}

// src/react/EngageFab.tsx
var import_react3 = require("react");

// src/react/EngageChatWidget.tsx
var import_react2 = require("react");

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

// src/react/EngageChatWidget.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function EngageChatWidget({
  engageAI,
  open,
  onClose,
  title = "AI Assistant",
  welcomeMessage,
  primaryColor = "#6366f1",
  position = "bottom-right"
}) {
  const { messages, status, sendMessage, confirm, deny } = useEngageAI(engageAI);
  const [text, setText] = (0, import_react2.useState)("");
  const [voiceStatus, setVoiceStatus] = (0, import_react2.useState)("idle");
  const [voiceError, setVoiceError] = (0, import_react2.useState)(null);
  const bottomRef = (0, import_react2.useRef)(null);
  const audioRef = (0, import_react2.useRef)(null);
  const clientRef = (0, import_react2.useRef)(new ApiClient(engageAI.config));
  const getAudio = () => {
    audioRef.current ?? (audioRef.current = new AudioService());
    return audioRef.current;
  };
  (0, import_react2.useEffect)(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  (0, import_react2.useEffect)(() => {
    if (!open && audioRef.current?.isRecording) {
      audioRef.current.stopRecording().catch(() => {
      });
      setVoiceStatus("idle");
    }
  }, [open]);
  const handleSend = (0, import_react2.useCallback)(async () => {
    const msg = text.trim();
    if (!msg || status === "sending") return;
    setText("");
    await sendMessage(msg);
  }, [text, status, sendMessage]);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleMic = (0, import_react2.useCallback)(async () => {
    const audio = getAudio();
    setVoiceError(null);
    if (voiceStatus === "listening") {
      setVoiceStatus("processing");
      try {
        const blob = await audio.stopRecording();
        const transcript = await clientRef.current.transcribeBlob(blob);
        if (!transcript.trim()) {
          setVoiceError("Didn't catch that \u2014 try again");
          setVoiceStatus("idle");
          return;
        }
        const action = await engageAI.sendMessage(transcript);
        if (action.message) {
          setVoiceStatus("speaking");
          const buf = await clientRef.current.synthesizeSpeech(action.message);
          await audio.playArrayBuffer(buf);
        }
        setVoiceStatus("idle");
      } catch (err) {
        setVoiceError(String(err));
        setVoiceStatus("idle");
      }
      return;
    }
    const granted = await audio.requestPermissions();
    if (!granted) {
      setVoiceError("Microphone permission denied");
      return;
    }
    try {
      await audio.startRecording();
      setVoiceStatus("listening");
    } catch (err) {
      setVoiceError(String(err));
    }
  }, [voiceStatus, engageAI]);
  const displayMessages = welcomeMessage ? [{ id: "__welcome__", content: welcomeMessage, sender: "agent", timestamp: /* @__PURE__ */ new Date(0) }, ...messages] : messages;
  const isBusy = status === "sending" || status === "executing" || voiceStatus === "processing";
  const lastMsg = displayMessages[displayMessages.length - 1];
  const needsConfirm = lastMsg?.isConfirmation;
  const side = position === "bottom-left" ? { left: 24 } : { right: 24 };
  if (!open) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
    position: "fixed",
    bottom: 96,
    ...side,
    zIndex: 9998,
    width: 380,
    maxWidth: "calc(100vw - 48px)",
    height: 520,
    maxHeight: "calc(100vh - 120px)",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: "hidden"
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: {
      padding: "14px 16px",
      borderBottom: "1px solid #f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: primaryColor,
      color: "#fff",
      borderRadius: "16px 16px 0 0"
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)" } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 15 }, children: title })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: onClose, style: { background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, opacity: 0.8, padding: 4 }, children: "\u2715" })
    ] }),
    (isBusy || voiceStatus === "speaking" || voiceStatus === "listening") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "6px 16px", fontSize: 12, color: primaryColor, background: `${primaryColor}10`, borderBottom: "1px solid #f0f0f0" }, children: voiceStatus === "listening" ? "\u{1F399} Listening\u2026" : voiceStatus === "processing" ? "\u27F3 Processing\u2026" : voiceStatus === "speaking" ? "\u{1F50A} Speaking\u2026" : "\u27F3 Thinking\u2026" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }, children: [
      displayMessages.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#aaa", fontSize: 14, textAlign: "center", marginTop: 40 }, children: "Send a message to get started" }),
      displayMessages.map((msg) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, { msg, primaryColor }, msg.id)),
      needsConfirm && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: confirm, style: { flex: 1, padding: "10px 0", background: primaryColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }, children: "Confirm" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { onClick: deny, style: { flex: 1, padding: "10px 0", background: "#f1f1f1", color: "#555", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }, children: "Cancel" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: bottomRef })
    ] }),
    voiceError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "6px 16px", fontSize: 12, color: "#e53e3e", background: "#fff5f5" }, children: [
      "\u26A0 ",
      voiceError
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "10px 12px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, alignItems: "flex-end" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "textarea",
        {
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder: "Type a message\u2026",
          rows: 1,
          disabled: isBusy,
          style: {
            flex: 1,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: "10px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
            maxHeight: 80,
            lineHeight: 1.4
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          onClick: handleMic,
          disabled: status === "sending" || voiceStatus === "processing",
          title: voiceStatus === "listening" ? "Stop recording" : "Start voice input",
          style: {
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: voiceStatus === "listening" ? "#e53e3e" : "#f3f4f6",
            color: voiceStatus === "listening" ? "#fff" : "#555",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0
          },
          children: voiceStatus === "listening" ? "\u23F9" : "\u{1F3A4}"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          onClick: handleSend,
          disabled: !text.trim() || isBusy,
          style: {
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: text.trim() && !isBusy ? primaryColor : "#e5e7eb",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0
          },
          children: "\u27A4"
        }
      )
    ] })
  ] });
}
function Bubble({ msg, primaryColor }) {
  const isUser = msg.sender === "user";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: {
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
    background: isUser ? primaryColor : "#f3f4f6",
    color: isUser ? "#fff" : "#1f2937",
    fontSize: 14,
    lineHeight: 1.5
  }, children: msg.content }) });
}

// src/react/EngageFab.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var ChatIcon = () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", fill: "white" }) });
var CloseIcon = () => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M18 6L6 18M6 6l12 12", stroke: "white", strokeWidth: "2.5", strokeLinecap: "round" }) });
function EngageFab({
  engageAI,
  primaryColor = "#6366f1",
  size = 56,
  position = "bottom-right",
  title,
  welcomeMessage
}) {
  const [open, setOpen] = (0, import_react3.useState)(false);
  const side = position === "bottom-left" ? { left: 24 } : { right: 24 };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        onClick: () => setOpen((o) => !o),
        "aria-label": open ? "Close chat" : "Open chat",
        style: {
          position: "fixed",
          bottom: 24,
          ...side,
          width: size,
          height: size,
          borderRadius: size / 2,
          background: primaryColor,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          transition: "transform 0.2s, box-shadow 0.2s"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "scale(1)";
        },
        children: open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloseIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ChatIcon, {})
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      EngageChatWidget,
      {
        engageAI,
        open,
        onClose: () => setOpen(false),
        title,
        welcomeMessage,
        primaryColor,
        position
      }
    )
  ] });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EngageChatWidget,
  EngageFab,
  useEngageAI
});
//# sourceMappingURL=index.js.map