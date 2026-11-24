import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Ban, Flag } from 'lucide-react';
import type { FriendListItem } from '../../types';
import { Avatar } from '../ui/Avatar';

interface FriendRowProps {
  item: FriendListItem;
  selected?: boolean;
  onSelect: () => void;
  onBlock: () => void;
  onReportSoon: () => void;
}

export const FriendRow: React.FC<FriendRowProps> = ({
  item,
  selected = false,
  onSelect,
  onBlock,
  onReportSoon,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border transition ${
        selected
          ? 'bg-cbox-accent/10 border-cbox-accent/40'
          : 'bg-cbox-surface border-cbox-border hover:bg-cbox-elevated/60'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-3 text-left"
      >
        <Avatar
          src={item.friend.avatarUrl}
          name={item.friend.primaryNickname}
          size="md"
          online={item.online}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-cbox-text truncate">
              {item.friend.primaryNickname}
            </p>
            {item.lastMessage && (
              <span className="text-[11px] text-cbox-muted shrink-0">
                {new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="text-xs text-cbox-muted truncate">
            {item.lastMessage ? item.lastMessage.content : `@${item.friend.username}`}
          </p>
        </div>
      </button>

      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`More actions for ${item.friend.primaryNickname}`}
          aria-expanded={menuOpen}
          className="p-2 rounded-lg text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated transition"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-1 w-48 rounded-xl bg-cbox-surface border border-cbox-border shadow-soft py-1.5 z-20"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onBlock();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-cbox-danger hover:bg-cbox-danger/10 text-left"
            >
              <Ban className="h-4 w-4" />
              <span>Block user</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onReportSoon();
              }}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm text-cbox-muted hover:bg-cbox-elevated text-left"
            >
              <span className="flex items-center gap-2.5">
                <Flag className="h-4 w-4" />
                <span>Report user</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cbox-elevated border border-cbox-border">
                Soon
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
