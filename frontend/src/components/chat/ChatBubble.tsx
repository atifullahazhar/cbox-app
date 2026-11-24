import React from 'react';
import { RotateCcw, Clock, Check, CheckCheck } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onRetry?: () => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isOwn, onRetry }) => {
  const timeLabel = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
          isOwn
            ? 'bg-cbox-accent text-slate-950 rounded-br-md font-medium'
            : 'bg-cbox-elevated text-cbox-text border border-cbox-border rounded-bl-md'
        } ${message.deliveryState === 'FAILED' ? 'opacity-80 ring-1 ring-cbox-danger' : ''}`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-cbox-muted px-1">
        <span>{timeLabel}</span>
        {isOwn && (
          <>
            {message.deliveryState === 'SENDING' && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Sending…
              </span>
            )}
            {message.deliveryState === 'SENT' && <Check className="h-3.5 w-3.5" />}
            {(message.deliveryState === 'DELIVERED' || message.deliveryState === 'READ') && (
              <CheckCheck className="h-3.5 w-3.5 text-cbox-accent" />
            )}
            {message.deliveryState === 'FAILED' && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-cbox-danger font-semibold hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Failed — Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
