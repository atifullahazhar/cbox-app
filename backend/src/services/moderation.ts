import sharp from 'sharp';

const BLOCKED_MSG =
  'Blocked by Chatterbox Safety Filter: Abusive language, explicit links, videos, or pornographic content is strictly prohibited.';

// ---------------- RUNTIME DEVELOPER CONTROL PLATFORM STATE ----------------
export interface PlatformFeatureFlags {
  eventsEnabled: boolean;
  storiesEnabled: boolean;
  callsEnabled: boolean;
  signupsEnabled: boolean;
  mediaUploadsEnabled: boolean;
  maintenanceMode: boolean;
  publicFeedFreeze: boolean;
}

export interface PlatformConfig {
  defaultThemeKey: string;
  maxUploadMb: number;
  nsfwSensitivity: 'strict' | 'balanced' | 'relaxed';
  welcomeMessage: string;
}

export interface FeedbackEntry {
  id: string;
  username: string;
  category: string;
  message: string;
  createdAt: string;
}

const runtimeState = {
  announcement: '',
  customBlockedWords: new Set<string>(),
  reservedUsernames: new Set<string>(['founder', 'atif', 'official', 'chatterbox_hq', 'moderator']),
  safetyBlocksCount: 0,
  feedbackInbox: [] as FeedbackEntry[],
  featureFlags: {
    eventsEnabled: true,
    storiesEnabled: true,
    callsEnabled: true,
    signupsEnabled: true,
    mediaUploadsEnabled: true,
    maintenanceMode: false,
    publicFeedFreeze: false,
  } as PlatformFeatureFlags,
  config: {
    defaultThemeKey: 'midnight-neon',
    maxUploadMb: 8,
    nsfwSensitivity: 'balanced',
    welcomeMessage: 'Welcome to Chatterbox!',
  } as PlatformConfig,
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

export function getPlatformConfig(): PlatformConfig {
  return { ...runtimeState.config };
}

export function updatePlatformConfig(patch: Partial<PlatformConfig>): PlatformConfig {
  if (patch.maxUploadMb !== undefined) {
    patch.maxUploadMb = Math.min(Math.max(Number(patch.maxUploadMb) || 8, 1), 16);
  }
  runtimeState.config = { ...runtimeState.config, ...patch };
  return { ...runtimeState.config };
}

export function getReservedUsernames(): string[] {
  return Array.from(runtimeState.reservedUsernames).sort();
}

export function isExtraReservedUsername(normalized: string): boolean {
  return runtimeState.reservedUsernames.has(normalized.toLowerCase());
}

export function addReservedUsername(handle: string): string[] {
  const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (clean.length >= 3 && clean.length <= 24) runtimeState.reservedUsernames.add(clean);
  return getReservedUsernames();
}

export function removeReservedUsername(handle: string): string[] {
  runtimeState.reservedUsernames.delete(handle.trim().toLowerCase());
  return getReservedUsernames();
}

export function addFeedbackItem(username: string, category: string, message: string): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username,
    category: category.slice(0, 32),
    message: message.trim().slice(0, 600),
    createdAt: new Date().toISOString(),
  };
  runtimeState.feedbackInbox.unshift(entry);
  if (runtimeState.feedbackInbox.length > 100) runtimeState.feedbackInbox.pop();
  return entry;
}

export function getFeedbackInbox(): FeedbackEntry[] {
  return [...runtimeState.feedbackInbox];
}

export function dismissFeedbackItem(id: string): FeedbackEntry[] {
  runtimeState.feedbackInbox = runtimeState.feedbackInbox.filter((f) => f.id !== id);
  return getFeedbackInbox();
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

const BLOCKED_EXACT_WORDS = new Set([
  'porn', 'porno', 'pornhub', 'xvideos', 'xnxx', 'xhamster', 'redtube', 'youporn',
  'brazzers', 'onlyfans', 'chaturbate', 'stripchat', 'spankbang', 'eporner', 'nhentai',
  'hentai', 'rule34', 'xxx', 'nsfw', 'nude', 'nudes', 'naked', 'boobs', 'tits', 'pussy',
  'dick', 'cock', 'penis', 'vagina', 'blowjob', 'handjob', 'dildo', 'cumshot', 'orgasm',
  'masturbate', 'fuck', 'fucker', 'fucking', 'motherfucker', 'mf', 'bitch', 'slut',
  'whore', 'bastard', 'asshole', 'cunt', 'rape', 'rapist',
  'madarchod', 'mc', 'behenchod', 'bhenchod', 'bc', 'bhosdike', 'bhosdi', 'bhosda',
  'chutiya', 'chutiye', 'chut', 'choot', 'lund', 'lauda', 'lavda', 'gaand', 'gand',
  'gandu', 'randi', 'raand', 'harami', 'haramzada', 'kamina', 'kamine', 'kutta',
  'kutiya', 'saala', 'suar', 'jhatu', 'jhaat', 'chudai', 'chod', 'chodna', 'muth',
  'mutthi', 'hawas', 'nangi', 'nanga',
]);

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

    const thresholds =
      runtimeState.config.nsfwSensitivity === 'strict'
        ? { overall: 0.52, center: 0.62 }
        : runtimeState.config.nsfwSensitivity === 'relaxed'
        ? { overall: 0.72, center: 0.80 }
        : { overall: 0.62, center: 0.72 };

    if (overallRatio >= thresholds.overall && centerRatio >= thresholds.center) {
      runtimeState.safetyBlocksCount++;
      throw new Error(
        'Blocked by Chatterbox Safety Filter: Potentially explicit or NSFW image detected and rejected.'
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Safety Filter')) throw err;
  }
}
