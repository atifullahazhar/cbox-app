import crypto from 'node:crypto';
import { env } from '../config/env.js';

// ---------------- NATIVE NODE.JS FALLBACKS (works even if Render runs Node runtime without Python sidecar) ----------------

function nodeNormalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-()]/g, '');
  if (!cleaned) throw new Error('Mobile number is required.');
  let normalized = cleaned;
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
  if (!normalized.startsWith('+')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 10) normalized = `+91${digits}`;
    else if (digits.length >= 11 && digits.length <= 15) normalized = `+${digits}`;
    else throw new Error('Enter a valid mobile number with country code (e.g. +919876543210).');
  }
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Enter a valid mobile number (e.g. +919876543210).');
  }
  return normalized;
}

function nodeHashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function nodeVerifyPassword(storedHash: string, password: string): boolean {
  if (!storedHash.startsWith('scrypt$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function nodeTotpCode(secret: string, stepOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return String(code).padStart(6, '0');
}

function nodeTotpSetup(username: string): { secret: string; otpauthUri: string } {
  const secret = base32Encode(crypto.randomBytes(20));
  const otpauthUri = `otpauth://totp/Chatterbox:${encodeURIComponent(username)}?secret=${secret}&issuer=Chatterbox`;
  return { secret, otpauthUri };
}

function nodeTotpVerify(secret: string, code: string): boolean {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = nodeTotpCode(secret, offset);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) return true;
  }
  return false;
}

// ---------------- PYTHON SIDECAR CALLER WITH GRACEFUL FALLBACK ----------------

async function callPython<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${env.pythonAuthUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.internalAuthKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      throw new Error(data?.detail || data?.error || `Python auth service error (${res.status})`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function pyNormalizePhone(phone: string): Promise<string> {
  try {
    const res = await callPython<{ phoneNormalized: string }>('/internal/phone/normalize', { phone });
    return res.phoneNormalized;
  } catch {
    return nodeNormalizePhone(phone);
  }
}

export async function pyHashPassword(password: string): Promise<string> {
  try {
    const res = await callPython<{ passwordHash: string }>('/internal/password/hash', { password });
    return res.passwordHash;
  } catch {
    return nodeHashPassword(password);
  }
}

export async function pyVerifyPassword(passwordHash: string, password: string): Promise<boolean> {
  if (passwordHash.startsWith('scrypt$')) {
    return nodeVerifyPassword(passwordHash, password);
  }
  try {
    const res = await callPython<{ valid: boolean }>('/internal/password/verify', {
      passwordHash,
      password,
    });
    return Boolean(res.valid);
  } catch {
    return nodeVerifyPassword(passwordHash, password);
  }
}

export async function pyTotpSetup(username: string): Promise<{ secret: string; otpauthUri: string }> {
  try {
    return await callPython('/internal/totp/setup', { username });
  } catch {
    return nodeTotpSetup(username);
  }
}

export async function pyTotpVerify(secret: string, code: string): Promise<boolean> {
  try {
    const res = await callPython<{ valid: boolean }>('/internal/totp/verify', { secret, code });
    return Boolean(res.valid);
  } catch {
    return nodeTotpVerify(secret, code);
  }
}
