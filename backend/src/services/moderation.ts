import sharp from 'sharp';

const BLOCKED_MSG =
  'Blocked by Chatterbox Safety Filter: Abusive language, explicit links, videos, or pornographic content is strictly prohibited.';

// Core English + Hindi/Hinglish abusive & explicit sexual terms (normalized word-boundary & substring checks)
const BLOCKED_EXACT_WORDS = new Set([
  'porn',
  'porno',
  'pornhub',
  'xvideos',
  'xnxx',
  'xhamster',
  'redtube',
  'youporn',
  'brazzers',
  'onlyfans',
  'chaturbate',
  'stripchat',
  'spankbang',
  'eporner',
  'nhentai',
  'hentai',
  'rule34',
  'xxx',
  'nsfw',
  'nude',
  'nudes',
  'naked',
  'boobs',
  'tits',
  'pussy',
  'dick',
  'cock',
  'penis',
  'vagina',
  'blowjob',
  'handjob',
  'dildo',
  'cumshot',
  'orgasm',
  'masturbate',
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'mf',
  'bitch',
  'slut',
  'whore',
  'bastard',
  'asshole',
  'cunt',
  'rape',
  'rapist',
  // Hindi / Hinglish abusive & explicit terms
  'madarchod',
  'mc',
  'behenchod',
  'bhenchod',
  'bc',
  'bhosdike',
  'bhosdi',
  'bhosda',
  'chutiya',
  'chutiye',
  'chut',
  'choot',
  'lund',
  'lauda',
  'lavda',
  'gaand',
  'gand',
  'gandu',
  'randi',
  'raand',
  'harami',
  'haramzada',
  'kamina',
  'kamine',
  'kutta',
  'kutiya',
  'saala',
  'suar',
  'jhatu',
  'jhaat',
  'chudai',
  'chod',
  'chodna',
  'muth',
  'mutthi',
  'hawas',
  'nangi',
  'nanga',
]);

// Adult domains & explicit URL patterns (substring checked on normalized URLs/text)
const BLOCKED_DOMAINS_AND_PATTERNS = [
  'pornhub.',
  'xvideos.',
  'xnxx.',
  'xhamster.',
  'redtube.',
  'youporn.',
  'tube8.',
  'spankbang.',
  'eporner.',
  'brazzers.',
  'onlyfans.',
  'fansly.',
  'chaturbate.',
  'stripchat.',
  'bongacams.',
  'cam4.',
  'livejasmin.',
  'myfreecams.',
  'rule34.',
  'nhentai.',
  'hanime.',
  'hentaihaven.',
  'beeg.',
  'txxx.',
  'vporn.',
  'motherless.',
  'fapello.',
  'erome.',
  'redgifs.',
  '/porn',
  '/xxx',
  '/nsfw',
  '/nudes',
  '/hentai',
  '/sex-video',
  '/adult-video',
];

// Block raw video links so explicit video files cannot be shared via URL
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
    return { safe: false, reason: 'Direct video links are blocked by Chatterbox Safety Filter.' };
  }

  const lower = text.toLowerCase();
  const normalized = normalizeForModeration(text);

  // 1. Check blocked adult domains & explicit URL paths
  for (const pat of BLOCKED_DOMAINS_AND_PATTERNS) {
    if (lower.includes(pat) || normalized.includes(pat)) {
      return { safe: false, reason: 'Adult or explicit links are strictly prohibited on Chatterbox.' };
    }
  }

  // 2. Tokenize words (both raw lower and leetspeak-normalized)
  const tokens = new Set<string>([
    ...lower.split(/[^a-z0-9]+/).filter(Boolean),
    ...normalized.split(/[^a-z0-9]+/).filter(Boolean),
  ]);

  for (const token of tokens) {
    if (BLOCKED_EXACT_WORDS.has(token)) {
      return { safe: false, reason: BLOCKED_MSG };
    }
    // Also catch collapsed repeated letters (e.g. fuuuck -> fuck, chuuutiya -> chutiya)
    const collapsed = token.replace(/(.)\1+/g, '$1');
    if (BLOCKED_EXACT_WORDS.has(collapsed)) {
      return { safe: false, reason: BLOCKED_MSG };
    }
  }

  // 3. Catch spaced-out explicit words (e.g. "p o r n" or "f u c k")
  const compact = normalized.replace(/[^a-z]/g, '');
  const severeSubstrings = [
    'pornhub',
    'xvideos',
    'xhamster',
    'redtube',
    'onlyfans',
    'chaturbate',
    'madarchod',
    'behenchod',
    'bhenchod',
    'bhosdike',
    'motherfucker',
  ];
  for (const sub of severeSubstrings) {
    if (compact.includes(sub)) {
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

/**
 * Multi-layer image safety screener:
 * 1. Filename keyword check (blocks files explicitly named porn/nude/xxx/nsfw)
 * 2. Fast in-memory Sharp YCbCr skin-exposure & center-density heuristic screener
 * 3. Optional external AI NSFW webhook (set MODERATION_API_URL + MODERATION_API_KEY in Render env for cloud AI accuracy)
 */
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

  // Optional external AI Moderation API (e.g. Sightengine / Hive / custom Python NSFW endpoint)
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
          throw new Error('Blocked by Chatterbox AI Safety Filter: Explicit or pornographic image detected.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Safety Filter')) throw err;
      // Fall through to built-in pixel screener if external webhook is unreachable
    }
  }

  // Built-in Sharp YCbCr skin-exposure screener (64x64 raw RGB)
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

        // YCbCr skin-tone cluster
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          r > b &&
          Math.abs(r - g) > 15 &&
          cb >= 77 &&
          cb <= 127 &&
          cr >= 133 &&
          cr <= 173;

        if (isSkin) skinPixels++;
        const inCenter = x >= 12 && x < 52 && y >= 12 && y < 52;
        if (inCenter) {
          centerPixels++;
          if (isSkin) centerSkinPixels++;
        }
      }
    }

    const overallRatio = skinPixels / totalPixels;
    const centerRatio = centerSkinPixels / Math.max(centerPixels, 1);

    // Block extreme explicit skin-exposure frames while allowing normal portraits/selfies
    if (overallRatio >= 0.62 && centerRatio >= 0.72) {
      throw new Error(
        'Blocked by Chatterbox Safety Filter: Potentially explicit or NSFW image detected and rejected.'
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Safety Filter')) throw err;
  }
}
