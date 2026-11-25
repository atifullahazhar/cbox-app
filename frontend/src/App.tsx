import React, { useCallback, useEffect, useState } from 'react';
import type { NavSection, ProfileStats, SafeUser } from './types';
import type { ThemeKey } from './lib/themes';
import { apiFetch } from './lib/api';
import { connectSocket, disconnectSocket, getSocket } from './lib/socket';
import { useOnlineStatus, usePwaInstall, useThemeSync } from './hooks/useAppEnvironment';
import { AppShell } from './components/layout/AppShell';
import { Toast, type ToastItem } from './components/ui/Toast';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { InstallAppModal } from './components/ui/InstallAppModal';
import { ThemeAmbientCanvas } from './components/ui/ThemeAmbientCanvas';
import { CallModal, type ActiveCallState } from './components/chat/CallModal';
import { AuthScreen } from './screens/AuthScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ChatScreen } from './screens/ChatScreen';
import { PostsScreen } from './screens/PostsScreen';
import { EventsScreen } from './screens/EventsScreen';
import { DeveloperSpaceScreen } from './screens/DeveloperSpaceScreen';

export const App: React.FC = () => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ postCount: 0, friendCount: 0 });
  const [booting, setBooting] = useState(true);
  const [activeNav, setActiveNav] = useState<NavSection>('profile');
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  const isOnline = useOnlineStatus();
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  const activeThemeKey: ThemeKey =
    (user?.themeKey as ThemeKey) ||
    (localStorage.getItem('chatterbox_theme_key') as ThemeKey) ||
    'midnight-neon';

  useThemeSync(activeThemeKey);

  useEffect(() => {
    document.title = chatBadgeCount > 0 ? `(${chatBadgeCount}) Chatterbox` : 'Chatterbox — Private Social Chat';
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

  // Global listener for incoming WebRTC 1:1 Voice / Video Calls
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const onIncomingOffer = (data: {
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
      kind: 'audio' | 'video';
      callerName: string;
      callerUsername: string;
    }) => {
      setActiveCall((prev) => {
        if (prev) return prev; // Busy in another call
        return {
          peerUserId: data.fromUserId,
          peerName: data.callerName,
          peerUsername: data.callerUsername,
          kind: data.kind,
          direction: 'incoming',
          incomingOffer: data.sdp,
        };
      });
    };

    socket.on('call:offer', onIncomingOffer);
    return () => {
      socket.off('call:offer', onIncomingOffer);
    };
  }, [user?.id]);

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
    } catch {}
    disconnectSocket();
    setUser(null);
    setChatBadgeCount(0);
    setActiveCall(null);
    setActiveNav('profile');
    notify('Signed out of Chatterbox.', 'info');
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
      <ThemeAmbientCanvas themeKey={activeThemeKey} />

      <Toast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      <InstallAppModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        canNativeInstall={canInstall}
        isInstalled={isInstalled}
        onNativeInstall={async () => {
          const ok = await triggerInstall();
          if (ok) notify('Chatterbox installed on your device!', 'success');
        }}
      />

      {user && (
        <CallModal
          call={activeCall}
          currentUserName={user.primaryNickname}
          currentUsername={user.username}
          onClose={() => setActiveCall(null)}
        />
      )}

      {!user ? (
        <AuthScreen
          onAuthenticated={handleAuthenticated}
          isInstalledPwa={isInstalled}
          onOpenInstallModal={() => setInstallModalOpen(true)}
        />
      ) : (
        <div className="relative z-10">
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
                onStartCall={(friend, kind) =>
                  setActiveCall({
                    peerUserId: friend.id,
                    peerName: friend.primaryNickname,
                    peerUsername: friend.username,
                    kind,
                    direction: 'outgoing',
                  })
                }
                onNotify={notify}
              />
            )}

            {activeNav === 'posts' && <PostsScreen onStatsChanged={refreshMe} onNotify={notify} />}

            {activeNav === 'events' && <EventsScreen currentUser={user} onNotify={notify} />}

            {activeNav === 'developer' && user.role === 'DEVELOPER' && <DeveloperSpaceScreen />}
          </AppShell>
        </div>
      )}
    </>
  );
};

export default App;
