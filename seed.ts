import 'dotenv/config';
import { PrismaClient, PostAudience, ThemePreference, UserRole } from '@prisma/client';
import argon2 from 'argon2';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const prisma = new PrismaClient();

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function createSampleImage(storageDir: string, storageKey: string, bgHex: string, label: string, width: number, height: number) {
  const fullPath = path.join(storageDir, storageKey);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgHex}" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
    <circle cx="${Math.round(width * 0.78)}" cy="${Math.round(height * 0.28)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="#38bdf8" fill-opacity="0.18" />
    <circle cx="${Math.round(width * 0.24)}" cy="${Math.round(height * 0.72)}" r="${Math.round(Math.min(width, height) * 0.16)}" fill="#818cf8" fill-opacity="0.22" />
    <text x="50%" y="52%" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="${Math.round(Math.min(width, height) * 0.08)}" font-weight="600">${label}</text>
  </svg>`;

  const buf = await sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer();
  await fs.writeFile(fullPath, buf);
  return { byteSize: buf.length, width, height, mimeType: 'image/webp' };
}

async function main() {
  const storageDir = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || './private_uploads');
  console.log('[Cbox Seed] Creating clearly labelled demo accounts (isDemo = true)...');

  // Demo passwords are ONLY for local development preview and are never production credentials.
  const demoPasswordHash = await argon2.hash('CboxDemo!2026', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const maya = await prisma.user.upsert({
    where: { usernameNormalized: 'maya_chen' },
    update: {},
    create: {
      usernameNormalized: 'maya_chen',
      usernameDisplay: 'maya_chen',
      passwordHash: demoPasswordHash,
      primaryNickname: 'Maya Chen',
      alternateNicknames: ['May', 'StudioM'],
      bio: 'Product designer exploring calm social spaces and street photography.',
      theme: ThemePreference.DARK,
      role: UserRole.USER,
      isDemo: true,
    },
  });

  const alex = await prisma.user.upsert({
    where: { usernameNormalized: 'alex_rivera' },
    update: {},
    create: {
      usernameNormalized: 'alex_rivera',
      usernameDisplay: 'alex_rivera',
      passwordHash: demoPasswordHash,
      primaryNickname: 'Alex Rivera',
      alternateNicknames: ['ARiv'],
      bio: 'Coffee, trail running, and weekend film rolls.',
      theme: ThemePreference.LIGHT,
      role: UserRole.USER,
      isDemo: true,
    },
  });

  const sam = await prisma.user.upsert({
    where: { usernameNormalized: 'sam_patel' },
    update: {},
    create: {
      usernameNormalized: 'sam_patel',
      usernameDisplay: 'sam_patel',
      passwordHash: demoPasswordHash,
      primaryNickname: 'Sam Patel',
      alternateNicknames: ['SamP'],
      bio: 'Not yet friends with Maya — useful for testing Friends-only vs Public post permissions.',
      theme: ThemePreference.SYSTEM,
      role: UserRole.USER,
      isDemo: true,
    },
  });

  const devAccount = await prisma.user.upsert({
    where: { usernameNormalized: 'dev_cbox' },
    update: {},
    create: {
      usernameNormalized: 'dev_cbox',
      usernameDisplay: 'dev_cbox',
      passwordHash: demoPasswordHash,
      primaryNickname: 'Cbox Developer',
      alternateNicknames: ['CoreEng'],
      bio: 'Demo account with server-assigned DEVELOPER role for Developer Space verification.',
      theme: ThemePreference.DARK,
      role: UserRole.DEVELOPER,
      isDemo: true,
    },
  });

  // Mutual friendship between Maya and Alex
  const [fA, fB] = canonicalPair(maya.id, alex.id);
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: fA, userBId: fB } },
    update: {},
    create: { userAId: fA, userBId: fB },
  });

  // Pending incoming request from Sam -> Maya
  const existingReq = await prisma.friendRequest.findFirst({
    where: { senderId: sam.id, receiverId: maya.id, status: 'PENDING' },
  });
  if (!existingReq) {
    await prisma.friendRequest.create({
      data: { senderId: sam.id, receiverId: maya.id, status: 'PENDING' },
    });
  }

  // Initial conversation between Maya and Alex
  const conv = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId: fA, userBId: fB } },
    update: {},
    create: { userAId: fA, userBId: fB, lastMessageAt: new Date() },
  });

  const existingMessages = await prisma.message.count({ where: { conversationId: conv.id } });
  if (existingMessages === 0) {
    await prisma.message.createMany({
      data: [
        {
          conversationId: conv.id,
          senderId: alex.id,
          content: 'Hey Maya! Welcome to Cbox — real-time messages sync across desktop and Android.',
          deliveryState: 'READ',
        },
        {
          conversationId: conv.id,
          senderId: maya.id,
          content: 'Love how clean the layout is. Just uploaded a couple of demo photos to Posts.',
          deliveryState: 'DELIVERED',
        },
      ],
    });
  }

  // Sample demo posts (1 PUBLIC, 1 FRIENDS_ONLY)
  const existingPosts = await prisma.post.count({ where: { authorId: maya.id } });
  if (existingPosts === 0) {
    const pubKey = `demo/${maya.id}/public-skyline.webp`;
    const pubMeta = await createSampleImage(storageDir, pubKey, '#0ea5e9', 'Cbox Public Post', 1080, 810);
    const pubMedia = await prisma.mediaAsset.create({
      data: { ownerId: maya.id, purpose: 'POST_IMAGE', storageKey: pubKey, ...pubMeta },
    });
    await prisma.post.create({
      data: {
        authorId: maya.id,
        mediaId: pubMedia.id,
        caption: 'Evening blue hour from the studio window. Shared publicly with everyone on Cbox.',
        audience: PostAudience.PUBLIC,
      },
    });

    const friendsKey = `demo/${maya.id}/friends-coffee.webp`;
    const friendsMeta = await createSampleImage(storageDir, friendsKey, '#6366f1', 'Friends-Only Snapshot', 1080, 810);
    const friendsMedia = await prisma.mediaAsset.create({
      data: { ownerId: maya.id, purpose: 'POST_IMAGE', storageKey: friendsKey, ...friendsMeta },
    });
    await prisma.post.create({
      data: {
        authorId: maya.id,
        mediaId: friendsMedia.id,
        caption: 'Private friends-only studio notes — visible only to accepted friends like @alex_rivera.',
        audience: PostAudience.FRIENDS_ONLY,
      },
    });
  }

  console.log('[Cbox Seed] Completed successfully.');
  console.log('  Demo accounts (password for all demo accounts: CboxDemo!2026):');
  console.log('   - @maya_chen   (USER, friends with @alex_rivera, pending request from @sam_patel)');
  console.log('   - @alex_rivera (USER, friends with @maya_chen)');
  console.log('   - @sam_patel   (USER, not friends with @maya_chen — verifies Friends-only isolation)');
  console.log('   - @dev_cbox    (DEVELOPER — verifies Developer Space access)');
}

main()
  .catch((err) => {
    console.error('[Cbox Seed] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
