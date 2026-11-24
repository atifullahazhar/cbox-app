import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  Shield,
  Lock,
  Trash2,
  Plus,
  X,
  UserX,
  KeyRound,
  EyeOff,
  Bell,
  Phone,
} from 'lucide-react';
import type { BlockedUserItem, SafeUser, SessionInfo, ThemePreference } from '../../types';
import { apiFetch } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  user: SafeUser;
  onUserUpdated: (user: SafeUser) => void;
  onPickAvatar: () => void;
  onPickBanner: () => void;
  onResetAvatar: () => Promise<void>;
  onResetBanner: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  open,
  onClose,
  user,
  onUserUpdated,
  onPickAvatar,
  onPickBanner,
  onResetAvatar,
  onResetBanner,
  onLogout,
  onNotify,
}) => {
  const [username, setUsername] = useState(user.username);
  const [primaryNickname, setPrimaryNickname] = useState(user.primaryNickname);
  const [alternateNicknames, setAlternateNicknames] = useState<string[]>(user.alternateNicknames);
  const [newAlias, setNewAlias] = useState('');
  const [bio, setBio] = useState(user.bio);
  const [theme, setTheme] = useState<ThemePreference>(user.theme || 'SYSTEM');
  const [hideOnlineStatus, setHideOnlineStatus] = useState(Boolean(user.hideOnlineStatus));
  const [disableReadReceipts, setDisableReadReceipts] = useState(Boolean(user.disableReadReceipts));
  const [saving, setSaving] = useState(false);

  // Secret Mode PIN
  const [secretPin, setSecretPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // Push notifications status
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(user.username);
    setPrimaryNickname(user.primaryNickname);
    setAlternateNicknames(user.alternateNicknames);
    setBio(user.bio);
    setTheme(user.theme || 'SYSTEM');
    setHideOnlineStatus(Boolean(user.hideOnlineStatus));
    setDisableReadReceipts(Boolean(user.disableReadReceipts));

    Promise.all([
      apiFetch<{ sessions: SessionInfo[] }>('/api/auth/sessions'),
      apiFetch<{ blockedUsers: BlockedUserItem[] }>('/api/friends/blocks'),
      apiFetch<{ configured: boolean }>('/api/push/config').catch(() => ({ configured: false })),
    ])
      .then(([sRes, bRes, pRes]) => {
        setSessions(sRes.sessions);
        setBlockedUsers(bRes.blockedUsers);
        setPushConfigured(pRes.configured);
      })
      .catch(() => {});
  }, [open, user]);

  function handleAddAlias() {
    const clean = newAlias.trim();
    if (!clean) return;
    if (alternateNicknames.length >= 6) {
      onNotify('You can add up to 6 alternate nicknames.', 'info');
      return;
    }
    if (!alternateNicknames.includes(clean)) {
      setAlternateNicknames((prev) => [...prev, clean]);
    }
    setNewAlias('');
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          username,
          primaryNickname,
          alternateNicknames,
          bio,
          theme,
          hideOnlineStatus,
          disableReadReceipts,
        }),
      });
      onUserUpdated(res.profile);
      onNotify('Profile settings saved.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrivacyToggle(field: 'hideOnlineStatus' | 'disableReadReceipts', val: boolean) {
    if (field === 'hideOnlineStatus') setHideOnlineStatus(val);
    else setDisableReadReceipts(val);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: val }),
      });
      onUserUpdated(res.profile);
      onNotify('Privacy setting updated.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update privacy.', 'error');
    }
  }

  async function handleSaveSecretPin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(secretPin)) {
      onNotify('Secret PIN must be 4 to 6 digits.', 'error');
      return;
    }
    setSavingPin(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/secret-pin/set', {
        method: 'POST',
        body: JSON.stringify({ pin: secretPin }),
      });
      onUserUpdated(res.user);
      setSecretPin('');
      onNotify('Secret Mode PIN saved! You can now hide chats in your Secret Vault.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save Secret PIN.', 'error');
    } finally {
      setSavingPin(false);
    }
  }

  async function handleEnablePush() {
    if (!('Notification' in window)) {
      onNotify('Push notifications are not supported in this browser.', 'info');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      onNotify('Notification permission denied.', 'error');
      return;
    }
    setPushEnabled(true);
    onNotify(
      pushConfigured
        ? 'Push notifications enabled for this device.'
        : 'Browser notifications allowed. Add VAPID keys on Render for background push.',
      'success'
    );
  }

  async function handleThemeSelect(next: ThemePreference) {
    setTheme(next);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ theme: next }),
      });
      onUserUpdated(res.profile);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update theme.', 'error');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      onNotify('Password updated and other sessions revoked.', 'success');
      const sRes = await apiFetch<{ sessions: SessionInfo[] }>('/api/auth/sessions');
      setSessions(sRes.sessions);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Password change failed.', 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await apiFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      onNotify('Session revoked.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to revoke session.', 'error');
    }
  }

  async function handleRevokeOthers() {
    try {
      const res = await apiFetch<{ revokedCount: number }>('/api/auth/sessions/revoke-others', {
        method: 'POST',
      });
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      onNotify(`Signed out ${res.revokedCount} other session(s).`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to revoke sessions.', 'error');
    }
  }

  async function handleUnblock(userId: string) {
    try {
      await apiFetch(`/api/friends/blocks/${userId}`, { method: 'DELETE' });
      setBlockedUsers((prev) => prev.filter((b) => b.user.id !== userId));
      onNotify('User unblocked.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to unblock user.', 'error');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chatterbox Settings"
      description="Manage your profile identity, Secret Mode, privacy, and security."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-8">
        {/* Profile Identity Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted">
              Profile Identity
            </h3>
            {user.phoneMasked && (
              <span className="inline-flex items-center gap-1.5 text-xs text-cbox-accent font-medium">
                <Phone className="h-3.5 w-3.5" /> Verified {user.phoneMasked}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-cbox-muted">Unique Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-cbox-muted">Primary Display Nickname</span>
              <input
                type="text"
                value={primaryNickname}
                onChange={(e) => setPrimaryNickname(e.target.value)}
                required
                maxLength={48}
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Alternate Nicknames</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="Add an alternate nickname"
                maxLength={32}
                className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
              <button
                type="button"
                onClick={handleAddAlias}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-cbox-border text-sm font-medium text-cbox-text hover:bg-cbox-elevated"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {alternateNicknames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {alternateNicknames.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-cbox-elevated border border-cbox-border text-cbox-text"
                  >
                    {alias}
                    <button
                      type="button"
                      onClick={() => setAlternateNicknames((prev) => prev.filter((a) => a !== alias))}
                      className="text-cbox-muted hover:text-cbox-danger"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Short Bio</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPickAvatar}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-cbox-border hover:bg-cbox-elevated"
              >
                Change avatar
              </button>
              {user.avatarUrl && (
                <button
                  type="button"
                  onClick={onResetAvatar}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-cbox-danger border border-cbox-danger/30 hover:bg-cbox-danger/10"
                >
                  Reset avatar
                </button>
              )}
              <button
                type="button"
                onClick={onPickBanner}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-cbox-border hover:bg-cbox-elevated"
              >
                Change banner
              </button>
              {user.bannerUrl && (
                <button
                  type="button"
                  onClick={onResetBanner}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-cbox-danger border border-cbox-danger/30 hover:bg-cbox-danger/10"
                >
                  Reset banner
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        {/* Secret Mode (LIVE!) */}
        <section className="p-4 rounded-2xl border border-cbox-violet/35 bg-cbox-violet/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-cbox-violet/15 text-cbox-violet flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-cbox-text">Secret Mode Vault</h3>
                <p className="text-xs text-cbox-muted">
                  {user.hasSecretPin
                    ? 'PIN active — hide chats from General and set disappearing timers.'
                    : 'Set a 4–6 digit PIN to lock private chats in your Secret Vault.'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cbox-success/15 text-cbox-success">
              {user.hasSecretPin ? 'Active' : 'Setup'}
            </span>
          </div>

          <form onSubmit={handleSaveSecretPin} className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={secretPin}
              onChange={(e) => setSecretPin(e.target.value.replace(/\D/g, ''))}
              placeholder={user.hasSecretPin ? 'Enter new 4–6 digit PIN' : 'Create 4–6 digit PIN'}
              className="flex-1 rounded-xl bg-cbox-surface border border-cbox-border px-3.5 py-2 text-sm text-cbox-text tracking-widest"
            />
            <button
              type="submit"
              disabled={savingPin || secretPin.length < 4}
              className="px-4 py-2 rounded-xl bg-cbox-violet text-white text-xs font-semibold disabled:opacity-40"
            >
              {savingPin ? 'Saving…' : user.hasSecretPin ? 'Update PIN' : 'Enable Secret Mode'}
            </button>
          </form>
        </section>

        {/* Privacy & Notifications */}
        <section className="space-y-3 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <EyeOff className="h-4 w-4" /> Privacy & Notifications
          </h3>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-cbox-text">Hide Online Status</p>
              <p className="text-xs text-cbox-muted">Friends will see you as Offline even when active.</p>
            </div>
            <input
              type="checkbox"
              checked={hideOnlineStatus}
              onChange={(e) => handlePrivacyToggle('hideOnlineStatus', e.target.checked)}
              className="h-5 w-5 accent-cbox-accent"
            />
          </label>

          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-cbox-text">Disable Read Receipts</p>
              <p className="text-xs text-cbox-muted">Stop sending blue seen ticks when you read messages.</p>
            </div>
            <input
              type="checkbox"
              checked={disableReadReceipts}
              onChange={(e) => handlePrivacyToggle('disableReadReceipts', e.target.checked)}
              className="h-5 w-5 accent-cbox-accent"
            />
          </label>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-cbox-accent shrink-0" />
              <div>
                <p className="text-sm font-medium text-cbox-text">Push Notifications</p>
                <p className="text-xs text-cbox-muted">Get notified about new messages & friend requests.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              className="px-3 py-1.5 rounded-xl border border-cbox-accent text-cbox-accent text-xs font-semibold hover:bg-cbox-accent/10"
            >
              {pushEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </section>

        {/* Appearance / Theme */}
        <section className="space-y-3 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted">
            Appearance
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'SYSTEM', label: 'System', icon: Monitor },
                { id: 'LIGHT', label: 'Light', icon: Sun },
                { id: 'DARK', label: 'Dark', icon: Moon },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeSelect(id)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                  theme === id
                    ? 'border-cbox-accent bg-cbox-accent/15 text-cbox-accent'
                    : 'border-cbox-border bg-cbox-elevated text-cbox-muted hover:text-cbox-text'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Blocked Users */}
        <section className="space-y-3 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <UserX className="h-4 w-4" /> Blocked Users ({blockedUsers.length})
          </h3>
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-cbox-muted">You have not blocked any accounts.</p>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-elevated/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={b.user.avatarUrl} name={b.user.primaryNickname} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-cbox-text truncate">
                        {b.user.primaryNickname}
                      </p>
                      <p className="text-xs text-cbox-muted">@{b.user.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(b.user.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-cbox-border text-cbox-text hover:bg-cbox-surface"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Account Security & Sessions */}
        <section className="space-y-4 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <Shield className="h-4 w-4" /> Account Security
          </h3>

          <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-2.5">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              required
              className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (8+ chars)"
              required
              minLength={8}
              className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
            />
            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-cbox-border bg-cbox-surface hover:bg-cbox-elevated text-sm font-medium text-cbox-text disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {changingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cbox-text">
                Active Sessions ({sessions.length})
              </span>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={handleRevokeOthers}
                  className="text-xs font-medium text-cbox-danger hover:underline"
                >
                  Revoke all other sessions
                </button>
              )}
            </div>
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-cbox-text truncate">
                    {s.isCurrent ? 'Current device' : s.userAgent || 'Active browser session'}
                  </p>
                  <p className="text-cbox-muted">
                    Last active {new Date(s.lastActiveAt).toLocaleString()}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    className="p-1.5 rounded-lg text-cbox-danger hover:bg-cbox-danger/10"
                    aria-label="Revoke session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="pt-4 border-t border-cbox-border flex justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cbox-danger/15 text-cbox-danger hover:bg-cbox-danger/25 text-sm font-semibold transition"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </Modal>
  );
};
