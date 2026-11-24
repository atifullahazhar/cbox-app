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
  const [saving, setSaving] = useState(false);

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

    Promise.all([
      apiFetch<{ sessions: SessionInfo[] }>('/api/auth/sessions'),
      apiFetch<{ blockedUsers: BlockedUserItem[] }>('/api/friends/blocks'),
    ])
      .then(([sRes, bRes]) => {
        setSessions(sRes.sessions);
        setBlockedUsers(bRes.blockedUsers);
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
      title="Settings"
      description="Manage your profile identity, appearance, security, and privacy."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-8">
        {/* Profile Identity Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted">
            Profile Identity
          </h3>

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
              <span className="text-[11px] text-cbox-muted block">
                Globally unique identifier (3–24 chars, case-insensitive).
              </span>
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
              <span className="text-[11px] text-cbox-muted block">
                Display name only — does not replace your @username.
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">
              Alternate Nicknames / Aliases (optional)
            </span>
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
                      aria-label={`Remove ${alias}`}
                      onClick={() =>
                        setAlternateNicknames((prev) => prev.filter((a) => a !== alias))
                      }
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
              placeholder="Tell friends a bit about yourself…"
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

        {/* Secret Mode Placeholder */}
        <section className="p-4 rounded-xl border border-cbox-border bg-cbox-elevated/60 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-cbox-violet/15 text-cbox-violet flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-cbox-text">Secret Mode</h4>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cbox-violet/15 text-cbox-violet">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-cbox-muted mt-0.5">
                Reserved for a future privacy mode. Currently disabled until specified.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-cbox-border text-cbox-muted opacity-50 cursor-not-allowed shrink-0"
          >
            Unavailable
          </button>
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

        {/* Account Security & Active Sessions */}
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

          <p className="text-xs text-cbox-muted bg-cbox-elevated/60 border border-cbox-border rounded-xl p-3">
            <strong>Password recovery note:</strong> Because Cbox accounts currently use username +
            password without a verified email or phone number, self-service password reset is not
            available yet. Optional recovery contact setup is planned as a future security upgrade.
          </p>

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

        {/* Logout */}
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
