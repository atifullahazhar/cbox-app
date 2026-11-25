import React from 'react';
import { User, MessageCircle, Images, Compass, Terminal, Download } from 'lucide-react';
import type { NavSection, SafeUser } from '../../types';
import { CboxLogo } from '../ui/CboxLogo';
import { Avatar } from '../ui/Avatar';

interface SidebarProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  user: SafeUser;
  pendingRequestCount: number;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  active,
  onNavigate,
  user,
  pendingRequestCount,
  canInstallPwa,
  onInstallPwa,
}) => {
  const isDeveloper = user.role === 'DEVELOPER';

  const items: Array<{ id: NavSection; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageCircle className="h-5 w-5" />,
      badge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
    },
    { id: 'posts', label: 'Posts', icon: <Images className="h-5 w-5" /> },
    { id: 'communities', label: 'Communities', icon: <Compass className="h-5 w-5" /> },
  ];

  if (isDeveloper) {
    items.push({
      id: 'developer',
      label: 'Developer Control',
      icon: <Terminal className="h-5 w-5" />,
    });
  }

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 border-r border-cbox-border bg-cbox-surface z-30"
    >
      <div className="px-6 py-5 border-b border-cbox-border">
        <CboxLogo size={32} />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-cbox-accent/15 text-cbox-accent'
                  : 'text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cbox-accent text-slate-950">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-cbox-border space-y-3">
        {canInstallPwa && (
          <button
            type="button"
            onClick={onInstallPwa}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-cbox-accent/40 text-cbox-accent hover:bg-cbox-accent/10 transition"
          >
            <Download className="h-4 w-4" />
            Install Chatterbox
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-cbox-elevated transition text-left"
        >
          <Avatar src={user.avatarUrl} name={user.primaryNickname} size="sm" online />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cbox-text truncate">{user.primaryNickname}</p>
            <p className="text-xs text-cbox-muted truncate">@{user.username}</p>
          </div>
        </button>
      </div>
    </aside>
  );
};
