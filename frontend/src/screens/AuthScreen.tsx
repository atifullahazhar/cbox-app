import React, { useState } from 'react';
import { Terminal, Lock, UserPlus, LogIn, ShieldAlert, Download } from 'lucide-react';
import type { SafeUser } from '../types';
import { apiFetch } from '../lib/api';
import { CboxLogo } from '../components/ui/CboxLogo';
import { Modal } from '../components/ui/Modal';

interface AuthScreenProps {
  onAuthenticated: (user: SafeUser) => void;
  isInstalledPwa: boolean;
  onOpenInstallModal: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isInstalledPwa,
  onOpenInstallModal,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [devModalOpen, setDevModalOpen] = useState(false);
  const [devUsername, setDevUsername] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const res = await apiFetch<{ user: SafeUser }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeveloperVerify(e: React.FormEvent) {
    e.preventDefault();
    setDevError(null);
    setDevBusy(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/developer-code', {
        method: 'POST',
        body: JSON.stringify({
          username: devUsername,
          password: devPassword,
          code: devCode,
        }),
      });
      setDevCode('');
      setDevModalOpen(false);
      onAuthenticated(res.user);
    } catch (err) {
      setDevError(err instanceof Error ? err.message : 'Developer verification failed.');
    } finally {
      setDevBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-cbox-bg flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <CboxLogo size={42} />
          </div>
          <p className="text-sm text-cbox-muted">
            Private one-to-one messaging, friends, and photo sharing across desktop and Android.
          </p>
        </div>

        <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-6 sm:p-7 shadow-soft space-y-5">
          <div className="flex rounded-xl bg-cbox-elevated p-1 border border-cbox-border">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-cbox-surface text-cbox-text shadow-sm'
                  : 'text-cbox-muted hover:text-cbox-text'
              }`}
            >
              <LogIn className="h-4 w-4" /> Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-cbox-surface text-cbox-text shadow-sm'
                  : 'text-cbox-muted hover:text-cbox-text'
              }`}
            >
              <UserPlus className="h-4 w-4" /> Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-cbox-muted">Username</span>
              <input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. maya_chen"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted/70"
              />
              {mode === 'signup' && (
                <span className="text-[11px] text-cbox-muted block">
                  3–24 characters, letters/numbers/underscores/periods. Globally unique.
                </span>
              )}
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-cbox-muted">Password</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : 1}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted/70"
              />
            </label>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 text-xs text-cbox-danger"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover font-semibold text-sm transition disabled:opacity-50"
            >
              {busy
                ? mode === 'login'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'login'
                  ? 'Log in'
                  : 'Create account'}
            </button>
          </form>

          <div className="pt-3 border-t border-cbox-border flex flex-wrap items-center justify-between gap-2 text-xs text-cbox-muted">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Password required on every login
            </span>
            <button
              type="button"
              onClick={() => {
                setDevUsername(username);
                setDevPassword('');
                setDevCode('');
                setDevError(null);
                setDevModalOpen(true);
              }}
              className="inline-flex items-center gap-1 text-cbox-violet hover:underline font-medium"
            >
              <Terminal className="h-3.5 w-3.5" />
              Developer code
            </button>
          </div>
        </div>

        {!isInstalledPwa && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="w-full py-2.5 px-4 rounded-xl border border-cbox-border bg-cbox-surface hover:bg-cbox-elevated text-xs font-semibold text-cbox-text flex items-center justify-center gap-2 transition"
          >
            <Download className="h-4 w-4 text-cbox-accent" />
            Install Cbox as an App on Mobile or Desktop
          </button>
        )}

        <p className="text-center text-xs text-cbox-muted leading-relaxed px-2">
          Username-only accounts do not have email/phone recovery yet. Save your password safely.
        </p>
      </div>

      <Modal
        open={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        title="Developer access verification"
        description="Sign in to your Cbox account and enter the server-configured developer code to unlock Developer Space."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleDeveloperVerify} className="space-y-4">
          <div className="p-3 rounded-xl bg-cbox-violet/10 border border-cbox-violet/25 text-xs text-cbox-text flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-cbox-violet shrink-0 mt-0.5" />
            <span>
              Verified exclusively on the server and rate-limited. Developer access never grants
              permission to read private chats or friends-only posts.
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Account Username</span>
            <input
              type="text"
              required
              autoCapitalize="none"
              value={devUsername}
              onChange={(e) => setDevUsername(e.target.value)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Account Password</span>
            <input
              type="password"
              required
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Developer Code</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              value={devCode}
              onChange={(e) => setDevCode(e.target.value)}
              placeholder="Enter numeric developer code"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text tracking-widest"
            />
          </label>

          {devError && (
            <p role="alert" className="text-xs text-cbox-danger">
              {devError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDevModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm border border-cbox-border text-cbox-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={devBusy}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-cbox-violet text-white hover:opacity-90 disabled:opacity-50"
            >
              {devBusy ? 'Verifying…' : 'Verify & Sign in'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
