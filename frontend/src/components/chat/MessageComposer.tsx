import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  disabled?: boolean;
  offline?: boolean;
  onSend: (text: string) => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  disabled = false,
  offline = false,
  onSend,
}) => {
  const [text, setText] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-3 border-t border-cbox-border bg-cbox-surface"
    >
      <textarea
        rows={1}
        value={text}
        maxLength={2000}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder={offline ? 'Offline — reconnect to send messages…' : 'Write a message…'}
        aria-label="Message input"
        className="flex-1 resize-none max-h-32 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text placeholder:text-cbox-muted focus:border-cbox-accent"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        className="h-10 w-10 shrink-0 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover disabled:opacity-40 flex items-center justify-center transition"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
};
