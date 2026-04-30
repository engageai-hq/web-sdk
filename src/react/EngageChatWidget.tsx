import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EngageAI } from '../core/EngageAI';
import { ApiClient } from '../core/ApiClient';
import { AudioService } from '../services/AudioService';
import { useEngageAI } from './useEngageAI';
import type { ChatMessage } from '../models';

export interface EngageChatWidgetProps {
  engageAI: EngageAI;
  open: boolean;
  onClose: () => void;
  title?: string;
  welcomeMessage?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
}

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export function EngageChatWidget({
  engageAI,
  open,
  onClose,
  title = 'AI Assistant',
  welcomeMessage,
  primaryColor = '#6366f1',
  position = 'bottom-right',
}: EngageChatWidgetProps) {
  const { messages, status, sendMessage, confirm, deny } = useEngageAI(engageAI);
  const [text, setText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioService | null>(null);
  const clientRef = useRef(new ApiClient(engageAI.config));

  const getAudio = () => { audioRef.current ??= new AudioService(); return audioRef.current; };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open && audioRef.current?.isRecording) {
      audioRef.current.stopRecording().catch(() => {});
      setVoiceStatus('idle');
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const msg = text.trim();
    if (!msg || status === 'sending') return;
    setText('');
    await sendMessage(msg);
  }, [text, status, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMic = useCallback(async () => {
    const audio = getAudio();
    setVoiceError(null);

    if (voiceStatus === 'listening') {
      setVoiceStatus('processing');
      try {
        const blob = await audio.stopRecording();
        const transcript = await clientRef.current.transcribeBlob(blob);
        if (!transcript.trim()) { setVoiceError("Didn't catch that — try again"); setVoiceStatus('idle'); return; }
        const action = await engageAI.sendMessage(transcript);
        if (action.message) {
          setVoiceStatus('speaking');
          const buf = await clientRef.current.synthesizeSpeech(action.message);
          await audio.playArrayBuffer(buf);
        }
        setVoiceStatus('idle');
      } catch (err) {
        setVoiceError(String(err));
        setVoiceStatus('idle');
      }
      return;
    }

    const granted = await audio.requestPermissions();
    if (!granted) { setVoiceError('Microphone permission denied'); return; }
    try { await audio.startRecording(); setVoiceStatus('listening'); }
    catch (err) { setVoiceError(String(err)); }
  }, [voiceStatus, engageAI]);

  const displayMessages: ChatMessage[] = welcomeMessage
    ? [{ id: '__welcome__', content: welcomeMessage, sender: 'agent', timestamp: new Date(0) }, ...messages]
    : messages;

  const isBusy = status === 'sending' || status === 'executing' || voiceStatus === 'processing';
  const lastMsg = displayMessages[displayMessages.length - 1];
  const needsConfirm = lastMsg?.isConfirmation;

  const side = position === 'bottom-left' ? { left: 24 } : { right: 24 };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 96, ...side, zIndex: 9998,
      width: 380, maxWidth: 'calc(100vw - 48px)',
      height: 520, maxHeight: 'calc(100vh - 120px)',
      background: '#fff', borderRadius: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: primaryColor, color: '#fff', borderRadius: '16px 16px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, opacity: 0.8, padding: 4 }}>✕</button>
      </div>

      {/* Status bar */}
      {(isBusy || voiceStatus === 'speaking' || voiceStatus === 'listening') && (
        <div style={{ padding: '6px 16px', fontSize: 12, color: primaryColor, background: `${primaryColor}10`, borderBottom: '1px solid #f0f0f0' }}>
          {voiceStatus === 'listening' ? '🎙 Listening…'
            : voiceStatus === 'processing' ? '⟳ Processing…'
            : voiceStatus === 'speaking' ? '🔊 Speaking…'
            : '⟳ Thinking…'}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayMessages.length === 0 && (
          <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginTop: 40 }}>Send a message to get started</div>
        )}
        {displayMessages.map((msg) => (
          <Bubble key={msg.id} msg={msg} primaryColor={primaryColor} />
        ))}

        {needsConfirm && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={confirm} style={{ flex: 1, padding: '10px 0', background: primaryColor, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Confirm</button>
            <button onClick={deny} style={{ flex: 1, padding: '10px 0', background: '#f1f1f1', color: '#555', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Voice error */}
      {voiceError && (
        <div style={{ padding: '6px 16px', fontSize: 12, color: '#e53e3e', background: '#fff5f5' }}>⚠ {voiceError}</div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          disabled={isBusy}
          style={{
            flex: 1, resize: 'none', border: '1px solid #e5e7eb', borderRadius: 20,
            padding: '10px 14px', fontSize: 14, fontFamily: 'inherit',
            outline: 'none', maxHeight: 80, lineHeight: 1.4,
          }}
        />
        <button
          onClick={handleMic}
          disabled={status === 'sending' || voiceStatus === 'processing'}
          title={voiceStatus === 'listening' ? 'Stop recording' : 'Start voice input'}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: voiceStatus === 'listening' ? '#e53e3e' : '#f3f4f6',
            color: voiceStatus === 'listening' ? '#fff' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}
        >
          {voiceStatus === 'listening' ? '⏹' : '🎤'}
        </button>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isBusy}
          style={{
            width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: text.trim() && !isBusy ? primaryColor : '#e5e7eb',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

function Bubble({ msg, primaryColor }: { msg: ChatMessage; primaryColor: string }) {
  const isUser = msg.sender === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? primaryColor : '#f3f4f6',
        color: isUser ? '#fff' : '#1f2937',
        fontSize: 14, lineHeight: 1.5,
      }}>
        {msg.content}
      </div>
    </div>
  );
}
