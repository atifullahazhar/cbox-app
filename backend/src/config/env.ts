import 'dotenv/config';
import path from 'node:path';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.startsWith('REPLACE_WITH'))) {
  throw new Error('SESSION_SECRET must be set to a strong random value in production.');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 4000),
  // On Render, RENDER_EXTERNAL_URL is auto-injected; fallback to APP_ORIGIN or localhost
  appOrigin: process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
  serveFrontend: parseBool(process.env.SERVE_FRONTEND, isProd),
  trustProxy: parseBool(process.env.TRUST_PROXY, isProd),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret-change-me',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
  cookieSecure: parseBool(process.env.COOKIE_SECURE, isProd),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  developerAccessCode: process.env.DEVELOPER_ACCESS_CODE || '',
  developerCodeAllowDemo9Digit: parseBool(process.env.DEVELOPER_CODE_ALLOW_DEMO_9_DIGIT, false),
  allowBlockingDevelopers: parseBool(process.env.ALLOW_BLOCKING_DEVELOPERS, false),
  storageDriver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
  localStorageDir: path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || './private_uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'auto',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
};
