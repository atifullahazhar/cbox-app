import React, { useState } from 'react';
import {
  Terminal,
  Lock,
  UserPlus,
  LogIn,
  ShieldAlert,
  Download,
  Phone,
  KeyRound,
  CheckCircle2,
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

  // Password login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Phone + OTP state (shared by OTP login & OTP signup)
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpBanner, setDemoOtpBanner] = useState<string | null>(null);
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Forgot Password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpPhone, setFpPhone] = useState('');
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpDemoOtp, setFpDemoOtp] = useState<string | null>(null);
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  // Developer Code modal state
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
      const res = await apiFetch<{
        ok: boolean;
        deliveredVia: string;
        demoCode?: string | null;
        message: string;
      }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, purpose }),
      });
      setOtpSent(true);
      setInfoMsg(res.message);
      if (res.demoCode) {
        setDemoOtpBanner(res.demoCode);
      }
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
          const res = await apiFetch<{ user: SafeUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
          });
          onAuthenticated(res.user);
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
      const res = await apiFetch<{ demoCode?: string | null; message: string }>(
        '/api/auth/otp/send',
        {
          method: 'POST',
          body: JSON.stringify({ phone: fpPhone, purpose: 'RESET_PASSWORD' }),
        }
      );
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
        body: JSON.stringify({
          identifier: devIdentifier,
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
            Phone-verified private messaging, 24h stories, and Secret Mode across desktop & Android.
          </p>
        </div>

        <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-6 sm:p-7 shadow-soft space-y-5">
          <div className="flex rounded-xl bg-cbox-elevated p-1 border border-cbox-border">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setInfoMsg(null);
                setOtpSent(false);
                setDemoOtpBanner(null);
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
                setInfoMsg(null);
                setOtpSent(false);
                setDemoOtpBanner(null);
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

          {mode === 'login' && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('password');
                  setError(null);
                }}
                className={`flex-1 py-1.5 rounded-lg border font-medium transition ${
                  loginMethod === 'password'
                    ? 'border-cbox-accent bg-cbox-accent/10 text-cbox-accent'
                    : 'border-cbox-border text-cbox-muted'
                }`}
              >
                Password Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('otp');
                  setError(null);
                  setOtpSent(false);
                }}
                className={`flex-1 py-1.5 rounded-lg border font-medium transition ${
                  loginMethod === 'otp'
                    ? 'border-cbox-accent bg-cbox-accent/10 text-cbox-accent'
                    : 'border-cbox-border text-cbox-muted'
                }`}
              >
                Phone OTP Login
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'login' && loginMethod === 'password' ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-cbox-muted">Phone Number or Username</span>
                  <input
                    type="text"
                    autoCapitalize="none"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="+919876543210 or username"
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                  />
                </label>

                <label className="block space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-cbox-muted">Password</span>
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
                      className="text-xs text-cbox-accent hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-cbox-muted flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-cbox-accent" />
                    Mobile Number (1 phone = 1 Chatterbox ID)
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="+91 9876543210"
                      className="flex-1 min-w-0 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                    />
                    <button
                      type="button"
                      disabled={busy || phone.trim().length < 8}
                      onClick={() => handleSendOtp(mode === 'signup' ? 'SIGNUP' : 'LOGIN')}
                      className="px-3.5 py-2.5 rounded-xl border border-cbox-accent text-cbox-accent hover:bg-cbox-accent/10 text-xs font-semibold shrink-0 disabled:opacity-40"
                    >
                      {otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  </div>
                </label>

                {demoOtpBanner && (
                  <div className="p-3 rounded-xl bg-cbox-violet/15 border border-cbox-violet/35 text-xs text-cbox-text">
                    <strong>Demo SMS Mode:</strong> Your 6-digit OTP is{' '}
                    <span className="font-mono text-sm font-bold text-cbox-accent tracking-widest">
                      {demoOtpBanner}
                    </span>
                    <span className="block text-[11px] text-cbox-muted mt-0.5">
                      Configure Twilio or MSG91 in Render env vars for live SMS delivery.
                    </span>
                  </div>
                )}

                {otpSent && (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-cbox-muted">6-Digit OTP</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        required
                        placeholder="Enter 6-digit code"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text tracking-widest font-mono"
                      />
                    </label>

                    {mode === 'signup' && (
                      <>
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-cbox-muted">Choose Unique Username</span>
                          <input
                            type="text"
                            autoCapitalize="none"
                            value={signupUsername}
                            onChange={(e) => setSignupUsername(e.target.value)}
                            required
                            placeholder="e.g. atif_azhar"
                            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-cbox-muted">Create Password</span>
                          <input
                            type="password"
                            autoComplete="new-password"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="At least 8 characters"
                            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {infoMsg && !error && (
              <p className="text-xs text-cbox-accent">{infoMsg}</p>
            )}

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 text-xs text-cbox-danger"
              >
                {error}
              </div>
            )}

            {(mode === 'login' && loginMethod === 'password') || otpSent ? (
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover font-semibold text-sm transition disabled:opacity-50"
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? loginMethod === 'otp'
                      ? 'Verify OTP & Log in'
                      : 'Log in'
                    : 'Verify OTP & Create Account'}
              </button>
            ) : null}
          </form>

          <div className="pt-3 border-t border-cbox-border flex flex-wrap items-center justify-between gap-2 text-xs text-cbox-muted">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Python Argon2id + OTP Security
            </span>
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
            Install Chatterbox App on Mobile or Desktop
          </button>
        )}
      </div>

      {/* Forgot Password Modal (Phone OTP Reset) */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset password via Phone OTP"
        description="Verify your registered mobile number with a 6-digit OTP to set a new password."
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
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-cbox-muted">Registered Mobile Number</span>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={fpPhone}
                  onChange={(e) => setFpPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-sm text-cbox-text"
                />
                <button
                  type="button"
                  disabled={fpBusy || fpPhone.trim().length < 8}
                  onClick={handleSendForgotOtp}
                  className="px-3 py-2 rounded-xl border border-cbox-accent text-cbox-accent text-xs font-semibold shrink-0 disabled:opacity-40"
                >
                  {fpOtpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </label>

            {fpDemoOtp && (
              <div className="p-3 rounded-xl bg-cbox-violet/15 border border-cbox-violet/35 text-xs text-cbox-text">
                <strong>Demo Reset OTP:</strong>{' '}
                <span className="font-mono font-bold text-cbox-accent tracking-widest">{fpDemoOtp}</span>
              </div>
            )}

            {fpOtpSent && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-cbox-muted">6-Digit OTP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-sm text-cbox-text tracking-widest font-mono"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-cbox-muted">New Password (8+ chars)</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={fpNewPassword}
                    onChange={(e) => setFpNewPassword(e.target.value)}
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-sm text-cbox-text"
                  />
                </label>
              </>
            )}

            {fpError && <p className="text-xs text-cbox-danger">{fpError}</p>}

            {fpOtpSent && (
              <button
                type="submit"
                disabled={fpBusy}
                className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                <KeyRound className="h-4 w-4" />
                {fpBusy ? 'Resetting…' : 'Reset Password'}
              </button>
            )}
          </form>
        )}
      </Modal>

      {/* Developer Code Modal */}
      <Modal
        open={devModalOpen}
        onClose={() => setDevModalOpen(false)}
        title="Developer access verification"
        description="Sign in to your Chatterbox account and enter the server-configured developer code."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleDeveloperVerify} className="space-y-4">
          <div className="p-3 rounded-xl bg-cbox-violet/10 border border-cbox-violet/25 text-xs text-cbox-text flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-cbox-violet shrink-0 mt-0.5" />
            <span>
              Verified on the server and rate-limited. Developer role never grants access to private
              chats or friends-only posts.
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Phone or Username</span>
            <input
              type="text"
              required
              autoCapitalize="none"
              value={devIdentifier}
              onChange={(e) => setDevIdentifier(e.target.value)}
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

          {devError && <p className="text-xs text-cbox-danger">{devError}</p>}

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
