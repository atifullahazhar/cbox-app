// Generates a stable browser/hardware device fingerprint + persistent local lock flag
// Used alongside server HttpOnly cookie + PostgreSQL unique constraint for 1-device = 1-ID enforcement

const DEVICE_REGISTERED_KEY = 'chatterbox_device_account_created_v1';

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash if SubtleCrypto unavailable
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}${(
    (h1 ^ h2) >>>
    0
  )
    .toString(16)
    .padStart(8, '0')}`;
}

function getCanvasSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 0, 120, 20);
    ctx.fillStyle = '#111827';
    ctx.fillText('Chatterbox-Device-Sig', 4, 4);
    return canvas.toDataURL().slice(-48);
  } catch {
    return 'canvas-err';
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  const signals = [
    navigator.userAgent || '',
    navigator.language || '',
    String(navigator.hardwareConcurrency || 0),
    String(navigator.maxTouchPoints || 0),
    String(screen.width || 0),
    String(screen.height || 0),
    String(screen.colorDepth || 0),
    tz,
    getCanvasSignature(),
  ].join('|');

  return sha256Hex(signals);
}

export function isLocallyMarkedDeviceLocked(): boolean {
  try {
    return localStorage.getItem(DEVICE_REGISTERED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markDeviceLocallyLocked(): void {
  try {
    localStorage.setItem(DEVICE_REGISTERED_KEY, '1');
  } catch {
    // Ignore storage quota errors
  }
}
