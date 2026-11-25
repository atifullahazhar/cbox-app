import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MediaPurpose } from '@prisma/client';
import { env } from '../config/env.js';
import { assertSafeImageBuffer } from './moderation.js';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
]);

const IMAGE_DIMENSIONS: Partial<Record<MediaPurpose, { maxWidth: number; maxHeight: number }>> = {
  AVATAR: { maxWidth: 512, maxHeight: 512 },
  BANNER: { maxWidth: 1600, maxHeight: 600 },
  POST_IMAGE: { maxWidth: 1920, maxHeight: 1920 },
  CHAT_IMAGE: { maxWidth: 1600, maxHeight: 1600 },
  STORY_IMAGE: { maxWidth: 1080, maxHeight: 1920 },
};

let s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!s3Client) {
    if (!env.s3.bucket || !env.s3.accessKeyId || !env.s3.secretAccessKey) {
      throw new Error('S3 storage credentials are not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
    }
    s3Client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint || undefined,
      forcePathStyle: Boolean(env.s3.endpoint),
      credentials: {
        accessKeyId: env.s3.accessKeyId,
        secretAccessKey: env.s3.secretAccessKey,
      },
    });
  }
  return s3Client;
}

async function writeBuffer(storageKey: string, data: Buffer, contentType: string): Promise<void> {
  if (env.storageDriver === 's3') {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: storageKey,
        Body: data,
        ContentType: contentType,
        CacheControl: 'private, max-age=3600',
      })
    );
  } else {
    const fullPath = path.join(env.localStorageDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }
}

export async function processAndStoreImage(params: {
  buffer: Buffer;
  declaredMimeType: string;
  ownerId: string;
  purpose: MediaPurpose;
  originalFilename?: string;
}): Promise<{
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}> {
  if (params.declaredMimeType.startsWith('video/')) {
    throw new Error('Blocked by Chatterbox Safety Filter: Video uploads are strictly disabled.');
  }
  if (!ALLOWED_IMAGE_MIMES.has(params.declaredMimeType)) {
    throw new Error('Unsupported image type. Allowed formats: JPEG, PNG, WebP.');
  }
  if (params.buffer.length === 0 || params.buffer.length > env.maxUploadBytes) {
    throw new Error(`Image exceeds maximum allowed size (${Math.round(env.maxUploadBytes / (1024 * 1024))} MB).`);
  }

  // Enforce anti-NSFW / explicit image safety screening before storing
  await assertSafeImageBuffer(params.buffer, params.originalFilename);

  const dims = IMAGE_DIMENSIONS[params.purpose] || { maxWidth: 1600, maxHeight: 1600 };
  const pipeline = sharp(params.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
  const metadata = await pipeline.metadata();

  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Uploaded file is not a valid JPEG, PNG, or WebP image.');
  }

  const reencoded = await pipeline
    .rotate()
    .resize({
      width: dims.maxWidth,
      height: dims.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });

  const storageKey = `${params.purpose.toLowerCase()}/${params.ownerId}/${crypto.randomUUID()}.webp`;
  await writeBuffer(storageKey, reencoded.data, 'image/webp');

  return {
    storageKey,
    mimeType: 'image/webp',
    byteSize: reencoded.info.size,
    width: reencoded.info.width,
    height: reencoded.info.height,
  };
}

export async function processAndStoreAudio(params: {
  buffer: Buffer;
  declaredMimeType: string;
  ownerId: string;
  originalFilename?: string;
}): Promise<{
  storageKey: string;
  mimeType: string;
  byteSize: number;
}> {
  const baseMime = params.declaredMimeType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
    throw new Error('Unsupported audio format for voice note.');
  }
  if (params.buffer.length === 0 || params.buffer.length > env.maxUploadBytes) {
    throw new Error(`Voice note exceeds maximum allowed size (${Math.round(env.maxUploadBytes / (1024 * 1024))} MB).`);
  }

  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  const ext = extMap[baseMime] || 'webm';
  const storageKey = `chat_audio/${params.ownerId}/${crypto.randomUUID()}.${ext}`;
  await writeBuffer(storageKey, params.buffer, baseMime);

  return {
    storageKey,
    mimeType: baseMime,
    byteSize: params.buffer.length,
  };
}

export async function readStoredMedia(storageKey: string): Promise<Buffer> {
  if (env.storageDriver === 's3') {
    const res = await getS3Client().send(
      new GetObjectCommand({
        Bucket: env.s3.bucket,
        Key: storageKey,
      })
    );
    if (!res.Body) throw new Error('Media object not found');
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  const resolvedBase = path.resolve(env.localStorageDir);
  const resolvedTarget = path.resolve(resolvedBase, storageKey);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Invalid storage path');
  }
  return fs.readFile(resolvedTarget);
}

export async function deleteStoredMedia(storageKey: string): Promise<void> {
  try {
    if (env.storageDriver === 's3') {
      await getS3Client().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: storageKey }));
    } else {
      const resolvedBase = path.resolve(env.localStorageDir);
      const resolvedTarget = path.resolve(resolvedBase, storageKey);
      if (resolvedTarget.startsWith(resolvedBase + path.sep)) {
        await fs.unlink(resolvedTarget);
      }
    }
  } catch {
    // Ignore missing files on cleanup
  }
}
