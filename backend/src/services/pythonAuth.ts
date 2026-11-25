import { env } from '../config/env.js';

async function callPython<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env.pythonAuthUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': env.internalAuthKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `Python auth service error (${res.status})`);
  }
  return data as T;
}

export async function pyNormalizePhone(phone: string): Promise<string> {
  const res = await callPython<{ phoneNormalized: string }>('/internal/phone/normalize', { phone });
  return res.phoneNormalized;
}

export async function pyHashPassword(password: string): Promise<string> {
  const res = await callPython<{ passwordHash: string }>('/internal/password/hash', { password });
  return res.passwordHash;
}

export async function pyVerifyPassword(passwordHash: string, password: string): Promise<boolean> {
  const res = await callPython<{ valid: boolean }>('/internal/password/verify', {
    passwordHash,
    password,
  });
  return Boolean(res.valid);
}

export async function pyCreateOtp(
  phone: string,
  purpose: 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD'
): Promise<{
  phoneNormalized: string;
  codeHash: string;
  deliveredVia: string;
  demoCode: string | null;
}> {
  return callPython('/internal/otp/create', { phone, purpose });
}

export async function pyVerifyOtp(
  phone: string,
  purpose: 'SIGNUP' | 'LOGIN' | 'RESET_PASSWORD',
  code: string,
  expectedHash: string
): Promise<boolean> {
  const res = await callPython<{ valid: boolean }>('/internal/otp/verify', {
    phone,
    purpose,
    code,
    expectedHash,
  });
  return Boolean(res.valid);
}

export async function pyTotpSetup(username: string): Promise<{ secret: string; otpauthUri: string }> {
  return callPython('/internal/totp/setup', { username });
}

export async function pyTotpVerify(secret: string, code: string): Promise<boolean> {
  const res = await callPython<{ valid: boolean }>('/internal/totp/verify', { secret, code });
  return Boolean(res.valid);
}
