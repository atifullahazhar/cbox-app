import React from 'react';
import { Check, X, Clock } from 'lucide-react';
import type { FriendRequestItem } from '../../types';
import { Avatar } from '../ui/Avatar';

interface RequestCardProps {
  request: FriendRequestItem;
  direction: 'sent' | 'received';
  busy?: boolean;
  onAccept?: () => void;
  onDeny?: () => void;
  onCancel?: () => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  direction,
  busy = false,
  onAccept,
  onDeny,
  onCancel,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-cbox-border bg-cbox-surface">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar src={request.user.avatarUrl} name={request.user.primaryNickname} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-cbox-text truncate">
            {request.user.primaryNickname}
          </p>
          <p className="text-xs text-cbox-muted truncate">@{request.user.username}</p>
        </div>
      </div>

      {direction === 'received' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover text-xs font-semibold disabled:opacity-50 transition"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDeny}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-cbox-border text-cbox-muted hover:text-cbox-danger hover:border-cbox-danger/40 text-xs font-medium disabled:opacity-50 transition"
          >
            <X className="h-3.5 w-3.5" />
            Deny
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cbox-elevated text-cbox-muted border border-cbox-border">
            <Clock className="h-3 w-3" />
            Pending
          </span>
          {onCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="px-3 py-1 rounded-xl text-xs font-medium text-cbox-muted hover:text-cbox-danger hover:bg-cbox-danger/10 transition disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};
