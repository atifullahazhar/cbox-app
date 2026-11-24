import React, { useCallback, useEffect, useState } from 'react';
import type { NavSection, ProfileStats, SafeUser } from './types';
import { apiFetch } from './lib/api';
import { connectSocket, disconnectSocket } from './lib/socket';
import { useOnlineStatus, usePwaInstall, useThemeSync } from './hooks/useAppEnvironment';
import { AppShell } from './components/layout/AppShell';
import { Toast, type ToastItem } from './components/ui/Toast';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { InstallAppModal } from './components/ui/InstallAppModal';
import { AuthScreen } from './screens/AuthScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ChatScreen } from './screens/ChatScreen';
import { PostsScreen } from './screens/PostsScreen';
import { DeveloperSpaceScreen } from './screens/DeveloperSpaceScreen';

export const App: React.FC = () => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ postCount: 0, friendCount: 0 });
  const [booting, setBooting] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('profile');
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const isOnline = useOnlineStatus();
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  useThemeSync(user?.theme || 'SYSTEM');

  // Update browser tab title with live unread + request count
  useEffect(() => {
    document.title = chatBadgeCount > 0 ? `(${chatBadgeCount}) Cbox` : 'Cbox — Private Social Chat';
  }, [chatBadgeCount]);

  const notify = useCallback((message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: SafeUser; stats: ProfileStats }>('/api/auth/me');
      setUser(res.user);
      setStats(res.stats);
      connectSocket();
    } catch {
      setUser(null);
      disconnectSocket();
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
    return () => disconnectSocket();
  }, [refreshMe]);

  useEffect(() => {
    if (activeNav === 'developer' && user?.role !== 'DEVELOPER') {
      setActiveNav('profile');
    }
  }, [activeNav, user?.role]);

  async function handleAuthenticated(loggedInUser: SafeUser) {
    setUser(loggedInUser);
    setActiveNav('profile');
    connectSocket();
    await refreshMe();
  }

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless
    }
    disconnectSocket();
    setUser(null);
    setChatBadgeCount(0);
    setActiveNav('profile');
    notify('Signed out of Cbox.', 'info');
  }

  async function handleNativeInstall() {
    const accepted = await triggerInstall();
    if (accepted) {
      notify('Cbox installed on your device!', 'success');
    }
  }

  if (booting) {
    return (
      <div className="min-h-[100dvh] bg-cbox-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoadingSkeleton variant="profile" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <InstallAppModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        canNativeInstall={canInstall}
        isInstalled={isInstalled}
        onNativeInstall={handleNativeInstall}
      />

      {!user ? (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          isInstalledPwa={isInstalled}
          onOpenInstallModal={() => setInstallModalOpen(true)}
        />
      ) : (
        <AppShell
          active={activeNav}
          onNavigate={setActiveNav}
          user={user}
          pendingRequestCount={chatBadgeCount}
          isOnline={isOnline}
          isInstalledPwa={isInstalled}
          onOpenInstallModal={() => setInstallModalOpen(true)}
        >
          {activeNav === 'profile' && (
            <ProfileScreen
              user={user}
              stats={stats}
              onUserUpdated={setUser}
              onStatsChanged={refreshMe}
              onLogout={handleLogout}
              onNotify={notify}
            />
          )}

          {activeNav === 'chat' && (
            <ChatScreen
              currentUser={user}
              isOnline={isOnline}
              onBadgeCountChange={setChatBadgeCount}
              onNotify={notify}
            />
          )}

          {activeNav === 'posts' && (
            <PostsScreen onStatsChanged={refreshMe} onNotify={notify} />
          )}

          {activeNav === 'developer' && user.role === 'DEVELOPER' && <DeveloperSpaceScreen />}
        </AppShell>
      )}
    </>
  );
};

export default App;
