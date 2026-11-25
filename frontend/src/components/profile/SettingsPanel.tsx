import React, { useEffect, useState } from 'react';
import {
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
  Palette,
  Smartphone,
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
  const [themeKey, setThemeKey] = useState<ThemeKey>(user.themeKey || 'midnight-neon');
  const [hideOnlineStatus, setHideOnlineStatus] = useState(Boolean(user.hideOnlineStatus));
  const [disableReadReceipts, setDisableReadReceipts] = useState(Boolean(user.disableReadReceipts));
  const [saving, setSaving] = useState(false);

  const [secretPin, setSecretPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // 2FA TOTP state
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);

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
    setThemeKey(user.themeKey || 'midnight-neon');
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

  async function handlePrivacyToggle(field: 'hideOnlineStatus' | 'disableReadReceipts', val: boolean) {
    if (field === 'hideOnlineStatus') setHideOnlineStatus(val);
    else setDisableReadReceipts(val);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: val }),
      });
      onUserUpdated(res.profile);
    } catch {}
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chatterbox Settings"
      description="10 animated themes, Secret Mode, 2FA, privacy, and account controls."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-8">
        {/* 10 Animated Themes Gallery */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <Palette className="h-4 w-4 text-cbox-accent" /> 10 Animated Themes
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CHATTERBOX_THEMES.map((t) => {
              const active = themeKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleSelectTheme(t.key)}
                  className={`p-2.5 rounded-xl border text-left transition hover:scale-[1.02] active:scale-[0.98] ${
                    active
                      ? 'border-cbox-accent bg-cbox-accent/15 ring-1 ring-cbox-accent'
                      : 'border-cbox-border bg-cbox-elevated/50 hover:bg-cbox-elevated'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">{t.emoji}</span>
                    <div className="flex -space-x-1">
                      {t.swatch.map((hex, i) => (
                        <span
                          key={i}
                          style={{ backgroundColor: hex }}
                          className="h-3.5 w-3.5 rounded-full border border-white/30"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-cbox-text truncate">{t.name}</p>
                  <p className="text-[10px] text-cbox-muted truncate">{t.tagline}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Profile Identity */}
        <form onSubmit={handleSaveProfile} className="space-y-4 pt-4 border-t border-cbox-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted">Profile</h3>
            {user.phoneMasked && (
              <span className="inline-flex items-center gap-1 text-xs text-cbox-accent font-medium">
                <Phone className="h-3.5 w-3.5" /> {user.phoneMasked}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username"
              className="rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            <input
              type="text"
              value={primaryNickname}
              onChange={(e) => setPrimaryNickname(e.target.value)}
              required
              placeholder="Primary nickname"
              className="rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Add alternate nickname"
              className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            <button
              type="button"
              onClick={() => {
                const c = newAlias.trim();
                if (c && !alternateNicknames.includes(c)) setAlternateNicknames((p) => [...p, c]);
                setNewAlias('');
              }}
              className="px-3 py-2 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {alternateNicknames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
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
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio…"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={onPickAvatar} className="px-2.5 py-1.5 rounded-lg text-xs border border-cbox-border">Avatar</button>
              {user.avatarUrl && <button type="button" onClick={onResetAvatar} className="px-2.5 py-1.5 rounded-lg text-xs text-cbox-danger border border-cbox-danger/30">Reset Avatar</button>}
              <button type="button" onClick={onPickBanner} className="px-2.5 py-1.5 rounded-lg text-xs border border-cbox-border">Banner</button>
              {user.bannerUrl && <button type="button" onClick={onResetBanner} className="px-2.5 py-1.5 rounded-lg text-xs text-cbox-danger border border-cbox-danger/30">Reset Banner</button>}
            </div>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-xs">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        {/* Secret Mode PIN + 2FA TOTP */}
        <section className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-cbox-border">
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
                  Add key to Google Authenticator/Authy: <strong className="font-mono text-cbox-text">{totpSecret}</strong>
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
        </section>

        {/* Privacy & Notifications */}
        <section className="space-y-2.5 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <EyeOff className="h-4 w-4" /> Privacy & Alerts
          </h3>
          <label className="flex items-center justify-between p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
            <span>Hide Online Status</span>
            <input type="checkbox" checked={hideOnlineStatus} onChange={(e) => handlePrivacyToggle('hideOnlineStatus', e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
            <span>Disable Read Receipts (Blue Ticks)</span>
            <input type="checkbox" checked={disableReadReceipts} onChange={(e) => handlePrivacyToggle('disableReadReceipts', e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 text-xs">
            <span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5 text-cbox-accent" /> Push Notifications</span>
            <button
              type="button"
              onClick={async () => {
                if ('Notification' in window && (await Notification.requestPermission()) === 'granted') {
                  setPushEnabled(true);
                  onNotify('Notifications enabled!', 'success');
                }
              }}
              className="px-3 py-1 rounded-lg border border-cbox-accent text-cbox-accent font-semibold"
            >
              {pushEnabled ? 'Enabled' : 'Enable'}
            </button>
          </div>
        </section>

        {/* Blocked Users & Security */}
        <section className="space-y-3 pt-4 border-t border-cbox-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2">
            <UserX className="h-4 w-4" /> Blocked Users ({blockedUsers.length})
          </h3>
          {blockedUsers.map((b) => (
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
          ))}

          <h3 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted flex items-center gap-2 pt-2">
            <Shield className="h-4 w-4" /> Password & Sessions ({sessions.length})
          </h3>
          <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-2">
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text" />
            <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text" />
            <button type="submit" disabled={changingPassword} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-cbox-border text-xs font-semibold">
              <KeyRound className="h-3.5 w-3.5" /> Update
            </button>
          </form>
          {sessions.filter((s) => !s.isCurrent).map((s) => (
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
          ))}
        </section>

        <div className="pt-4 border-t border-cbox-border flex justify-end">
          <button type="button" onClick={onLogout} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cbox-danger/15 text-cbox-danger font-semibold text-sm">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    </Modal>
  );
};
