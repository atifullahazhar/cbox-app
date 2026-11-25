import React, { useEffect, useState } from 'react';
import {
  Bell,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MessageSquarePlus,
  Palette,
  Plus,
  Shield,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  User,
  UserX,
  X,
} from 'lucide-react';
import type { BlockedUserItem, SafeUser, SessionInfo } from '../../types';
import { CHATTERBOX_THEMES, type ThemeKey } from '../../lib/themes';
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

type SettingsTab = 'profile' | 'themes' | 'privacy' | 'security' | 'developer' | 'feedback';

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
  const [tab, setTab] = useState<SettingsTab>('profile');

  // Profile fields
  const [username, setUsername] = useState(user.username);
  const [primaryNickname, setPrimaryNickname] = useState(user.primaryNickname);
  const [alternateNicknames, setAlternateNicknames] = useState<string[]>(user.alternateNicknames);
  const [newAlias, setNewAlias] = useState('');
  const [bio, setBio] = useState(user.bio);
  const [themeKey, setThemeKey] = useState<ThemeKey>(user.themeKey || 'midnight-neon');
  const [saving, setSaving] = useState(false);

  // Privacy fields
  const [isPrivateProfile, setIsPrivateProfile] = useState(Boolean(user.isPrivateProfile));
  const [hideOnlineStatus, setHideOnlineStatus] = useState(Boolean(user.hideOnlineStatus));
  const [disableReadReceipts, setDisableReadReceipts] = useState(Boolean(user.disableReadReceipts));
  const [pushEnabled, setPushEnabled] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);

  // Security fields
  const [secretPin, setSecretPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Developer Control unlock
  const [devCodeInput, setDevCodeInput] = useState('');
  const [verifyingDevCode, setVerifyingDevCode] = useState(false);

  // Feedback to Developer Control
  const [fbCategory, setFbCategory] = useState('Feature Request');
  const [fbMessage, setFbMessage] = useState('');
  const [sendingFb, setSendingFb] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(user.username);
    setPrimaryNickname(user.primaryNickname);
    setAlternateNicknames(user.alternateNicknames);
    setBio(user.bio);
    setThemeKey(user.themeKey || 'midnight-neon');
    setIsPrivateProfile(Boolean(user.isPrivateProfile));
    setHideOnlineStatus(Boolean(user.hideOnlineStatus));
    setDisableReadReceipts(Boolean(user.disableReadReceipts));
    setTotpSecret(null);

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

  async function handleSelectTheme(key: ThemeKey) {
    setThemeKey(key);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ themeKey: key }),
      });
      onUserUpdated(res.profile);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to switch theme.', 'error');
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ username, primaryNickname, alternateNicknames, bio, themeKey }),
      });
      onUserUpdated(res.profile);
      onNotify('Profile saved.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrivacyToggle(
    field: 'isPrivateProfile' | 'hideOnlineStatus' | 'disableReadReceipts',
    val: boolean
  ) {
    if (field === 'isPrivateProfile') setIsPrivateProfile(val);
    else if (field === 'hideOnlineStatus') setHideOnlineStatus(val);
    else setDisableReadReceipts(val);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: val }),
      });
      onUserUpdated(res.profile);
    } catch {}
  }

  async function handleUnlockDeveloperControl(e: React.FormEvent) {
    e.preventDefault();
    if (!devCodeInput.trim()) return;
    setVerifyingDevCode(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/developer-code', {
        method: 'POST',
        body: JSON.stringify({ code: devCodeInput.trim() }),
      });
      onUserUpdated(res.user);
      setDevCodeInput('');
      onNotify('Developer Control unlocked in your dashboard!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Invalid developer code.', 'error');
    } finally {
      setVerifyingDevCode(false);
    }
  }

  async function handleSaveSecretPin(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(secretPin)) {
      onNotify('Secret PIN must be 4–6 digits.', 'error');
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
      onNotify('Secret Mode PIN updated!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save PIN.', 'error');
    } finally {
      setSavingPin(false);
    }
  }

  async function handleStart2fa() {
    setTotpBusy(true);
    try {
      const res = await apiFetch<{ secret: string }>('/api/auth/2fa/setup', { method: 'POST' });
      setTotpSecret(res.secret);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '2FA setup failed.', 'error');
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleEnable2fa(e: React.FormEvent) {
    e.preventDefault();
    setTotpBusy(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: totpCode }),
      });
      onUserUpdated(res.user);
      setTotpSecret(null);
      setTotpCode('');
      onNotify('Two-Factor Authentication (2FA) enabled!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Invalid 2FA code.', 'error');
    } finally {
      setTotpBusy(false);
    }
  }

  async function handleDisable2fa() {
    setTotpBusy(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/2fa/disable', { method: 'POST' });
      onUserUpdated(res.user);
      onNotify('2FA disabled.', 'info');
    } finally {
      setTotpBusy(false);
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
      onNotify('Password updated.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Password change failed.', 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (fbMessage.trim().length < 5) return;
    setSendingFb(true);
    try {
      await apiFetch('/api/developer/feedback', {
        method: 'POST',
        body: JSON.stringify({ category: fbCategory, message: fbMessage.trim() }),
      });
      setFbMessage('');
      onNotify('Feedback sent directly to Developer Control!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not send feedback.', 'error');
    } finally {
      setSendingFb(false);
    }
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'profile', label: 'Profile', icon: <User className="h-3.5 w-3.5" /> },
    { id: 'themes', label: 'Themes', icon: <Palette className="h-3.5 w-3.5" /> },
    { id: 'privacy', label: 'Privacy', icon: <EyeOff className="h-3.5 w-3.5" /> },
    { id: 'security', label: 'Security', icon: <Shield className="h-3.5 w-3.5" /> },
    { id: 'developer', label: 'Developer', icon: <Terminal className="h-3.5 w-3.5" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquarePlus className="h-3.5 w-3.5" /> },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chatterbox Settings"
      description="Manage your profile, animated themes, privacy, security, and Developer Control access."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Clean Structured Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-cbox-border">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-cbox-accent text-slate-950 shadow'
                    : 'bg-cbox-elevated/60 text-cbox-muted hover:text-cbox-text'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== TAB 1: PROFILE ===================== */}
        {tab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="p-3.5 rounded-2xl border border-cbox-border bg-cbox-elevated/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar src={user.avatarUrl} name={user.primaryNickname} size="md" />
                <div>
                  <p className="text-sm font-bold text-cbox-text">{user.primaryNickname}</p>
                  <p className="text-xs text-cbox-muted">@{user.username}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={onPickAvatar} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-cbox-border hover:border-cbox-accent">
                  Change Avatar
                </button>
                {user.avatarUrl && (
                  <button type="button" onClick={onResetAvatar} className="px-2.5 py-1.5 rounded-xl text-xs text-cbox-danger border border-cbox-danger/30">
                    Reset
                  </button>
                )}
                <button type="button" onClick={onPickBanner} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-cbox-border hover:border-cbox-accent">
                  Change Banner
                </button>
                {user.bannerUrl && (
                  <button type="button" onClick={onResetBanner} className="px-2.5 py-1.5 rounded-xl text-xs text-cbox-danger border border-cbox-danger/30">
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cbox-muted">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cbox-muted">Primary Nickname</label>
                <input
                  type="text"
                  value={primaryNickname}
                  onChange={(e) => setPrimaryNickname(e.target.value)}
                  required
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-cbox-muted">Alternate Nicknames</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Add alternate nickname…"
                  className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    const c = newAlias.trim();
                    if (c && !alternateNicknames.includes(c)) setAlternateNicknames((p) => [...p, c]);
                    setNewAlias('');
                  }}
                  className="px-3.5 py-2 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {alternateNicknames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {alternateNicknames.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-cbox-elevated border border-cbox-border">
                      {a}
                      <button type="button" onClick={() => setAlternateNicknames((p) => p.filter((x) => x !== a))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cbox-muted">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell friends about yourself…"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs">
                {saving ? 'Saving…' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ===================== TAB 2: THEMES ===================== */}
        {tab === 'themes' && (
          <div className="space-y-4">
            <p className="text-xs text-cbox-muted">
              Choose from 10 smooth animated themes including Cherry Blossom petals, Cyber Neon, Aurora Glow, and AMOLED True-Black.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {CHATTERBOX_THEMES.map((t) => {
                const active = themeKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleSelectTheme(t.key)}
                    className={`p-3 rounded-2xl border text-left transition hover:scale-[1.02] active:scale-[0.98] ${
                      active
                        ? 'border-cbox-accent bg-cbox-accent/15 ring-1 ring-cbox-accent'
                        : 'border-cbox-border bg-cbox-elevated/50 hover:bg-cbox-elevated'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base">{t.emoji}</span>
                      <div className="flex -space-x-1">
                        {t.swatch.map((hex, i) => (
                          <span key={i} style={{ backgroundColor: hex }} className="h-3.5 w-3.5 rounded-full border border-white/30" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-cbox-text truncate">{t.name}</p>
                    <p className="text-[10px] text-cbox-muted truncate">{t.tagline}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: PRIVACY ===================== */}
        {tab === 'privacy' && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
                <div>
                  <p className="font-semibold text-cbox-text">Private Profile</p>
                  <p className="text-[11px] text-cbox-muted">Only approved friends can view your posts</p>
                </div>
                <input type="checkbox" checked={isPrivateProfile} onChange={(e) => handlePrivacyToggle('isPrivateProfile', e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
                <div>
                  <p className="font-semibold text-cbox-text">Hide Online Status</p>
                  <p className="text-[11px] text-cbox-muted">Appear offline to other users</p>
                </div>
                <input type="checkbox" checked={hideOnlineStatus} onChange={(e) => handlePrivacyToggle('hideOnlineStatus', e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
                <div>
                  <p className="font-semibold text-cbox-text">Disable Read Receipts</p>
                  <p className="text-[11px] text-cbox-muted">Turn off blue ticks when reading messages</p>
                </div>
                <input type="checkbox" checked={disableReadReceipts} onChange={(e) => handlePrivacyToggle('disableReadReceipts', e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
              </label>

              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-xs">
                <span className="flex items-center gap-2 font-semibold text-cbox-text">
                  <Bell className="h-4 w-4 text-cbox-accent" /> Browser Push Notifications
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if ('Notification' in window && (await Notification.requestPermission()) === 'granted') {
                      setPushEnabled(true);
                      onNotify('Notifications enabled!', 'success');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-cbox-accent text-cbox-accent font-semibold"
                >
                  {pushEnabled ? 'Enabled' : 'Enable'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-cbox-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cbox-muted flex items-center gap-1.5">
                <UserX className="h-4 w-4" /> Blocked Users ({blockedUsers.length})
              </h3>
              {blockedUsers.length === 0 ? (
                <p className="text-xs text-cbox-muted">You haven't blocked anyone.</p>
              ) : (
                blockedUsers.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-xl border border-cbox-border text-xs">
                    <div className="flex items-center gap-2">
                      <Avatar src={b.user.avatarUrl} name={b.user.primaryNickname} size="sm" />
                      <span>{b.user.primaryNickname} (@{b.user.username})</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/friends/blocks/${b.user.id}`, { method: 'DELETE' });
                        setBlockedUsers((p) => p.filter((x) => x.user.id !== b.user.id));
                      }}
                      className="px-2.5 py-1 rounded-lg border border-cbox-border font-semibold"
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: SECURITY ===================== */}
        {tab === 'security' && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-cbox-violet/35 bg-cbox-violet/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cbox-text flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-cbox-violet" /> Secret Mode PIN
                  </span>
                  <span className="text-[10px] font-semibold text-cbox-success">{user.hasSecretPin ? 'Active' : 'Off'}</span>
                </div>
                <form onSubmit={handleSaveSecretPin} className="flex gap-1.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={secretPin}
                    onChange={(e) => setSecretPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="4–6 digit PIN"
                    className="flex-1 min-w-0 rounded-xl bg-cbox-surface border border-cbox-border px-3 py-1.5 text-xs tracking-widest text-cbox-text"
                  />
                  <button type="submit" disabled={savingPin || secretPin.length < 4} className="px-3 py-1.5 rounded-xl bg-cbox-violet text-white text-xs font-semibold disabled:opacity-40">
                    Save
                  </button>
                </form>
              </div>

              <div className="p-4 rounded-2xl border border-cbox-accent/35 bg-cbox-accent/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cbox-text flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-cbox-accent" /> 2FA Authenticator
                  </span>
                  <span className="text-[10px] font-semibold text-cbox-accent">{user.totpEnabled ? 'Enabled' : 'Off'}</span>
                </div>
                {user.totpEnabled ? (
                  <button type="button" disabled={totpBusy} onClick={handleDisable2fa} className="w-full py-1.5 rounded-xl border border-cbox-danger/40 text-cbox-danger text-xs font-semibold">
                    Disable 2FA
                  </button>
                ) : totpSecret ? (
                  <form onSubmit={handleEnable2fa} className="space-y-2">
                    <p className="text-[10px] text-cbox-muted break-all">
                      Key: <strong className="font-mono text-cbox-text">{totpSecret}</strong>
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6-digit code"
                        className="flex-1 min-w-0 rounded-xl bg-cbox-surface border border-cbox-border px-2.5 py-1.5 text-xs font-mono text-cbox-text"
                      />
                      <button type="submit" disabled={totpBusy} className="px-3 py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-semibold">
                        Verify
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" disabled={totpBusy} onClick={handleStart2fa} className="w-full py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-semibold">
                    Setup 2FA TOTP
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-cbox-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cbox-muted">Change Password</h3>
              <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-2">
                <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text" />
                <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+)" className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text" />
                <button type="submit" disabled={changingPassword} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold">
                  <KeyRound className="h-3.5 w-3.5" /> Update
                </button>
              </form>
            </div>

            <div className="space-y-2 pt-2 border-t border-cbox-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cbox-muted">
                Active Sessions ({sessions.length})
              </h3>
              {sessions.filter((s) => !s.isCurrent).length === 0 ? (
                <p className="text-xs text-cbox-muted">Only this device is currently signed in.</p>
              ) : (
                sessions.filter((s) => !s.isCurrent).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl border border-cbox-border text-xs">
                    <span className="truncate text-cbox-muted">{s.userAgent || 'Other device'}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/auth/sessions/${s.id}`, { method: 'DELETE' });
                        setSessions((p) => p.filter((x) => x.id !== s.id));
                      }}
                      className="text-cbox-danger p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: DEVELOPER ===================== */}
        {tab === 'developer' && (
          <div className="p-5 rounded-2xl border border-cbox-violet/40 bg-cbox-violet/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-cbox-text flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cbox-violet" /> Developer Control Access
              </span>
              {user.role === 'DEVELOPER' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-cbox-success/15 text-cbox-success">
                  <ShieldCheck className="h-3.5 w-3.5" /> Active
                </span>
              ) : (
                <span className="text-xs font-semibold text-cbox-muted">Locked</span>
              )}
            </div>
            {user.role === 'DEVELOPER' ? (
              <p className="text-xs text-cbox-muted leading-relaxed">
                Developer Control is unlocked on your account! Open the <strong>Developer Control</strong> tab from the main navigation to host official Events, broadcast announcements, tune Safety Filters, and manage platform flags.
              </p>
            ) : (
              <form onSubmit={handleUnlockDeveloperControl} className="space-y-3">
                <p className="text-xs text-cbox-muted">
                  Enter your 8-character server-verified Developer Code to unlock the Developer Control dashboard.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={32}
                    value={devCodeInput}
                    onChange={(e) => setDevCodeInput(e.target.value)}
                    placeholder="Enter 8-character Developer Code"
                    className="flex-1 rounded-xl bg-cbox-surface border border-cbox-border px-3.5 py-2 text-xs font-mono tracking-wider text-cbox-text"
                  />
                  <button
                    type="submit"
                    disabled={verifyingDevCode || !devCodeInput.trim()}
                    className="px-4 py-2 rounded-xl bg-cbox-violet text-white text-xs font-bold disabled:opacity-40"
                  >
                    {verifyingDevCode ? 'Verifying…' : 'Unlock'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ===================== TAB 6: FEEDBACK ===================== */}
        {tab === 'feedback' && (
          <form onSubmit={handleSendFeedback} className="space-y-3.5">
            <p className="text-xs text-cbox-muted">
              Spot a bug or want a new feature? Send a direct note to the Chatterbox Developer Control Inbox.
            </p>
            <select
              value={fbCategory}
              onChange={(e) => setFbCategory(e.target.value)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-xs font-semibold text-cbox-text"
            >
              <option value="Feature Request">Feature Request</option>
              <option value="Bug Report">Bug Report</option>
              <option value="Safety Concern">Safety Concern</option>
              <option value="General Feedback">General Feedback</option>
            </select>
            <textarea
              rows={3}
              required
              minLength={5}
              maxLength={600}
              value={fbMessage}
              onChange={(e) => setFbMessage(e.target.value)}
              placeholder="Write your feedback or bug details…"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            <button
              type="submit"
              disabled={sendingFb || fbMessage.trim().length < 5}
              className="px-5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs disabled:opacity-40"
            >
              {sendingFb ? 'Sending…' : 'Send to Developer Control'}
            </button>
          </form>
        )}

        {/* Footer: Always-Accessible Log Out */}
        <div className="pt-4 border-t border-cbox-border flex justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cbox-danger/15 text-cbox-danger font-semibold text-xs hover:bg-cbox-danger/25 transition"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    </Modal>
  );
};
