import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';

export const USERNAME_REGEX = /^[a-z0-9_.]{3,24}$/;
export const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'system', 'support', 'cbox', 'chatterbox',
  'developer', 'api', 'login', 'signup', 'settings', 'profile', 'chat', 'posts', 'events',
]);

export const VALID_THEME_KEYS = new Set([
  'midnight-neon', 'crisp-daylight', 'cherry-blossom', 'aurora-borealis',
  'sunset-ember', 'ocean-bioluminescence', 'cyberpunk-synth',
  'emerald-forest', 'lavender-dream', 'amoled-obsidian',
]);

export function normalizeUsername(raw: string): { display: string; normalized: string } {
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error('Username must be 3–24 characters using letters, numbers, underscores, or periods.');
  }
  if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) {
    throw new Error('Username cannot start/end with a period or contain consecutive periods.');
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    throw new Error('That username is reserved.');
  }
  return { display: trimmed, normalized };
}

export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Password must be between 8 and 128 characters.');
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(rawToken: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(rawToken).digest('hex');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length <= 6) return '••••';
  return `${phone.slice(0, 3)}••••${phone.slice(-4)}`;
}

/**
 * Signs a short-lived (15 min) phone verification token after Step 1 OTP passes
 * so the user can proceed through the multi-step signup wizard safely.
 */
export function createPhoneVerificationToken(phoneNormalized: string): string {
  const exp = Date.now() + 15 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ phoneNormalized, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyPhoneVerificationToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
  if (!timingSafeEqualStr(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.phoneNormalized || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.phoneNormalized as string;
  } catch {
    return null;
  }
}

/**
 * Server-side Developer Control access code verification.
 * Supports alphanumeric codes (6-32 chars, e.g. ATIF1234) configured in DEVELOPER_ACCESS_CODE env var.
 * Never hardcoded in frontend source; compared in constant time; never logged.
 */
export function verifyDeveloperAccessCode(submittedCode: string): {
  valid: boolean;
  reason?: 'NOT_CONFIGURED' | 'INVALID_FORMAT' | 'MISMATCH';
} {
  const configured = env.developerAccessCode.trim();
  if (!configured || configured.startsWith('REPLACE_WITH')) {
    return { valid: false, reason: 'NOT_CONFIGURED' };
  }
  const candidate = submittedCode.trim();
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(candidate)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }
  return timingSafeEqualStr(candidate, configured)
    ? { valid: true }
    : { valid: false, reason: 'MISMATCH' };
}

export function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

export interface SafeUserDTO {
  id: string;
  username: string;
  usernameNormalized: string;
  primaryNickname: string;
  alternateNicknames: string[];
  dateOfBirth?: string | null;
  isPrivateProfile?: boolean;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  phoneMasked?: string | null;
  hasSecretPin?: boolean;
  totpEnabled?: boolean;
  hideOnlineStatus?: boolean;
  disableReadReceipts?: boolean;
  theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
  themeKey?: string;
  role?: 'USER' | 'DEVELOPER';
  isDemo?: boolean;
  createdAt?: string;
}

export function toPublicUserDTO(user: {
  id: string;
  usernameDisplay: string;
  usernameNormalized: string;
  primaryNickname: string;
  alternateNicknames: string[];
  isPrivateProfile?: boolean;
  bio: string;
  avatarMediaId: string | null;
  bannerMediaId: string | null;
  isDemo?: boolean;
}): SafeUserDTO {
  return {
    id: user.id,
    username: user.usernameDisplay,
    usernameNormalized: user.usernameNormalized,
    primaryNickname: user.primaryNickname,
    alternateNicknames: user.alternateNicknames,
    isPrivateProfile: Boolean(user.isPrivateProfile),
    bio: user.bio,
    avatarUrl: user.avatarMediaId ? `/api/media/${user.avatarMediaId}` : null,
    bannerUrl: user.bannerMediaId ? `/api/media/${user.bannerMediaId}` : null,
    isDemo: user.isDemo,
  };
}

export function toSelfUserDTO(user: {
  id: string;
  usernameDisplay: string;
  usernameNormalized: string;
  phoneNormalized?: string | null;
  secretPinHash?: string | null;
  totpEnabled?: boolean;
  hideOnlineStatus?: boolean;
  disableReadReceipts?: boolean;
  dateOfBirth?: Date | null;
  isPrivateProfile?: boolean;
  primaryNickname: string;
  alternateNicknames: string[];
  bio: string;
  avatarMediaId: string | null;
  bannerMediaId: string | null;
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  themeKey?: string;
  role: 'USER' | 'DEVELOPER';
  isDemo: boolean;
  createdAt: Date;
}): SafeUserDTO {
  return {
    ...toPublicUserDTO(user),
    phoneMasked: maskPhone(user.phoneNormalized),
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    hasSecretPin: Boolean(user.secretPinHash),
    totpEnabled: Boolean(user.totpEnabled),
    hideOnlineStatus: Boolean(user.hideOnlineStatus),
    disableReadReceipts: Boolean(user.disableReadReceipts),
    theme: user.theme,
    themeKey: user.themeKey || 'midnight-neon',
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
