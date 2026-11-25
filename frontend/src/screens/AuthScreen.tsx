import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  AtSign,
  XCircle,
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

const COUNTRY_CODES = [
  { code: '+91', label: 'IN +91' },
  { code: '+1', label: 'US/CA +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+971', label: 'UAE +971' },
  { code: '+92', label: 'PK +92' },
  { code: '+880', label: 'BD +880' },
  { code: '+61', label: 'AU +61' },
  { code: '+49', label: 'DE +49' },
  { code: '+33', label: 'FR +33' },
  { code: '+81', label: 'JP +81' },
  { code: '+65', label: 'SG +65' },
  { code: '+966', label: 'SA +966' },
];

const SIGNUP_STEPS = [
  'Mobile OTP',
  'Nickname',
  'Username',
  'Birthday',
  'Password',
  'Visibility',
];

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  isInstalledPwa,
  onOpenInstallModal,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---------------- LOG-IN STATE ----------------
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showLoginDevCode, setShowLoginDevCode] = useState(false);
  const [loginDevCode, setLoginDevCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // ---------------- 6-STEP SIGN-UP WIZARD STATE ----------------
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  // Step 1: Country Code + Mobile + OTP Verification
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileDigits, setMobileDigits] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  // Step 2: Nickname
  const [primaryNickname, setPrimaryNickname] = useState('');

  // Step 3: Username + live availability
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);

  // Step 4: Date of Birth
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Step 5: Password & Confirm Password
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);

  // Step 6: Public/Private Profile + Optional Developer Code
  const [isPrivateProfile, setIsPrivateProfile] = useState(false);
  const [signupDevCode, setSignupDevCode] = useState('');

  // ---------------- FORGOT PASSWORD MODAL ----------------
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpCountry, setFpCountry] = useState('+91');
  const [fpPhone, setFpPhone] = useState('');
  const [fpOtpSent, setFpOtpSent] = useState(false);
  const [fpOtp, setFpOtp] = useState('');
  const [fpDemoOtp, setFpDemoOtp] = useState<string | null>(null);
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpBusy, setFpBusy] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState<string | null>(null);

  // Live username availability check on Step 3
  useEffect(() => {
    if (mode !== 'signup' || step !== 3) return;
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
          setUsernameMsg('Username is available!');
        } else {
          setUsernameStatus(res.error ? 'invalid' : 'taken');
          setUsernameMsg(res.error || 'That username is already taken.');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [username, mode, step]);

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setError(null);
    setInfo(null);
    setRequires2fa(false);
    setTotpCode('');
  }

  // ---------------- HANDLERS: LOG-IN ----------------
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const payload: Record<string, string> = {
        identifier: identifier.trim(),
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

  // ---------------- HANDLERS: SIGN-UP WIZARD ----------------
  async function handleSendSignupOtp() {
    setError(null);
    setInfo(null);
    const digits = mobileDigits.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      setError('Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      const fullPhone = `${countryCode}${digits}`;
      const res = await apiFetch<{ ok: boolean; demoCode?: string; message?: string }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: fullPhone, purpose: 'SIGNUP' }),
      });
      setOtpSent(true);
      setDemoOtp(res.demoCode || null);
      setInfo(res.message || 'OTP sent to your mobile number.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySignupOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (otpInput.trim().length !== 6) {
      setError('Enter the 6-digit OTP sent to your phone.');
      return;
    }
    setBusy(true);
    try {
      const fullPhone = `${countryCode}${mobileDigits.replace(/\D/g, '')}`;
      const res = await apiFetch<{ ok: boolean; phoneNormalized: string; verificationToken: string }>(
        '/api/auth/otp/verify-signup',
        {
          method: 'POST',
          body: JSON.stringify({ phone: fullPhone, otp: otpInput.trim() }),
        }
      );
      setVerificationToken(res.verificationToken);
      setVerifiedPhone(res.phoneNormalized);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP.');
    } finally {
      setBusy(false);
    }
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === 2) {
      if (!primaryNickname.trim()) {
        setError('Please enter your nickname.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (usernameStatus !== 'available') {
        setError(usernameMsg || 'Choose an available username to continue.');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (!dateOfBirth) {
        setError('Please select your Date of Birth.');
        return;
      }
      setStep(5);
    } else if (step === 5) {
      if (signupPassword.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (signupPassword !== confirmPassword) {
        setError('Password and Confirm Password do not match.');
        return;
      }
      setStep(6);
    }
  }

  async function handleCompleteSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!verificationToken) {
      setError('Mobile verification expired. Please verify your phone again.');
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        verificationToken,
        primaryNickname: primaryNickname.trim(),
        username: username.trim(),
        dateOfBirth,
        password: signupPassword,
        confirmPassword,
        isPrivateProfile,
      };
      if (signupDevCode.trim()) payload.developerCode = signupDevCode.trim();

      const res = await apiFetch<{ user: SafeUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setBusy(false);
    }
  }

  // ---------------- HANDLERS: FORGOT PASSWORD ----------------
  async function handleSendForgotOtp() {
    setFpError(null);
    setFpSuccess(null);
    const digits = fpPhone.replace(/\D/g, '');
    if (digits.length < 7) {
      setFpError('Enter a valid mobile number.');
      return;
    }
    setFpBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; demoCode?: string }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone: `${fpCountry}${digits}`, purpose: 'RESET_PASSWORD' }),
      });
      setFpOtpSent(true);
      setFpDemoOtp(res.demoCode || null);
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
      const res = await apiFetch<{ ok: boolean; message: string }>('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          phone: `${fpCountry}${fpPhone.replace(/\D/g, '')}`,
          otp: fpOtp.trim(),
          newPassword: fpNewPassword,
        }),
      });
      setFpSuccess(res.message || 'Password reset! You can now log in.');
      setFpOtp('');
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
        {/* Left: Instagram-style Phone Preview & Feature Showcase */}
        <div className="hidden lg:flex flex-col items-center justify-center space-y-6 p-6">
          <div className="relative w-[310px] rounded-[42px] border-[6px] border-cbox-border bg-cbox-surface shadow-2xl p-4 overflow-hidden">
            <div className="w-24 h-5 rounded-full bg-cbox-bg mx-auto mb-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <CboxLogo size={26} />
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cbox-accent/15 text-cbox-accent">
                  Live v4
                </span>
              </div>
              <div className="rounded-2xl p-3.5 bg-gradient-to-br from-cbox-accent/20 via-cbox-violet/15 to-transparent border border-cbox-border/70 space-y-2">
                <p className="text-xs font-bold text-cbox-text flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-cbox-accent" /> 10 Animated Themes
                </p>
                <p className="text-[11px] text-cbox-muted leading-relaxed">
                  Cherry Blossom petals, Neon Cyber, Aurora Glow & more — ultra-smooth real-time chats, events, and voice/video calls.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-3 rounded-xl bg-cbox-elevated/80 border border-cbox-border">
                  <ShieldCheck className="h-4 w-4 text-cbox-success mb-1" />
                  <p className="font-semibold text-cbox-text">1 Phone = 1 ID</p>
                  <p className="text-cbox-muted text-[10px]">Python OTP + Argon2id</p>
                </div>
                <div className="p-3 rounded-xl bg-cbox-elevated/80 border border-cbox-border">
                  <Calendar className="h-4 w-4 text-cbox-violet mb-1" />
                  <p className="font-semibold text-cbox-text">Public Events</p>
                  <p className="text-cbox-muted text-[10px]">Meetups, Gaming & more</p>
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

        {/* Right: Auth Card (Log In or 6-Step Sign Up) */}
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-3xl border border-cbox-border bg-cbox-surface/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <CboxLogo size={38} />
              <p className="text-xs text-cbox-muted">
                {mode === 'login'
                  ? 'Log in with your phone number or username'
                  : `Create your Chatterbox ID · Step ${step} of 6`}
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

            {/* ===================== LOG-IN FORM ===================== */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cbox-muted">Phone Number or Username</label>
                  <div className="relative">
                    <User className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="+919876543210 or username"
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
            ) : (
              /* ===================== 6-STEP SIGN-UP WIZARD ===================== */
              <div className="space-y-5">
                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-cbox-muted">
                    <span>{SIGNUP_STEPS[step - 1]}</span>
                    <span>{step} / 6</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className={`h-1.5 rounded-full transition-all ${
                          n <= step ? 'bg-cbox-accent' : 'bg-cbox-elevated'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* STEP 1: Country Code + Mobile Number + OTP Verification */}
                {step === 1 && (
                  <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">Mobile Number (1 Phone = 1 Account)</label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          disabled={otpSent}
                          className="rounded-xl bg-cbox-elevated border border-cbox-border px-2.5 py-2.5 text-xs font-semibold text-cbox-text focus:outline-none focus:border-cbox-accent"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <div className="relative flex-1">
                          <Phone className="h-4 w-4 text-cbox-muted absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            inputMode="numeric"
                            required
                            disabled={otpSent}
                            value={mobileDigits}
                            onChange={(e) => setMobileDigits(e.target.value.replace(/[^\d\s-]/g, ''))}
                            placeholder="9876543210"
                            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-9 pr-3 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>

                    {!otpSent ? (
                      <button
                        type="button"
                        disabled={busy || mobileDigits.replace(/\D/g, '').length < 7}
                        onClick={handleSendSignupOtp}
                        className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm hover:opacity-95 transition disabled:opacity-50"
                      >
                        {busy ? 'Sending OTP…' : 'Send Verification OTP'}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {demoOtp && (
                          <div className="p-2.5 rounded-xl bg-cbox-violet/15 border border-cbox-violet/40 text-xs text-cbox-text flex items-center justify-between">
                            <span>Demo OTP Code:</span>
                            <strong className="font-mono text-sm tracking-widest text-cbox-accent">{demoOtp}</strong>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-cbox-muted">Enter 6-Digit OTP</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full rounded-xl bg-cbox-elevated border border-cbox-accent px-4 py-2.5 text-center text-lg font-mono tracking-[0.4em] text-cbox-text focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={busy || otpInput.length !== 6}
                          className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {busy ? 'Verifying…' : 'Verify Mobile & Continue'}
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <div className="flex items-center justify-between text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setOtpSent(false);
                              setOtpInput('');
                              setDemoOtp(null);
                            }}
                            className="text-cbox-muted hover:text-cbox-text"
                          >
                            Change number
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleSendSignupOtp}
                            className="text-cbox-accent font-semibold hover:underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {/* STEP 2: Nickname */}
                {step === 2 && (
                  <form onSubmit={handleNextStep} className="space-y-4">
                    {verifiedPhone && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cbox-success/15 text-cbox-success text-[11px] font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verified {verifiedPhone}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">What should friends call you? (Nickname)</label>
                      <input
                        type="text"
                        required
                        maxLength={48}
                        autoFocus
                        value={primaryNickname}
                        onChange={(e) => setPrimaryNickname(e.target.value)}
                        placeholder="e.g. Atif, Maya, Alex"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                )}

                {/* STEP 3: Unique Username */}
                {step === 3 && (
                  <form onSubmit={handleNextStep} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">Choose a unique Username</label>
                      <div className="relative">
                        <AtSign className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          minLength={3}
                          maxLength={24}
                          autoFocus
                          value={username}
                          onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                          placeholder="your_username"
                          className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-10 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-2.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={usernameStatus !== 'available'}
                        className="flex-1 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        Continue <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 4: Date of Birth */}
                {step === 4 && (
                  <form onSubmit={handleNextStep} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="date"
                          required
                          max={todayIso}
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-3.5 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-4 py-2.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={!dateOfBirth}
                        className="flex-1 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        Continue <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 5: Password + Confirm Password */}
                {step === 5 && (
                  <form onSubmit={handleNextStep} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">Create Password (8+ characters)</label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showSignupPw ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="Enter strong password"
                          className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-10 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-cbox-muted"
                        >
                          {showSignupPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-cbox-muted">Confirm Password</label>
                      <div className="relative">
                        <KeyRound className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showSignupPw ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-10 pr-3.5 py-2.5 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
                        />
                      </div>
                      {confirmPassword && signupPassword !== confirmPassword && (
                        <p className="text-[11px] text-cbox-danger font-medium">Passwords do not match.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="px-4 py-2.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={signupPassword.length < 8 || signupPassword !== confirmPassword}
                        className="flex-1 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        Continue <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 6: Public/Private Profile + Optional Developer Code */}
                {step === 6 && (
                  <form onSubmit={handleCompleteSignup} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-cbox-muted">Profile Visibility</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsPrivateProfile(false)}
                          className={`p-3 rounded-2xl border text-left transition ${
                            !isPrivateProfile
                              ? 'border-cbox-accent bg-cbox-accent/15 ring-1 ring-cbox-accent'
                              : 'border-cbox-border bg-cbox-elevated/50'
                          }`}
                        >
                          <Globe className="h-5 w-5 text-cbox-accent mb-1.5" />
                          <p className="text-xs font-bold text-cbox-text">Public</p>
                          <p className="text-[10px] text-cbox-muted">Anyone can view public posts</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPrivateProfile(true)}
                          className={`p-3 rounded-2xl border text-left transition ${
                            isPrivateProfile
                              ? 'border-cbox-violet bg-cbox-violet/15 ring-1 ring-cbox-violet'
                              : 'border-cbox-border bg-cbox-elevated/50'
                          }`}
                        >
                          <Lock className="h-5 w-5 text-cbox-violet mb-1.5" />
                          <p className="text-xs font-bold text-cbox-text">Private</p>
                          <p className="text-[10px] text-cbox-muted">Only approved friends see posts</p>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-cbox-muted flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-cbox-violet" /> Developer Code (Optional)
                      </label>
                      <input
                        type="password"
                        maxLength={32}
                        value={signupDevCode}
                        onChange={(e) => setSignupDevCode(e.target.value)}
                        placeholder="Leave blank for standard account"
                        className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-xs font-mono tracking-wider text-cbox-text focus:outline-none focus:border-cbox-violet"
                      />
                      <p className="text-[10px] text-cbox-muted">
                        Valid 8-character developer code unlocks the Developer Control dashboard.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="px-4 py-2.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text flex items-center gap-1"
                      >
                        <ArrowLeft className="h-4 w-4" /> Back
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {busy ? 'Creating Account…' : 'Create Account'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
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

      {/* Forgot Password Modal */}
      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password via Mobile OTP"
        description="Verify your registered mobile number to set a new password."
      >
        <div className="space-y-4">
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

          <div className="flex gap-2">
            <select
              value={fpCountry}
              onChange={(e) => setFpCountry(e.target.value)}
              className="rounded-xl bg-cbox-elevated border border-cbox-border px-2.5 py-2 text-xs text-cbox-text"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={fpPhone}
              onChange={(e) => setFpPhone(e.target.value.replace(/[^\d\s-]/g, ''))}
              placeholder="Registered mobile number"
              className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
            />
            <button
              type="button"
              disabled={fpBusy}
              onClick={handleSendForgotOtp}
              className="px-3 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-xs"
            >
              {fpOtpSent ? 'Resend' : 'Send OTP'}
            </button>
          </div>

          {fpDemoOtp && (
            <div className="p-2.5 rounded-xl bg-cbox-violet/15 border border-cbox-violet/40 text-xs flex items-center justify-between">
              <span>Demo Reset OTP:</span>
              <strong className="font-mono tracking-widest text-cbox-accent">{fpDemoOtp}</strong>
            </div>
          )}

          {fpOtpSent && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={fpOtp}
                onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm font-mono tracking-widest text-cbox-text"
              />
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
                className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs"
              >
                {fpBusy ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
