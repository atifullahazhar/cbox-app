import sharp from 'sharp';

const BLOCKED_MSG =
  'Blocked by Chatterbox Safety Filter: Abusive language, explicit links, videos, or pornographic content is strictly prohibited.';

// ---------------- RUNTIME DEVELOPER CONTROL PLATFORM STATE ----------------
export interface PlatformFeatureFlags {
  eventsEnabled: boolean;
  storiesEnabled: boolean;
  callsEnabled: boolean;
  signupsEnabled: boolean;
}

const runtimeState = {
  announcement: '',
  customBlockedWords: new Set<string>(),
  safetyBlocksCount: 0,
  featureFlags: {
    eventsEnabled: true,
    storiesEnabled: true,
    callsEnabled: true,
    signupsEnabled: true,
  } as PlatformFeatureFlags,
};

export function getPlatformAnnouncement(): string {
  return runtimeState.announcement;
}

export function setPlatformAnnouncement(text: string): string {
  runtimeState.announcement = text.trim().slice(0, 240);
  return runtimeState.announcement;
}

export function getPlatformFeatureFlags(): PlatformFeatureFlags {
  return { ...runtimeState.featureFlags };
}

export function updatePlatformFeatureFlags(patch: Partial<PlatformFeatureFlags>): PlatformFeatureFlags {
  runtimeState.featureFlags = { ...runtimeState.featureFlags, ...patch };
  return { ...runtimeState.featureFlags };
}

export function getCustomBlockedWords(): string[] {
  return Array.from(runtimeState.customBlockedWords).sort();
}

export function addCustomBlockedWord(word: string): string[] {
  const clean = word.trim().toLowerCase();
  if (clean.length >= 2 && clean.length <= 48) {
    runtimeState.customBlockedWords.add(clean);
  }
  return getCustomBlockedWords();
}

export function removeCustomBlockedWord(word: string): string[] {
  runtimeState.customBlockedWords.delete(word.trim().toLowerCase());
  return getCustomBlockedWords();
}

export function getSafetyBlocksCount(): number {
  return runtimeState.safetyBlocksCount;
}

// Core English + Hindi/Hinglish abusive & explicit sexual terms
const BLOCKED_EXACT_WORDS = new Set([
  'porn', 'porno', 'pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube', 'youporn',
  'brazzers', 'onlyfans', 'chaturbate', 'stripchat', 'spankbang', 'eporner', 'nhentai',
  'hentai', 'rule34', 'xxx', 'nsfw', 'nude', 'nudes', 'naked', 'boobs', 'tits', 'pussy',
  'dick', 'cock', 'penis', 'vagina', 'blowjob', 'handjob', 'dildo', 'cumshot', 'orgasm',
  'masturbate', 'fuck', 'fucker', 'fucking', 'motherfucker', 'mf', 'bitch', 'slut',
  'whore', 'bastard', 'asshole', 'cunt', 'rape', 'rapist',
  // Hindi / Hinglish abusive & explicit terms
  'madarchod', 'mc', 'behenchod', 'bhenchod', 'bc', 'bhosdike', 'bhosdi', 'bhosda',
  'chutiya', 'chutiye', 'chut', 'choot', 'lund', 'lauda', 'lavda', 'gaand', 'gand',
  'gandu', 'randi', 'raand', 'harami', 'haramzada', 'kamina', 'kamine', 'kutta',
  'kutiya', 'saala', 'suar', 'jhatu', 'jhaat', 'chudai', 'chod', 'chodna', 'muth',
  'mutthi', 'hawas', 'nangi', 'nanga',
]);

// Adult domains & explicit URL patterns
const BLOCKED_DOMAINS_AND_PATTERNS = [
  'pornhub.', 'xvideos.', 'xnxx.', 'xhamster.', 'redtube.', 'youporn.', 'tube8.',
  'spankbang.', 'eporner.', 'brazzers.', 'onlyfans.', 'fansly.', 'chaturbate.',
  'stripchat.', 'bongacams.', 'cam4.', 'livejasmin.', 'myfreecams.', 'rule34.',
  'nhentai.', 'hanime.', 'hentaihaven.', 'beeg.', 'txxx.', 'vporn.', 'motherless.',
  'fapello.', 'erome.', 'redgifs.', '/porn', '/xxx', '/nsfw', '/nudes', '/hentai',
  '/sex-video', '/adult-video',
];

