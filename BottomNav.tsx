import React from 'react';
import { User, MessageCircle, Images, CalendarDays, Terminal } from 'lucide-react';
import type { NavSection, SafeUser } from '../../types';

interface BottomNavProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  user: SafeUser;
  pendingRequestCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  active,
  onNavigate,
  user,
  pendingRequestCount,
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
    { id: 'events', label: 'Events', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  if (isDeveloper) {
    items.push({
      id: 'developer',
      label: 'Dev Ctrl',
      icon: <Terminal className="h-5 w-5" />,
    });
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-cbox-surface/95 backdrop-blur-md border-t border-cbox-border pb-safe"
    >
      <div className="flex items-center justify-around px-1 pt-1.5">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-w-[54px] py-1.5 px-2 rounded-xl text-[11px] font-medium transition ${
                isActive ? 'text-cbox-accent' : 'text-cbox-muted hover:text-cbox-text'
              }`}
            >
              <span className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-cbox-accent text-slate-950">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
