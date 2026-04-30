/**
 * EngageAI drop-in widget — pure DOM, no framework required.
 *
 * Usage:
 *   <script>
 *     window.EngageAIConfig = {
 *       serverUrl: 'https://engageai-sdk-production.up.railway.app',
 *       appId: 'my-app',
 *       apiKey: 'eai_...',
 *       appName: 'My App',
 *       title: 'AI Assistant',          // optional
 *       primaryColor: '#6366f1',        // optional
 *       welcomeMessage: 'Hi! ...',      // optional
 *       position: 'bottom-right',       // optional
 *       functions: [                    // optional
 *         { name: 'fn', description: '...', parameters: {}, handler: async (p) => ({}) }
 *       ],
 *     };
 *   </script>
 *   <script src="https://cdn.engageai.tech/widget/v1.js"></script>
 */

import { EngageAI } from '../core/EngageAI';
import { ApiClient } from '../core/ApiClient';
import { AudioService } from '../services/AudioService';
import type { AppFunction, ChatMessage, AgentAction } from '../models';

interface WidgetConfig {
  serverUrl: string;
  appId: string;
  apiKey: string;
  appName: string;
  title?: string;
  primaryColor?: string;
  welcomeMessage?: string;
  position?: 'bottom-right' | 'bottom-left';
  functions?: AppFunction[];
}

declare global {
  interface Window { EngageAIConfig?: WidgetConfig; }
}

