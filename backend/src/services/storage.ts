import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MediaPurpose } from '@prisma/client';
import { env } from '../config/env.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PURPOSE_DIMENSIONS: Record<MediaPurpose, { maxWidth: number; maxHeight: number }> = {
  AVATAR: { maxWidth: 512, maxHeight: 512 },
  BANNER: { maxWidth: 1600, maxHeight: 600 },
  POST_IMAGE: { maxWidth: 1920, maxHeight: 1920 },
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

export async function processAndStoreImage(params: {
  buffer: Buffer;
  declaredMimeType: string;
  ownerId: string;
  purpose: MediaPurpose;
}): Promise<{
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}> {
  if (!ALLOWED_MIME_TYPES.has(params.declaredMimeType)) {
    throw new Error('Unsupported image type. Allowed formats: JPEG, PNG, WebP.');
  }
  if (params.buffer.length === 0 || params.buffer.length > env.maxUploadBytes) {
    throw new Error(`Image exceeds maximum allowed size (${Math.round(env.maxUploadBytes / (1024 * 1024))} MB).`);
  }

  // Decode & re-encode with Sharp to strip EXIF metadata, neutralize polyglot payloads, and verify actual image bytes
  const dims = PURPOSE_DIMENSIONS[params.purpose];
  const pipeline = sharp(params.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
  const metadata = await pipeline.metadata();

  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Uploaded file is not a valid JPEG, PNG, or WebP image.');
  }

  const reencoded = await pipeline
    .rotate() // Apply EXIF orientation before stripping metadata
    .resize({
      width: dims.maxWidth,
      height: dims.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });

  const storageKey = `${params.purpose.toLowerCase()}/${params.ownerId}/${crypto.randomUUID()}.webp`;

  if (env.storageDriver === 's3') {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: storageKey,
        Body: reencoded.data,
        ContentType: 'image/webp',
        CacheControl: 'private, max-age=3600',
      })
    );
  } else {
    const fullPath = path.join(env.localStorageDir, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, reencoded.data);
  }

  return {
    storageKey,
    mimeType: 'image/webp',
    byteSize: reencoded.info.size,
    width: reencoded.info.width,
    height: reencoded.info.height,
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

  // Prevent path traversal on local disk
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
