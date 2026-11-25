import React, { useEffect, useRef, useState } from 'react';
import { Send, ImagePlus, Mic, Square, X } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface MessageComposerProps {
  disabled?: boolean;
  offline?: boolean;
  replyTo?: ChatMessage | null;
  replyAuthorName?: string;
  onCancelReply?: () => void;
  onTypingChange?: (isTyping: boolean) => void;
  onSend: (text: string) => void;
  onSendMedia?: (file: File, caption: string) => Promise<void>;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  disabled = false,
  offline = false,
  replyTo,
  replyAuthorName,
  onCancelReply,
  onTypingChange,
  onSend,
  onSendMedia,
}) => {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  function notifyTyping(active: boolean) {
    if (!onTypingChange) return;
    onTypingChange(active);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    if (active) {
      typingTimeoutRef.current = window.setTimeout(() => onTypingChange(false), 2500);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || uploadingMedia) return;
    onSend(trimmed);
    setText('');
    notifyTyping(false);
  }

  async function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSendMedia) return;
    e.target.value = '';
    setUploadingMedia(true);
    try {
      await onSendMedia(file, text.trim());
      setText('');
    } finally {
      setUploadingMedia(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !onSendMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const ext = (recorder.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-note.${ext}`, { type: blob.type });
        setUploadingMedia(true);
        try {
          await onSendMedia(file, '');
        } finally {
          setUploadingMedia(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setRecording(false);
    }
  }

  function stopRecording(cancel = false) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (cancel) chunksRef.current = [];
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <div className="border-t border-cbox-border bg-cbox-surface shrink-0">
      {/* Reply-to preview strip */}
      {replyTo && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-cbox-elevated/80 border-b border-cbox-border text-xs">
          <div className="min-w-0 border-l-2 border-cbox-accent pl-2.5">
            <span className="font-semibold text-cbox-accent block">
              Replying to {replyAuthorName || 'message'}
            </span>
            <span className="text-cbox-muted line-clamp-1">
              {replyTo.mediaKind === 'IMAGE'
                ? replyTo.content || '📷 Photo'
                : replyTo.mediaKind === 'AUDIO'
                  ? '🎤 Voice note'
                  : replyTo.content}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="p-1 rounded-lg text-cbox-muted hover:text-cbox-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={handlePhotoPicked}
        className="hidden"
      />

      {recording ? (
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2 text-sm text-cbox-danger font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-cbox-danger animate-pulse" />
            <span>
              Recording voice note… {Math.floor(recordSeconds / 60)}:
              {String(recordSeconds % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-cbox-border text-cbox-muted hover:text-cbox-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-semibold"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> Send Voice
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3">
          {onSendMedia && (
            <button
              type="button"
              disabled={disabled || offline || uploadingMedia}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Send photo in chat"
              className="h-10 w-10 shrink-0 rounded-xl border border-cbox-border bg-cbox-elevated text-cbox-muted hover:text-cbox-accent flex items-center justify-center disabled:opacity-40 transition"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
          )}

          <textarea
            rows={1}
            value={text}
            maxLength={2000}
            disabled={disabled || uploadingMedia}
            onChange={(e) => {
              setText(e.target.value);
              notifyTyping(e.target.value.trim().length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              uploadingMedia
                ? 'Uploading media…'
                : offline
                  ? 'Offline — reconnect to send…'
                  : 'Write a message…'
            }
            aria-label="Message input"
            className="flex-1 resize-none max-h-32 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted focus:border-cbox-accent"
          />

          {text.trim() ? (
            <button
              type="submit"
              disabled={disabled || uploadingMedia}
              aria-label="Send message"
              className="h-10 w-10 shrink-0 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover disabled:opacity-40 flex items-center justify-center transition"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : onSendMedia ? (
            <button
              type="button"
              disabled={disabled || offline || uploadingMedia}
              onClick={startRecording}
              aria-label="Record voice note"
              className="h-10 w-10 shrink-0 rounded-xl bg-cbox-violet/15 text-cbox-violet border border-cbox-violet/30 hover:bg-cbox-violet/25 disabled:opacity-40 flex items-center justify-center transition"
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
};
