import { isStickerMessage } from '../ui/RankBadge';
import React, { useRef, useState } from 'react';
import {
  RotateCcw,
  Clock,
  Check,
  CheckCheck,
  Reply,
  Smile,
  Pencil,
  Trash2,
  Ban,
} from 'lucide-react';
import type { ChatMessage } from '../../types';

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👍', '😮', '😢'];

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  friendName: string;
  onRetry?: () => void;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onEdit?: (newContent: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isOwn,
  currentUserId,
  friendName,
  onRetry,
  onReply,
  onReact,
  onEdit,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.content);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isDeleted = Boolean(message.deletedAt);
  const timeLabel = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  function cycleSpeed() {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const clean = draftText.trim();
    if (!clean || !onEdit) return;
    await onEdit(clean);
    setEditing(false);
  }

  return (
    <div
      className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowPicker(false);
      }}
    >
      <div
        className={`flex items-end gap-1.5 max-w-[88%] sm:max-w-[74%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        onDoubleClick={() => {
          if (!isDeleted && onReact) onReact('❤️');
        }}
        onClick={() => setShowActions((v) => !v)}
      >
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
            isDeleted
              ? 'bg-cbox-elevated/60 text-cbox-muted italic border border-cbox-border'
              : isOwn
                ? 'bg-cbox-accent text-slate-950 rounded-br-md font-medium shadow-sm'
                : 'bg-cbox-elevated text-cbox-text border border-cbox-border rounded-bl-md'
          } ${message.deliveryState === 'FAILED' ? 'opacity-80 ring-1 ring-cbox-danger' : ''}`}
        >
          {/* Quoted Reply Preview */}
          {!isDeleted && message.replyTo && (
            <div
              className={`mb-2 px-2.5 py-1.5 rounded-lg text-xs border-l-2 ${
                isOwn
                  ? 'bg-slate-950/15 border-slate-950/50 text-slate-950/85'
                  : 'bg-cbox-surface/80 border-cbox-accent text-cbox-muted'
              }`}
            >
              <span className="font-semibold block text-[11px]">
                {message.replyTo.senderId === currentUserId ? 'You' : friendName}
              </span>
              <span className="line-clamp-1">{message.replyTo.content}</span>
            </div>
          )}

          {isDeleted ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Ban className="h-3.5 w-3.5" /> This message was deleted
            </span>
          ) : editing ? (
            <form onSubmit={handleSaveEdit} className="space-y-2 min-w-[200px]">
              <input
                type="text"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                autoFocus
                className="w-full rounded-lg bg-cbox-surface text-cbox-text border border-cbox-border px-2.5 py-1.5 text-xs"
              />
              <div className="flex justify-end gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-2 py-1 rounded bg-slate-950/20 text-slate-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded bg-slate-950 text-white font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* In-Chat Image */}
              {message.mediaKind === 'IMAGE' && message.mediaUrl && (
                <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="block mb-1.5">
                  <img
                    src={message.mediaUrl}
                    alt="Shared chat photo"
                    loading="lazy"
                    className="rounded-xl max-h-64 w-auto object-cover border border-black/10"
                  />
                </a>
              )}

              {/* In-Chat Short Video Clip */}
              {message.mediaKind === 'VIDEO' && message.mediaUrl && (
                <video
                  src={message.mediaUrl}
                  controls
                  preload="metadata"
                  className="mb-1.5 rounded-xl max-h-64 w-full border border-black/10"
                />
              )}

              {/* In-Chat Voice Note with Speed Control */}
              {message.mediaKind === 'AUDIO' && message.mediaUrl && (
                <div className="flex items-center gap-2 min-w-[210px] py-0.5">
                  <audio
                    ref={audioRef}
                    src={message.mediaUrl}
                    controls
                    preload="metadata"
                    className="h-9 max-w-[190px]"
                  />
                  <button
                    type="button"
                    onClick={cycleSpeed}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                      isOwn ? 'bg-slate-950/15 text-slate-950' : 'bg-cbox-surface text-cbox-text border border-cbox-border'
                    }`}
                  >
                    {speed}x
                  </button>
                </div>
              )}

              {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
            </>
          )}
        </div>

        {/* Hover / Tap Action Bar */}
        {!isDeleted && message.deliveryState !== 'SENDING' && message.deliveryState !== 'FAILED' && (
          <div
            className={`relative flex items-center gap-0.5 transition-opacity ${
              showActions || showPicker ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
            }`}
          >
            {onReact && (
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                aria-label="React to message"
                className="p-1.5 rounded-lg text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
            )}
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                aria-label="Reply to message"
                className="p-1.5 rounded-lg text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwn && onEdit && !message.mediaKind && (
              <button
                type="button"
                onClick={() => {
                  setDraftText(message.content);
                  setEditing(true);
                }}
                aria-label="Edit message"
                className="p-1.5 rounded-lg text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwn && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete message"
                className="p-1.5 rounded-lg text-cbox-muted hover:text-cbox-danger hover:bg-cbox-danger/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {showPicker && onReact && (
              <div
                className={`absolute bottom-full mb-1 z-20 flex items-center gap-1 p-1.5 rounded-full bg-cbox-surface border border-cbox-border shadow-soft ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(emoji);
                      setShowPicker(false);
                    }}
                    className="h-7 w-7 rounded-full hover:bg-cbox-elevated flex items-center justify-center text-sm transition hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reactions Pill Row */}
      {!isDeleted && message.reactions && message.reactions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 px-1">
          {message.reactions.map((r) => {
            const reactedByMe = r.userIds.includes(currentUserId);
            return (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact?.(r.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                  reactedByMe
                    ? 'bg-cbox-accent/15 border-cbox-accent/40 text-cbox-text'
                    : 'bg-cbox-surface border-cbox-border text-cbox-muted hover:text-cbox-text'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-[11px] font-semibold">{r.userIds.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timestamp, Edited badge, and Read Receipt Ticks */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-cbox-muted px-1">
        <span>{timeLabel}</span>
        {!isDeleted && message.editedAt && <span className="italic">(edited)</span>}
        {isOwn && !isDeleted && (
          <>
            {message.deliveryState === 'SENDING' && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Sending…
              </span>
            )}
            {message.deliveryState === 'SENT' && <Check className="h-3.5 w-3.5" />}
            {message.deliveryState === 'DELIVERED' && <CheckCheck className="h-3.5 w-3.5 text-cbox-muted" />}
            {message.deliveryState === 'READ' && (
              <CheckCheck aria-label="Seen" className="h-3.5 w-3.5 text-sky-400" />
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
