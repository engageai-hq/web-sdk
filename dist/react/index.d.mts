import { C as ChatMessage, A as AgentAction, d as EngageAI } from '../EngageAI-tF5Gq8Qq.mjs';
import * as react_jsx_runtime from 'react/jsx-runtime';

type ConversationStatus = 'idle' | 'sending' | 'executing' | 'error';
interface UseEngageAIResult {
    messages: ChatMessage[];
    status: ConversationStatus;
    lastAction: AgentAction | null;
    error: string | null;
    sendMessage: (text: string) => Promise<void>;
    confirm: () => Promise<void>;
    deny: () => Promise<void>;
    resetSession: () => void;
    clearError: () => void;
}
declare function useEngageAI(engageAI: EngageAI): UseEngageAIResult;

interface EngageFabProps {
    engageAI: EngageAI;
    primaryColor?: string;
    size?: number;
    position?: 'bottom-right' | 'bottom-left';
    title?: string;
    welcomeMessage?: string;
}
declare function EngageFab({ engageAI, primaryColor, size, position, title, welcomeMessage, }: EngageFabProps): react_jsx_runtime.JSX.Element;

interface EngageChatWidgetProps {
    engageAI: EngageAI;
    open: boolean;
    onClose: () => void;
    title?: string;
    welcomeMessage?: string;
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left';
}
declare function EngageChatWidget({ engageAI, open, onClose, title, welcomeMessage, primaryColor, position, }: EngageChatWidgetProps): react_jsx_runtime.JSX.Element | null;

export { type ConversationStatus, EngageChatWidget, type EngageChatWidgetProps, EngageFab, type EngageFabProps, type UseEngageAIResult, useEngageAI };
