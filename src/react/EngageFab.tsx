import React, { useState } from 'react';
import { EngageAI } from '../core/EngageAI';
import { EngageChatWidget } from './EngageChatWidget';

export interface EngageFabProps {
  engageAI: EngageAI;
  primaryColor?: string;
  size?: number;
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  welcomeMessage?: string;
}

const ChatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export function EngageFab({
  engageAI,
  primaryColor = '#6366f1',
  size = 56,
  position = 'bottom-right',
  title,
  welcomeMessage,
}: EngageFabProps) {
  const [open, setOpen] = useState(false);
  const side = position === 'bottom-left' ? { left: 24 } : { right: 24 };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        style={{
          position: 'fixed', bottom: 24, ...side,
          width: size, height: size, borderRadius: size / 2,
          background: primaryColor, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      <EngageChatWidget
        engageAI={engageAI}
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        welcomeMessage={welcomeMessage}
        primaryColor={primaryColor}
        position={position}
      />
    </>
  );
}
