import {
  ApiClient,
  AudioService
} from "../chunk-66GOFHXP.mjs";

// src/react/useEngageAI.ts
import { useState, useCallback, useRef, useEffect } from "react";
function useEngageAI(engageAI) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [lastAction, setLastAction] = useState(null);
  const [error, setError] = useState(null);
  const aiRef = useRef(engageAI);
  aiRef.current = engageAI;
  useEffect(() => {
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
  const sendMessage = useCallback(async (text) => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.sendMessage(text);
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const confirm = useCallback(async () => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.confirm();
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const deny = useCallback(async () => {
    setError(null);
    setStatus("sending");
    try {
      await aiRef.current.deny();
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }, []);
  const resetSession = useCallback(() => {
    aiRef.current.resetSession();
    setMessages([]);
    setStatus("idle");
    setLastAction(null);
    setError(null);
  }, []);
  const clearError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);
  return { messages, status, lastAction, error, sendMessage, confirm, deny, resetSession, clearError };
}

// src/react/EngageFab.tsx
import { useState as useState3 } from "react";

// src/react/EngageChatWidget.tsx
import { useCallback as useCallback2, useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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
  const [text, setText] = useState2("");
  const [voiceStatus, setVoiceStatus] = useState2("idle");
  const [voiceError, setVoiceError] = useState2(null);
  const bottomRef = useRef2(null);
  const audioRef = useRef2(null);
  const clientRef = useRef2(new ApiClient(engageAI.config));
  const getAudio = () => {
    audioRef.current ?? (audioRef.current = new AudioService());
    return audioRef.current;
  };
  useEffect2(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect2(() => {
    if (!open && audioRef.current?.isRecording) {
      audioRef.current.stopRecording().catch(() => {
      });
      setVoiceStatus("idle");
    }
  }, [open]);
  const handleSend = useCallback2(async () => {
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
  const handleMic = useCallback2(async () => {
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
  return /* @__PURE__ */ jsxs("div", { style: {
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
    /* @__PURE__ */ jsxs("div", { style: {
      padding: "14px 16px",
      borderBottom: "1px solid #f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: primaryColor,
      color: "#fff",
      borderRadius: "16px 16px 0 0"
    }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsx("div", { style: { width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)" } }),
        /* @__PURE__ */ jsx("span", { style: { fontWeight: 600, fontSize: 15 }, children: title })
      ] }),
      /* @__PURE__ */ jsx("button", { onClick: onClose, style: { background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, opacity: 0.8, padding: 4 }, children: "\u2715" })
    ] }),
    (isBusy || voiceStatus === "speaking" || voiceStatus === "listening") && /* @__PURE__ */ jsx("div", { style: { padding: "6px 16px", fontSize: 12, color: primaryColor, background: `${primaryColor}10`, borderBottom: "1px solid #f0f0f0" }, children: voiceStatus === "listening" ? "\u{1F399} Listening\u2026" : voiceStatus === "processing" ? "\u27F3 Processing\u2026" : voiceStatus === "speaking" ? "\u{1F50A} Speaking\u2026" : "\u27F3 Thinking\u2026" }),
    /* @__PURE__ */ jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }, children: [
      displayMessages.length === 0 && /* @__PURE__ */ jsx("div", { style: { color: "#aaa", fontSize: 14, textAlign: "center", marginTop: 40 }, children: "Send a message to get started" }),
      displayMessages.map((msg) => /* @__PURE__ */ jsx(Bubble, { msg, primaryColor }, msg.id)),
      needsConfirm && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, marginTop: 4 }, children: [
        /* @__PURE__ */ jsx("button", { onClick: confirm, style: { flex: 1, padding: "10px 0", background: primaryColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }, children: "Confirm" }),
        /* @__PURE__ */ jsx("button", { onClick: deny, style: { flex: 1, padding: "10px 0", background: "#f1f1f1", color: "#555", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }, children: "Cancel" })
      ] }),
      /* @__PURE__ */ jsx("div", { ref: bottomRef })
    ] }),
    voiceError && /* @__PURE__ */ jsxs("div", { style: { padding: "6px 16px", fontSize: 12, color: "#e53e3e", background: "#fff5f5" }, children: [
      "\u26A0 ",
      voiceError
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { padding: "10px 12px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, alignItems: "flex-end" }, children: [
      /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }, children: /* @__PURE__ */ jsx("div", { style: {
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
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ChatIcon = () => /* @__PURE__ */ jsx2("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ jsx2("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", fill: "white" }) });
var CloseIcon = () => /* @__PURE__ */ jsx2("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ jsx2("path", { d: "M18 6L6 18M6 6l12 12", stroke: "white", strokeWidth: "2.5", strokeLinecap: "round" }) });
function EngageFab({
  engageAI,
  primaryColor = "#6366f1",
  size = 56,
  position = "bottom-right",
  title,
  welcomeMessage
}) {
  const [open, setOpen] = useState3(false);
  const side = position === "bottom-left" ? { left: 24 } : { right: 24 };
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2(
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
        children: open ? /* @__PURE__ */ jsx2(CloseIcon, {}) : /* @__PURE__ */ jsx2(ChatIcon, {})
      }
    ),
    /* @__PURE__ */ jsx2(
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
export {
  EngageChatWidget,
  EngageFab,
  useEngageAI
};
//# sourceMappingURL=index.mjs.map