function init(cfg: WidgetConfig) {
  const color = cfg.primaryColor ?? '#6366f1';
  const title = cfg.title ?? 'AI Assistant';
  const pos = cfg.position ?? 'bottom-right';
  const side = pos === 'bottom-left' ? 'left:24px' : 'right:24px';

  // ─── SDK ───────────────────────────────────────────────────────────────────
  const ai = new EngageAI({ serverUrl: cfg.serverUrl, appId: cfg.appId, apiKey: cfg.apiKey, appName: cfg.appName });
  const client = new ApiClient(ai.config);
  const audio = new AudioService();

  if (cfg.functions?.length) {
    ai.registerFunctions(cfg.functions);
  } else {
    // Register a no-op placeholder so initialize() succeeds for pure-chat use
    ai.registerFunction({ name: '__chat__', description: 'General chat', parameters: {}, handler: async () => ({}) });
  }

  let initialized = false;
  const ensureInit = async () => {
    if (!initialized) { await ai.initialize(); initialized = true; }
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  let messages: ChatMessage[] = cfg.welcomeMessage
    ? [{ id: '__w__', content: cfg.welcomeMessage, sender: 'agent', timestamp: new Date(0) }]
    : [];
  let voiceStatus: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
  let chatOpen = false;

  // ─── DOM ───────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'engageai-widget-root';
  root.style.cssText = 'position:fixed;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
  document.body.appendChild(root);

  // FAB
  const fab = document.createElement('button');
  fab.style.cssText = `position:fixed;bottom:24px;${side};width:56px;height:56px;border-radius:50%;background:${color};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:999999;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:transform 0.2s;`;
  fab.innerHTML = chatSVG();
  fab.onmouseenter = () => fab.style.transform = 'scale(1.05)';
  fab.onmouseleave = () => fab.style.transform = 'scale(1)';
  root.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.style.cssText = `display:none;position:fixed;bottom:96px;${side};width:380px;max-width:calc(100vw - 48px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.18);flex-direction:column;z-index:999998;overflow:hidden;`;
  root.appendChild(panel);

  // Header
  const header = el('div', `padding:14px 16px;background:${color};color:#fff;display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0;`);
  header.innerHTML = `<span style="font-weight:600;font-size:15px;">${esc(title)}</span>`;
  const closeBtn = el('button', 'background:none;border:none;color:#fff;cursor:pointer;font-size:18px;opacity:0.8;padding:4px;line-height:1;');
  closeBtn.textContent = '✕';
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Status bar
  const statusBar = el('div', `display:none;padding:6px 16px;font-size:12px;color:${color};background:${color}18;border-bottom:1px solid #f0f0f0;`);
  panel.appendChild(statusBar);

  // Messages
  const msgList = el('div', 'flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px;');
  panel.appendChild(msgList);

  // Voice error
  const errorBar = el('div', 'display:none;padding:6px 16px;font-size:12px;color:#e53e3e;background:#fff5f5;');
  panel.appendChild(errorBar);

  // Input row
  const inputRow = el('div', 'padding:10px 12px;border-top:1px solid #f0f0f0;display:flex;gap:8px;align-items:flex-end;');
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type a message…';
  textarea.rows = 1;
  textarea.style.cssText = 'flex:1;resize:none;border:1px solid #e5e7eb;border-radius:20px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;max-height:80px;line-height:1.4;';
  const micBtn = el('button', `width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;background:#f3f4f6;color:#555;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;`);
  micBtn.textContent = '🎤';
  const sendBtn = el('button', `width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;background:#e5e7eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;`);
  sendBtn.textContent = '➤';
  inputRow.append(textarea, micBtn, sendBtn);
  panel.appendChild(inputRow);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderMessages = () => {
    msgList.innerHTML = '';
    if (messages.length === 0) {
      const empty = el('div', 'color:#aaa;font-size:14px;text-align:center;margin-top:40px;');
      empty.textContent = 'Send a message to get started';
      msgList.appendChild(empty);
      return;
    }
    messages.forEach((msg) => {
      const isUser = msg.sender === 'user';
      const wrap = el('div', `display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};`);
      const bubble = el('div', `max-width:80%;padding:10px 14px;border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isUser ? color : '#f3f4f6'};color:${isUser ? '#fff' : '#1f2937'};font-size:14px;line-height:1.5;`);
      bubble.textContent = msg.content;
      wrap.appendChild(bubble);
      msgList.appendChild(wrap);

      if (msg.isConfirmation) {
        const row = el('div', 'display:flex;gap:8px;margin-top:4px;');
        const yes = el('button', `flex:1;padding:10px 0;background:${color};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;`);
        yes.textContent = 'Confirm';
        yes.onclick = () => handleConfirm();
        const no = el('button', 'flex:1;padding:10px 0;background:#f1f1f1;color:#555;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;');
        no.textContent = 'Cancel';
        no.onclick = () => handleDeny();
        row.append(yes, no);
        msgList.appendChild(row);
      }
    });
    msgList.scrollTop = msgList.scrollHeight;
  };

  const setStatus = (text: string) => {
    if (text) { statusBar.textContent = text; statusBar.style.display = 'block'; }
    else statusBar.style.display = 'none';
  };

  const setError = (text: string) => {
    if (text) { errorBar.textContent = `⚠ ${text}`; errorBar.style.display = 'block'; }
    else errorBar.style.display = 'none';
  };

  const pushMessage = (content: string, sender: 'user' | 'agent', isConfirmation = false) => {
    messages.push({ id: `${Date.now()}`, content, sender, timestamp: new Date(), isConfirmation });
    renderMessages();
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  ai.onAgentAction = (action: AgentAction) => {
    setStatus('');
    if (action.message) pushMessage(action.message, 'agent', action.actionType === 'confirm');
  };

  const handleSend = async () => {
    const msg = textarea.value.trim();
    if (!msg) return;
    textarea.value = '';
    sendBtn.style.background = '#e5e7eb';
    pushMessage(msg, 'user');
    setStatus('⟳ Thinking…'); setError('');
    try {
      await ensureInit();
      await ai.sendMessage(msg);
    } catch (err) { setError(String(err)); }
    setStatus('');
  };

  const handleConfirm = async () => {
    setStatus('⟳ Thinking…');
    try { await ai.confirm(); } catch (err) { setError(String(err)); }
    setStatus('');
  };

  const handleDeny = async () => {
    setStatus('⟳ Thinking…');
    try { await ai.deny(); } catch (err) { setError(String(err)); }
    setStatus('');
  };

  const handleMic = async () => {
    setError('');
    if (voiceStatus === 'listening') {
      voiceStatus = 'processing';
      micBtn.textContent = '⟳'; micBtn.style.background = '#f3f4f6'; micBtn.style.color = '#555';
      setStatus('⟳ Processing…');
      try {
        const blob = await audio.stopRecording();
        await ensureInit();
        const transcript = await client.transcribeBlob(blob);
        if (!transcript.trim()) { setError("Didn't catch that — try again"); voiceStatus = 'idle'; setStatus(''); micBtn.textContent = '🎤'; return; }
        pushMessage(transcript, 'user');
        setStatus('⟳ Thinking…');
        const action = await ai.sendMessage(transcript);
        if (action.message) {
          voiceStatus = 'speaking'; setStatus('🔊 Speaking…');
          const buf = await client.synthesizeSpeech(action.message);
          await audio.playArrayBuffer(buf);
        }
      } catch (err) { setError(String(err)); }
      voiceStatus = 'idle'; micBtn.textContent = '🎤'; micBtn.style.background = '#f3f4f6'; micBtn.style.color = '#555'; setStatus('');
      return;
    }
    const granted = await audio.requestPermissions();
    if (!granted) { setError('Microphone permission denied'); return; }
    try {
      await audio.startRecording();
      voiceStatus = 'listening';
      micBtn.textContent = '⏹'; micBtn.style.background = '#e53e3e'; micBtn.style.color = '#fff';
      setStatus('🎙 Listening…');
    } catch (err) { setError(String(err)); }
  };

  // ─── Toggle ─────────────────────────────────────────────────────────────────

  const openPanel = () => {
    chatOpen = true;
    panel.style.display = 'flex';
    fab.innerHTML = closeSVG();
    renderMessages();
    textarea.focus();
  };

  const closePanel = () => {
    chatOpen = false;
    panel.style.display = 'none';
    fab.innerHTML = chatSVG();
  };

  // ─── Events ─────────────────────────────────────────────────────────────────

  fab.onclick = () => chatOpen ? closePanel() : openPanel();
  closeBtn.onclick = closePanel;
  sendBtn.onclick = handleSend;
  micBtn.onclick = handleMic;
  textarea.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  textarea.oninput = () => { sendBtn.style.background = textarea.value.trim() ? color : '#e5e7eb'; };

  renderMessages();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function el(tag: string, css: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  return e;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chatSVG(): string {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/></svg>';
}

function closeSVG(): string {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>';
}

// ─── Auto-init ───────────────────────────────────────────────────────────────

const cfg = window.EngageAIConfig;
if (cfg?.appId && cfg?.apiKey && cfg?.serverUrl) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(cfg));
  } else {
    init(cfg);
  }
}

export { init };
