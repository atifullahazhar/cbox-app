import React, { useState } from 'react';
import {
  Terminal,
  Lock,
  ShieldAlert,
  Download,
  Phone,
  KeyRound,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
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
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpBanner, setDemoOtpBanner] = useState<string | null>(null);
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Forgot Password modal
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpPhone, setFpPhone] = useState('');
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpDemoOtp, setFpDemoOtp] = useState<string | null>(null);
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  // Developer Code modal
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [devIdentifier, setDevIdentifier] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [devCode, setDevCode] = useState('');
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  async function handleSendOtp(purpose: 'SIGNUP' | 'LOGIN') {
    setError(null);
    setInfoMsg(null);
    setDemoOtpBanner(null);
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; demoCode?: string | null; message: string }>(
        '/api/auth/otp/send',
        { method: 'POST', body: JSON.stringify({ phone, purpose }) }
      );
      setOtpSent(true);
      setInfoMsg(res.message);
      if (res.demoCode) setDemoOtpBanner(res.demoCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        if (loginMethod === 'password') {
          const res = await apiFetch<{ user?: SafeUser; requires2fa?: boolean }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              identifier,
              password,
              ...(requires2fa ? { totpCode } : {}),
            }),
          });
          if (res.requires2fa) {
            setRequires2fa(true);
            setInfoMsg('Enter your 6-digit Authenticator App (2FA) code.');
            return;
          }
          if (res.user) onAuthenticated(res.user);
        } else {
          const res = await apiFetch<{ user: SafeUser }>('/api/auth/login/otp', {
            method: 'POST',
            body: JSON.stringify({ phone, otp: otpCode }),
          });
          onAuthenticated(res.user);
        }
      } else {
        const res = await apiFetch<{ user: SafeUser }>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            phone,
            otp: otpCode,
            username: signupUsername,
            password: signupPassword,
          }),
        });
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendForgotOtp() {
    setFpError(null);
    setFpSuccess(null);
    setFpDemoOtp(null);
    setFpBusy(true);
    try {
      const res = await apiFetch<{ demoCode?: string | null }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: fpPhone, purpose: 'RESET_PASSWORD' }),
      });
      setFpOtpSent(true);
      if (res.demoCode) setFpDemoOtp(res.demoCode);
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Failed to send reset OTP.');
    } finally {
      setFpBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFpError(null);
    setFpBusy(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({ phone: fpPhone, otp: fpOtp, newPassword: fpNewPassword }),
      });
      setFpSuccess(res.message);
      setFpOtp('');
      setFpNewPassword('');
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setFpBusy(false);
    }
  }

  async function handleDeveloperVerify(e: React.FormEvent) {
    e.preventDefault();
    setDevError(null);
    setDevBusy(true);
    try {
      const res = await apiFetch<{ user: SafeUser }>('/api/auth/developer-code', {
        method: 'POST',
        body: JSON.stringify({ identifier: devIdentifier, password: devPassword, code: devCode }),
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
    <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center animate-fade-slide">
        {/* Left: Instagram-style Live Phone Showcase (Desktop) */}
        <div className="hidden lg:flex flex-col items-center justify-center space-y-5">
          <div className="relative w-72 rounded-[2.6rem] border-[6px] border-cbox-border bg-cbox-surface/90 backdrop-blur-xl p-4 shadow-2xl">
            <div className="mx-auto w-20 h-1.5 rounded-full bg-cbox-border mb-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <CboxLogo size={24} />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-accent/15 text-cbox-accent">
                  Live
                </span>
              </div>
              {/* Story rings preview */}
              <div className="flex gap-2.5 py-1">
                {['🌸', '✨', '🔥', '💜'].map((e, i) => (
                  <div
                    key={i}
                    className="h-11 w-11 rounded-full p-0.5 bg-gradient-to-tr from-cbox-accent via-pink-500 to-cbox-violet flex items-center justify-center"
                  >
                    <div className="h-full w-full rounded-full bg-cbox-surface flex items-center justify-center text-sm">
                      {e}
                    </div>
                  </div>
                ))}
              </div>
              {/* Chat bubbles preview */}
              <div className="space-y-2 pt-1">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-cbox-elevated px-3 py-2 text-xs text-cbox-text">
                  Cherry Blossom theme looks unreal 🌸
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-cbox-accent to-cbox-violet px-3 py-2 text-xs text-white font-medium">
                  Voice call + live group polls too! ⚡
                </div>
              </div>
              <div className="rounded-xl bg-cbox-elevated/80 border border-cbox-border p-3 text-[11px] text-cbox-muted flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cbox-accent shrink-0" />
                <span>10 Animated Themes · Secret Vault · 1:1 Calls</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-cbox-muted text-center max-w-xs">
            One phone number, one verified Chatterbox ID — secured by Python Argon2id, OTP, and 2FA.
          </p>
        </div>

        {/* Right: Sleek Instagram-Style Auth Card */}
        <div className="w-full max-w-[390px] mx-auto space-y-3.5">
          <div className="rounded-2xl border border-cbox-border bg-cbox-surface/90 backdrop-blur-xl px-7 py-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <CboxLogo size={40} />
              </div>
              <p className="text-xs text-cbox-muted">
                {mode === 'login'
                  ? 'Sign in to chat, call, and share moments.'
                  : 'Create your phone-verified Chatterbox ID.'}
              </p>
            </div>

            {mode === 'login' && (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-cbox-elevated border border-cbox-border text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setRequires2fa(false);
                    setError(null);
                  }}
                  className={`py-2 rounded-lg font-semibold transition ${
                    loginMethod === 'password'
                      ? 'bg-cbox-surface text-cbox-text shadow-sm'
                      : 'text-cbox-muted'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setOtpSent(false);
                    setError(null);
                  }}
                  className={`py-2 rounded-lg font-semibold transition ${
                    loginMethod === 'otp'
                      ? 'bg-cbox-surface text-cbox-text shadow-sm'
                      : 'text-cbox-muted'
                  }`}
                >
                  Phone OTP
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'login' && loginMethod === 'password' ? (
                <>
                  <input
                    type="text"
                    autoCapitalize="none"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="Phone number or username"
                    className="w-full rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted/75 focus:border-cbox-accent transition"
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Password"
                    className="w-full rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted/75 focus:border-cbox-accent transition"
                  />
                  {requires2fa && (
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit Authenticator 2FA code"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-violet px-3.5 py-2.5 text-center font-mono tracking-widest text-sm text-cbox-text"
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="+91 9876543210"
                      className="flex-1 min-w-0 rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                    />
                    <button
                      type="button"
                      disabled={busy || phone.trim().length < 8}
                      onClick={() => handleSendOtp(mode === 'signup' ? 'SIGNUP' : 'LOGIN')}
                      className="px-3.5 py-2.5 rounded-xl bg-cbox-accent/15 border border-cbox-accent/40 text-cbox-accent text-xs font-bold shrink-0 disabled:opacity-40"
                    >
                      {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>

                  {demoOtpBanner && (
                    <div className="p-3 rounded-xl bg-cbox-violet/15 border border-cbox-violet/35 text-xs text-cbox-text">
                      <strong>Demo OTP:</strong>{' '}
                      <span className="font-mono text-sm font-bold text-cbox-accent tracking-widest">
                        {demoOtpBanner}
                      </span>
                      <span className="block text-[10px] text-cbox-muted mt-0.5">
                        Add Twilio/MSG91 keys on Render for live SMS.
                      </span>
                    </div>
                  )}

                  {otpSent && (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        required
                        placeholder="Enter 6-digit OTP"
                        className="w-full rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm font-mono tracking-widest text-cbox-text"
                      />
                      {mode === 'signup' && (
                        <>
                          <input
                            type="text"
                            autoCapitalize="none"
                            value={signupUsername}
                            onChange={(e) => setSignupUsername(e.target.value)}
                            required
                            placeholder="Unique username (e.g. atif_azhar)"
                            className="w-full rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                          />
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Create password (8+ chars)"
                            className="w-full rounded-xl bg-cbox-elevated/80 border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {infoMsg && !error && <p className="text-xs text-cbox-accent text-center">{infoMsg}</p>}
              {error && (
                <div className="p-2.5 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 text-xs text-cbox-danger text-center">
                  {error}
                </div>
              )}

              {((mode === 'login' && loginMethod === 'password') || otpSent) && (
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cbox-accent to-cbox-violet text-white font-bold text-sm shadow-md hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
                >
                  {busy
                    ? 'Please wait…'
                    : mode === 'login'
                      ? requires2fa
                        ? 'Verify 2FA & Log in'
                        : 'Log in'
                      : 'Sign up'}
                </button>
              )}
            </form>

            <div className="flex items-center gap-3 text-[11px] text-cbox-muted">
              <div className="h-px flex-1 bg-cbox-border" />
              <span>OR</span>
              <div className="h-px flex-1 bg-cbox-border" />
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setFpPhone('');
                  setFpOtpSent(false);
                  setFpError(null);
                  setFpSuccess(null);
                  setFpDemoOtp(null);
                  setForgotOpen(true);
                }}
                className="text-cbox-accent hover:underline font-medium"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => {
                  setDevIdentifier(identifier || phone);
                  setDevPassword('');
                  setDevCode('');
                  setDevError(null);
                  setDevModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-cbox-violet hover:underline font-medium"
              >
                <Terminal className="h-3.5 w-3.5" /> Developer code
              </button>
            </div>
          </div>

          {/* Instagram-style Secondary Switch Card */}
          <div className="rounded-2xl border border-cbox-border bg-cbox-surface/90 backdrop-blur-xl py-4 px-6 text-center text-sm text-cbox-text shadow-soft">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setOtpSent(false);
                    setError(null);
                    setDemoOtpBanner(null);
                  }}
                  className="font-bold text-cbox-accent hover:underline"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setOtpSent(false);
                    setError(null);
                    setDemoOtpBanner(null);
                  }}
                  className="font-bold text-cbox-accent hover:underline"
                >
                  Log in
                </button>
              </>
            )}
          </div>

          {!isInstalledPwa && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="w-full py-2.5 px-4 rounded-xl border border-cbox-border bg-cbox-surface/80 hover:bg-cbox-elevated text-xs font-semibold text-cbox-text flex items-center justify-center gap-2 transition"
            >
              <Download className="h-4 w-4 text-cbox-accent" />
              Get the Chatterbox App on Mobile & Desktop
            </button>
          )}

          <p className="text-[11px] text-center text-cbox-muted flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-cbox-accent" />
            Strict 1 Phone = 1 ID · Python Argon2id + 2FA
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset password via Phone OTP"
        maxWidthClass="max-w-md"
      >
        {fpSuccess ? (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="h-10 w-10 text-cbox-success mx-auto" />
            <p className="text-sm text-cbox-text">{fpSuccess}</p>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="px-5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm"
            >
              Back to Log in
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="tel"
                required
                value={fpPhone}
                onChange={(e) => setFpPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
              />
              <button
                type="button"
                disabled={fpBusy || fpPhone.trim().length < 8}
                onClick={handleSendForgotOtp}
                className="px-3 py-2 rounded-xl border border-cbox-accent text-cbox-accent text-xs font-semibold"
              >
                {fpOtpSent ? 'Resend' : 'Send OTP'}
              </button>
            </div>
            {fpDemoOtp && (
              <div className="p-3 rounded-xl bg-cbox-violet/15 border border-cbox-violet/35 text-xs text-cbox-text">
                <strong>Demo Reset OTP:</strong> <span className="font-mono font-bold text-cbox-accent">{fpDemoOtp}</span>
              </div>
            )}
            {fpOtpSent && (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={fpOtp}
                  onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm font-mono tracking-widest text-cbox-text"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={fpNewPassword}
                  onChange={(e) => setFpNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
                />
                <button
                  type="submit"
                  disabled={fpBusy}
                  className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="h-4 w-4" />
                  {fpBusy ? 'Resetting…' : 'Reset Password'}
                </button>
              </>
            )}
            {fpError && <p className="text-xs text-cbox-danger">{fpError}</p>}
          </form>
        )}
      </Modal>

      {/* Developer Code Modal */}
      <Modal
        open={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        title="Developer access verification"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleDeveloperVerify} className="space-y-3.5">
          <div className="p-3 rounded-xl bg-cbox-violet/10 border border-cbox-violet/25 text-xs text-cbox-text flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-cbox-violet shrink-0 mt-0.5" />
            <span>Server-verified & audited. Developer role never bypasses private chat privacy.</span>
          </div>
          <input
            type="text"
            required
            value={devIdentifier}
            onChange={(e) => setDevIdentifier(e.target.value)}
            placeholder="Phone or username"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text"
          />
          <input
            type="password"
            required
            value={devPassword}
            onChange={(e) => setDevPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text"
          />
          <input
            type="password"
            inputMode="numeric"
            required
            value={devCode}
            onChange={(e) => setDevCode(e.target.value)}
            placeholder="Developer code"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text tracking-widest"
          />
          {devError && <p className="text-xs text-cbox-danger">{devError}</p>}
          <button
            type="submit"
            disabled={devBusy}
            className="w-full py-2.5 rounded-xl bg-cbox-violet text-white font-semibold text-sm"
          >
            {devBusy ? 'Verifying…' : 'Verify & Sign in'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
