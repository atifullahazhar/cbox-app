import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';

export const USERNAME_REGEX = /^[a-z0-9_.]{3,24}$/;
export const RESERVED_USERNAMES = new Set([
  'admin',
  'root',
  'system',
  'support',
  'cbox',
  'chatterbox',
  'developer',
  'api',
  'login',
  'signup',
  'settings',
  'profile',
  'chat',
  'posts',
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
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
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

export function verifyDeveloperAccessCode(submittedCode: string): {
  valid: boolean;
  reason?: 'NOT_CONFIGURED' | 'INVALID_FORMAT' | 'MISMATCH';
} {
  const configured = env.developerAccessCode.trim();
  if (!configured || configured.startsWith('REPLACE_WITH')) {
    return { valid: false, reason: 'NOT_CONFIGURED' };
  }

  const is12Digit = /^\d{12}$/.test(configured);
  const is9DigitDemo = env.developerCodeAllowDemo9Digit && /^\d{9}$/.test(configured);
  if (!is12Digit && !is9DigitDemo) {
    return { valid: false, reason: 'NOT_CONFIGURED' };
  }

  const candidate = submittedCode.trim();
  if (!/^\d{9,12}$/.test(candidate)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  if (timingSafeEqualStr(candidate, configured)) {
    return { valid: true };
  }
  return { valid: false, reason: 'MISMATCH' };
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
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  phoneMasked?: string | null;
  hasSecretPin?: boolean;
  hideOnlineStatus?: boolean;
  disableReadReceipts?: boolean;
  theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
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
  hideOnlineStatus?: boolean;
  disableReadReceipts?: boolean;
  primaryNickname: string;
  alternateNicknames: string[];
  bio: string;
  avatarMediaId: string | null;
  bannerMediaId: string | null;
  theme: 'SYSTEM' | 'LIGHT' | 'DARK';
  role: 'USER' | 'DEVELOPER';
  isDemo: boolean;
  createdAt: Date;
}): SafeUserDTO {
  return {
    ...toPublicUserDTO(user),
    phoneMasked: maskPhone(user.phoneNormalized),
    hasSecretPin: Boolean(user.secretPinHash),
    hideOnlineStatus: Boolean(user.hideOnlineStatus),
    disableReadReceipts: Boolean(user.disableReadReceipts),
    theme: user.theme,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
