import React from 'react';
import { WifiOff, Download, Bug } from 'lucide-react';
import type { NavSection, SafeUser } from '../../types';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CboxLogo } from '../ui/CboxLogo';

interface AppShellProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
  user: SafeUser;
  pendingRequestCount: number;
  isOnline: boolean;
  isInstalledPwa: boolean;
  onOpenInstallModal: () => void;
  onOpenBugReport?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  active,
  onNavigate,
  user,
  pendingRequestCount,
  isOnline,
  isInstalledPwa,
  onOpenInstallModal,
  onOpenBugReport,
  children,
}) => {
  return (
    <div className="min-h-[100dvh] bg-cbox-bg text-cbox-text flex flex-col">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        user={user}
        pendingRequestCount={pendingRequestCount}
        canInstallPwa={!isInstalledPwa}
        onInstallPwa={onOpenInstallModal}
        onOpenBugReport={onOpenBugReport}
      />

      <div className="md:pl-64 flex-1 flex flex-col min-w-0">
        {/* Compact Sticky Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2.5 pt-safe bg-cbox-surface/95 backdrop-blur-md border-b border-cbox-border">
          <CboxLogo size={26} />
          <div className="flex items-center gap-2">
            {user.role !== 'DEVELOPER' && onOpenBugReport && (
              <button
                type="button"
                onClick={onOpenBugReport}
                title="Report a Bug"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-400/35 text-xs font-semibold active:scale-95 transition"
              >
                <Bug className="h-3.5 w-3.5" />
                <span>Bug</span>
              </button>
            )}
            {!isInstalledPwa && (
              <button
                type="button"
                onClick={onOpenInstallModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cbox-accent/15 text-cbox-accent border border-cbox-accent/30 text-xs font-semibold active:scale-95 transition"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </button>
            )}
          </div>
        </header>

        {!isOnline && (
          <div
            role="status"
            className="bg-cbox-warning/15 border-b border-cbox-warning/30 text-cbox-warning px-4 py-2 text-xs font-medium flex items-center justify-center gap-2"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You are currently offline. Messages and posts require a connection to sync.</span>
          </div>
        )}

        <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav
        active={active}
        onNavigate={onNavigate}
        user={user}
        pendingRequestCount={pendingRequestCount}
      />
    </div>
  );
};