const BLOCKED_VIDEO_LINK_REGEX =
  /https?:\/\/[^\s]+\.(mp4|mov|webm|mkv|avi|flv|wmv|m3u8|ts)(\?[^\s]*)?/i;

function normalizeForModeration(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/(.)\1{2,}/g, '$1$1');
}

export function checkTextSafety(text: string): { safe: boolean; reason?: string } {
  if (!text || !text.trim()) return { safe: true };

  if (BLOCKED_VIDEO_LINK_REGEX.test(text)) {
    runtimeState.safetyBlocksCount++;
    return { safe: false, reason: 'Direct video links are blocked by Chatterbox Safety Filter.' };
  }

  const lower = text.toLowerCase();
  const normalized = normalizeForModeration(text);

  for (const pat of BLOCKED_DOMAINS_AND_PATTERNS) {
    if (lower.includes(pat) || normalized.includes(pat)) {
      runtimeState.safetyBlocksCount++;
      return { safe: false, reason: 'Adult or explicit links are strictly prohibited on Chatterbox.' };
    }
  }

  // Check Developer Control custom blocked words/domains
  for (const custom of runtimeState.customBlockedWords) {
    if (lower.includes(custom) || normalized.includes(custom)) {
      runtimeState.safetyBlocksCount++;
      return { safe: false, reason: BLOCKED_MSG };
    }
  }

  const tokens = new Set<string>([
    ...lower.split(/[^a-z0-9]+/).filter(Boolean),
    ...normalized.split(/[^a-z0-9]+/).filter(Boolean),
  ]);

  for (const token of tokens) {
    if (BLOCKED_EXACT_WORDS.has(token)) {
      runtimeState.safetyBlocksCount++;
      return { safe: false, reason: BLOCKED_MSG };
    }
    const collapsed = token.replace(/(.)\1+/g, '$1');
    if (BLOCKED_EXACT_WORDS.has(collapsed)) {
      runtimeState.safetyBlocksCount++;
      return { safe: false, reason: BLOCKED_MSG };
    }
  }

  const compact = normalized.replace(/[^a-z]/g, '');
  const severeSubstrings = [
    'pornhub', 'xvideos', 'xhamster', 'redtube', 'onlyfans', 'chaturbate',
    'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'motherfucker',
  ];
  for (const sub of severeSubstrings) {
    if (compact.includes(sub)) {
      runtimeState.safetyBlocksCount++;
      return { safe: false, reason: BLOCKED_MSG };
    }
  }

  return { safe: true };
}

export function assertSafeText(text: string | undefined | null): void {
  if (!text) return;
  const result = checkTextSafety(text);
  if (!result.safe) {
    throw new Error(result.reason || BLOCKED_MSG);
  }
}

export async function assertSafeImageBuffer(
  buffer: Buffer,
  originalFilename?: string
): Promise<void> {
  if (originalFilename) {
    const fnCheck = checkTextSafety(originalFilename);
    if (!fnCheck.safe) {
      throw new Error('Blocked by Chatterbox Safety Filter: Explicit media filenames are not allowed.');
    }
  }

  const apiUrl = process.env.MODERATION_API_URL?.trim();
  const apiKey = process.env.MODERATION_API_KEY?.trim();
  if (apiUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ imageBase64: buffer.toString('base64') }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const verdict = (await res.json().catch(() => ({}))) as { safe?: boolean; nsfw?: boolean };
        if (verdict.safe === false || verdict.nsfw === true) {
          runtimeState.safetyBlocksCount++;
          throw new Error('Blocked by Chatterbox AI Safety Filter: Explicit or pornographic image detected.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Safety Filter')) throw err;
    }
  }

  try {
    const { data, info } = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
      .resize(64, 64, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    let skinPixels = 0;
    let centerPixels = 0;
    let centerSkinPixels = 0;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const isSkin =
          r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 &&
          cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;

        if (isSkin) skinPixels++;
        if (x >= 12 && x < 52 && y >= 12 && y < 52) {
          centerPixels++;
          if (isSkin) centerSkinPixels++;
        }
      }
    }

    const overallRatio = skinPixels / totalPixels;
    const centerRatio = centerSkinPixels / Math.max(centerPixels, 1);

    if (overallRatio >= 0.62 && centerRatio >= 0.72) {
      runtimeState.safetyBlocksCount++;
      throw new Error(
        'Blocked by Chatterbox Safety Filter: Potentially explicit or NSFW image detected and rejected.'
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Safety Filter')) throw err;
  }
}
