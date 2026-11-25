import React, { useEffect, useState } from 'react';
import {
  AtSign,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  XCircle,
} from 'lucide-react';
import type { SafeUser } from '../types';
import { apiFetch } from '../lib/api';
import {
  getDeviceFingerprint,
  isLocallyMarkedDeviceLocked,
  markDeviceLocallyLocked,
} from '../lib/device';
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
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---------------- 1-DEVICE = 1-ACCOUNT LOCK STATE ----------------
  const [deviceFp, setDeviceFp] = useState<string>('');
  const [deviceLocked, setDeviceLocked] = useState<boolean>(isLocallyMarkedDeviceLocked());

  // ---------------- LOG-IN STATE (Username + Password) ----------------
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showLoginDevCode, setShowLoginDevCode] = useState(false);
  const [loginDevCode, setLoginDevCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // ---------------- SINGLE-FORM SIGN-UP STATE (NO MOBILE, NO STEPS) ----------------
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);
  const [primaryNickname, setPrimaryNickname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [isPrivateProfile, setIsPrivateProfile] = useState(false);
  const [signupDevCode, setSignupDevCode] = useState('');

  // ---------------- FORGOT PASSWORD MODAL (Username + DOB) ----------------
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState('');
  const [fpDob, setFpDob] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  // Check server + hardware device lock on mount
  useEffect(() => {
    let active = true;
    getDeviceFingerprint()
      .then(async (fp) => {
        if (!active) return;
        setDeviceFp(fp);
        try {
          const res = await apiFetch<{ locked: boolean }>(
            `/api/auth/device-status?fp=${encodeURIComponent(fp)}`
          );
          if (active && res.locked) {
            setDeviceLocked(true);
            markDeviceLocallyLocked();
          }
        } catch {
          // Keep local lock state if offline
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Live username availability check
  useEffect(() => {
    if (mode !== 'signup') return;
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameMsg(null);
      return;
    }
    if (trimmed.length < 3) {
      setUsernameStatus('invalid');
      setUsernameMsg('Use at least 3 characters (letters, numbers, _ or .)');
      return;
    }
    setUsernameStatus('checking');
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean; error?: string }>(
          `/api/auth/check-username?username=${encodeURIComponent(trimmed)}`
        );
        if (res.available) {
          setUsernameStatus('available');
          setUsernameMsg('Username available!');
        } else {
          setUsernameStatus(res.error ? 'invalid' : 'taken');
          setUsernameMsg(res.error || 'That username is already taken.');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [username, mode]);

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setError(null);
    setInfo(null);
    setRequires2fa(false);
    setTotpCode('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        username: loginUsername.trim(),
        password: loginPassword,
      };
      if (requires2fa && totpCode.trim()) payload.totpCode = totpCode.trim();
      if (loginDevCode.trim()) payload.developerCode = loginDevCode.trim();

      const res = await apiFetch<{ user?: SafeUser; requires2fa?: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.requires2fa) {
        setRequires2fa(true);
        setInfo('Enter the 6-digit code from your authenticator app.');
        return;
      }
      if (res.user) onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError(usernameMsg || 'Please choose a valid, available username.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setBusy(true);
    try {
      const fp = deviceFp || (await getDeviceFingerprint());
      const payload: Record<string, unknown> = {
        username: username.trim(),
        primaryNickname: primaryNickname.trim(),
        dateOfBirth,
        password: signupPassword,
        confirmPassword,
        isPrivateProfile,
        deviceFingerprint: fp,
      };
      if (signupDevCode.trim()) payload.developerCode = signupDevCode.trim();

      const res = await apiFetch<{ user: SafeUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      markDeviceLocallyLocked();
      setDeviceLocked(true);
      onAuthenticated(res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create account.';
      setError(msg);
      if (msg.toLowerCase().includes('this device')) {
        markDeviceLocallyLocked();
        setDeviceLocked(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setFpError(null);
    setFpSuccess(null);
    setFpBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          username: fpUsername.trim(),
          dateOfBirth: fpDob,
          newPassword: fpNewPassword,
        }),
      });
      setFpSuccess(res.message || 'Password reset! You can now log in.');
      setFpNewPassword('');
    } catch (err) {
      setFpError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setFpBusy(false);
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 relative z-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left: Phone Preview & Feature Showcase */}
        <div className="hidden lg:flex flex-col items-center justify-center space-y-6 p-6">
          <div className="relative w-[310px] rounded-[42px] border-[6px] border-cbox-border bg-cbox-surface shadow-2xl p-4 overflow-hidden">
            <div className="w-24 h-5 rounded-full bg-cbox-bg mx-auto mb-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <CboxLogo size={26} />
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cbox-accent/15 text-cbox-accent">
                  Safe v5
                </span>
              </div>
              <div className="rounded-2xl p-3.5 bg-gradient-to-br from-cbox-accent/20 via-cbox-violet/15 to-transparent border border-cbox-border/70 space-y-2">
                <p className="text-xs font-bold text-cbox-text flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-cbox-accent" /> 10 Animated Themes
                </p>
                <p className="text-[11px] text-cbox-muted leading-relaxed">
                  Cherry Blossom petals, Neon Cyber, Aurora Glow & more — smooth real-time chats, public events, and built-in anti-NSFW safety shield.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-3 rounded-xl bg-cbox-elevated/80 border border-cbox-border">
                  <ShieldCheck className="h-4 w-4 text-cbox-success mb-1" />
                  <p className="font-semibold text-cbox-text">1 Device = 1 ID</p>
                  <p className="text-cbox-muted text-[10px]">Strict device lock</p>
                </div>
                <div className="p-3 rounded-xl bg-cbox-elevated/80 border border-cbox-border">
                  <Lock className="h-4 w-4 text-cbox-violet mb-1" />
                  <p className="font-semibold text-cbox-text">Safety Shield</p>
                  <p className="text-cbox-muted text-[10px]">Zero abuse / NSFW</p>
                </div>
              </div>
            </div>
          </div>
          {!isInstalledPwa && (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border border-cbox-border bg-cbox-surface/80 text-cbox-text hover:border-cbox-accent transition"
            >
              <Download className="h-4 w-4 text-cbox-accent" />
              Install Chatterbox App
            </button>
          )}
        </div>

        {/* Right: Auth Card (Log In or Direct Single-Form Sign Up) */}
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-3xl border border-cbox-border bg-cbox-surface/95 backdrop-blur-xl shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex flex-col items-center text-center space-y-1.5">
              <CboxLogo size={36} />
              <p className="text-xs text-cbox-muted">
                {mode === 'login'
                  ? 'Log in with your username and password'
                  : deviceLocked
                  ? '1 account per device limit reached'
                  : 'Create your Chatterbox account (1 Device = 1 ID)'}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-cbox-elevated border border-cbox-border">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'login' ? 'bg-cbox-accent text-slate-950 shadow' : 'text-cbox-muted hover:text-cbox-text'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`py-2 rounded-xl text-xs font-semibold transition ${
                  mode === 'signup' ? 'bg-cbox-accent text-slate-950 shadow' : 'text-cbox-muted hover:text-cbox-text'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="p-3 rounded-xl bg-cbox-danger/15 border border-cbox-danger/35 text-xs text-cbox-danger font-medium">
                {error}
              </div>
            )}
            {info && (
              <div className="p-3 rounded-xl bg-cbox-accent/15 border border-cbox-accent/35 text-xs text-cbox-text font-medium">
                {info}
              </div>
            )}

            {/* ===================== LOG-IN FORM (Username + Password) ===================== */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cbox-muted">Username</label>
                  <div className="relative">
                    <AtSign className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Enter your username"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-3.5 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-cbox-muted">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotOpen(true);
                        setFpError(null);
                        setFpSuccess(null);
                      }}
                      className="text-[11px] font-semibold text-cbox-accent hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showLoginPw ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-10 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-cbox-muted hover:text-cbox-text"
                      aria-label="Toggle password visibility"
                    >
                      {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {requires2fa && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cbox-accent">2FA Authenticator Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6-digit 2FA code"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-accent px-3.5 py-2.5 text-sm font-mono tracking-widest text-cbox-text"
                    />
                  </div>
                )}

                {/* Optional Developer Code inside Log-In */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowLoginDevCode((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cbox-muted hover:text-cbox-violet transition"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Have a Developer Code? (Optional)
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showLoginDevCode ? 'rotate-180' : ''}`} />
                  </button>
                  {showLoginDevCode && (
                    <div className="mt-2">
                      <input
                        type="password"
                        maxLength={32}
                        value={loginDevCode}
                        onChange={(e) => setLoginDevCode(e.target.value)}
                        placeholder="Enter 8-character Developer Code"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-violet/40 px-3.5 py-2 text-xs font-mono tracking-wider text-cbox-text focus:outline-none focus:border-cbox-violet"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm hover:opacity-95 transition disabled:opacity-50"
                >
                  {busy ? 'Signing in…' : 'Log In to Chatterbox'}
                </button>
              </form>
            ) : deviceLocked ? (
              /* ===================== 1-DEVICE LOCKED NOTICE ===================== */
              <div className="p-5 rounded-2xl border border-cbox-danger/35 bg-cbox-danger/10 text-center space-y-3">
                <div className="h-11 w-11 rounded-2xl bg-cbox-danger/20 text-cbox-danger flex items-center justify-center mx-auto">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="text-sm font-bold text-cbox-text">Account Already Exists on This Device</h2>
                <p className="text-xs text-cbox-muted leading-relaxed">
                  Only 1 Chatterbox account can be created per device. Please log in to your existing account.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs"
                >
                  Go to Log In
                </button>
              </div>
            ) : (
              /* ===================== DIRECT SINGLE-FORM SIGN-UP ===================== */
              <form onSubmit={handleSignup} className="space-y-3.5">
                {/* 1. Username */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cbox-muted">Username</label>
                  <div className="relative">
                    <AtSign className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={24}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="your_username"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-10 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-cbox-success" />}
                      {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                        <XCircle className="h-4 w-4 text-cbox-danger" />
                      )}
                    </span>
                  </div>
                  {usernameMsg && (
                    <p
                      className={`text-[11px] font-medium ${
                        usernameStatus === 'available' ? 'text-cbox-success' : 'text-cbox-danger'
                      }`}
                    >
                      {usernameMsg}
                    </p>
                  )}
                </div>

                {/* 2. Nickname */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cbox-muted">Nickname</label>
                  <div className="relative">
                    <User className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={48}
                      value={primaryNickname}
                      onChange={(e) => setPrimaryNickname(e.target.value)}
                      placeholder="Display name (e.g. Atif, Maya)"
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-3.5 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                    />
                  </div>
                </div>

                {/* 3. Date of Birth */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cbox-muted">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      required
                      max={todayIso}
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-3.5 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                    />
                  </div>
                </div>

                {/* 4. Password & Confirm Password */}
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-cbox-muted">Password</label>
                    <div className="relative">
                      <Lock className="h-3.5 w-3.5 text-cbox-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showSignupPw ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="8+ chars"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-8 pr-8 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cbox-muted"
                      >
                        {showSignupPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-cbox-muted">Confirm Password</label>
                    <div className="relative">
                      <KeyRound className="h-3.5 w-3.5 text-cbox-muted absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showSignupPw ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-8 pr-3 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                      />
                    </div>
                  </div>
                </div>
                {confirmPassword && signupPassword !== confirmPassword && (
                  <p className="text-[11px] text-cbox-danger font-medium">Passwords do not match.</p>
                )}

                {/* 5. Profile Visibility: Public or Private */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cbox-muted">Profile Visibility</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPrivateProfile(false)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                        !isPrivateProfile
                          ? 'border-cbox-accent bg-cbox-accent/15 ring-1 ring-cbox-accent'
                          : 'border-cbox-border bg-cbox-elevated/50'
                      }`}
                    >
                      <Globe className="h-4 w-4 text-cbox-accent shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-cbox-text">Public</p>
                        <p className="text-[10px] text-cbox-muted">Open profile</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrivateProfile(true)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                        isPrivateProfile
                          ? 'border-cbox-violet bg-cbox-violet/15 ring-1 ring-cbox-violet'
                          : 'border-cbox-border bg-cbox-elevated/50'
                      }`}
                    >
                      <Lock className="h-4 w-4 text-cbox-violet shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-cbox-text">Private</p>
                        <p className="text-[10px] text-cbox-muted">Friends only</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 6. Developer Code (Optional) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-cbox-muted flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-cbox-violet" /> Developer Code (Optional)
                  </label>
                  <input
                    type="password"
                    maxLength={32}
                    value={signupDevCode}
                    onChange={(e) => setSignupDevCode(e.target.value)}
                    placeholder="Leave blank for standard account"
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-xs font-mono tracking-wider text-cbox-text focus:outline-none focus:border-cbox-violet"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm hover:opacity-95 transition disabled:opacity-50"
                >
                  {busy ? 'Creating Account…' : 'Create Account'}
                </button>
              </form>
            )}

            {!isInstalledPwa && (
              <div className="lg:hidden pt-2 border-t border-cbox-border text-center">
                <button
                  type="button"
                  onClick={onOpenInstallModal}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cbox-accent"
                >
                  <Download className="h-3.5 w-3.5" /> Install Chatterbox App
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal (Username + DOB) */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        description="Verify your username and date of birth to set a new password."
      >
        <form onSubmit={handleResetPassword} className="space-y-3.5">
          {fpError && (
            <div className="p-2.5 rounded-xl bg-cbox-danger/15 border border-cbox-danger/35 text-xs text-cbox-danger">
              {fpError}
            </div>
          )}
          {fpSuccess && (
            <div className="p-2.5 rounded-xl bg-cbox-success/15 border border-cbox-success/35 text-xs text-cbox-success">
              {fpSuccess}
            </div>
          )}

          <input
            type="text"
            required
            value={fpUsername}
            onChange={(e) => setFpUsername(e.target.value.replace(/\s+/g, ''))}
            placeholder="Your username"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-cbox-muted">Date of Birth</label>
            <input
              type="date"
              required
              max={todayIso}
              value={fpDob}
              onChange={(e) => setFpDob(e.target.value)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
          </div>

          <input
            type="password"
            required
            minLength={8}
            value={fpNewPassword}
            onChange={(e) => setFpNewPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />

          <button
            type="submit"
            disabled={fpBusy}
            className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs disabled:opacity-50"
          >
            {fpBusy ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
