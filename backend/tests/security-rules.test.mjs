import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Standalone verification of Chatterbox core security invariants, schema constraints, and PWA/env hygiene
const ROOT = path.resolve(process.cwd(), '..');
const USERNAME_REGEX = /^[a-z0-9_.]{3,24}$/;

function normalizeUsername(raw) {
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error('Invalid username');
  }
  if (normalized.startsWith('.') || normalized.endsWith('.') || normalized.includes('..')) {
    throw new Error('Invalid period placement');
  }
  return { display: trimmed, normalized };
}

function verifyDevCode(submitted, configured) {
  if (!configured || configured.startsWith('REPLACE_WITH')) return false;
  const cleanConfigured = configured.trim();
  if (!/^[A-Za-z0-9]{6,32}$/.test(cleanConfigured)) return false;
  const a = Buffer.from(submitted.trim(), 'utf8');
  const b = Buffer.from(cleanConfigured, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

test('Username normalization enforces case-insensitive uniqueness and trims spaces', () => {
  const a = normalizeUsername('  Maya_Chen  ');
  const b = normalizeUsername('maya_chen');
  assert.equal(a.normalized, b.normalized);
  assert.throws(() => normalizeUsername('ab'));
  assert.throws(() => normalizeUsername('bad name'));
  assert.throws(() => normalizeUsername('..bad'));
});

test('Developer code verification supports alphanumeric server-configured codes and rejects placeholders', () => {
  assert.equal(verifyDevCode('TEST1234', 'TEST1234'), true);
  assert.equal(verifyDevCode('test1234', 'TEST1234'), false);
  assert.equal(verifyDevCode('TEST1235', 'TEST1234'), false);
  assert.equal(verifyDevCode('123456789012', '123456789012'), true);
  assert.equal(verifyDevCode('TEST1234', 'REPLACE_WITH_8_CHAR_DEVELOPER_CODE'), false);
  assert.equal(verifyDevCode('short', 'short'), false);
});

test('Frontend source never hardcodes developer codes or database secrets', () => {
  const frontendSrc = path.join(ROOT, 'frontend', 'src');
  function walk(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files = files.concat(walk(full));
      else if (/\.(ts|tsx|js|jsx|html)$/.test(entry.name)) files.push(full);
    }
    return files;
  }
  const files = walk(frontendSrc);
  assert.ok(files.length >= 20, 'Expected at least 20 frontend source files');
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('147852369'), `Legacy developer code leaked in ${file}`);
    assert.ok(!content.includes('ATIF1234'), `Developer code leaked in ${file}`);
    assert.ok(!content.includes('DATABASE_URL'), `DATABASE_URL leaked in ${file}`);
    assert.ok(!content.includes('SESSION_SECRET'), `SESSION_SECRET leaked in ${file}`);
  }
});

test('Prisma schema and SQL migrations enforce unique phone, username, friendships, blocks, and events', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'backend', 'prisma', 'schema.prisma'), 'utf8');
  const migration = fs.readFileSync(
    path.join(ROOT, 'backend', 'prisma', 'migrations', '20261124000000_init', 'migration.sql'),
    'utf8'
  );
  assert.match(schema, /usernameNormalized\s+String\s+@unique/);
  assert.match(schema, /phoneNormalized\s+String\s+@unique/);
  assert.match(schema, /signupDeviceHash\s+String\?\s+@unique/);
  assert.match(schema, /model Event\s*\{/);
  assert.match(schema, /model EventRsvp\s*\{/);
  assert.match(schema, /@@unique\(\[userAId, userBId\]\)/);
  assert.match(schema, /@@unique\(\[blockerId, blockedId\]\)/);
  assert.match(migration, /FriendRequest_unique_pending_pair/);
  assert.match(migration, /WHERE "status" = 'PENDING'/);
});

test('PWA manifest, service worker, icons, and .env.example exist and are valid', () => {
  const manifestRaw = fs.readFileSync(
    path.join(ROOT, 'frontend', 'public', 'manifest.webmanifest'),
    'utf8'
  );
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    const iconPath = path.join(ROOT, 'frontend', 'public', icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(iconPath), `Missing PWA icon: ${icon.src}`);
  }

  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.ok(!envExample.includes('DEVELOPER_ACCESS_CODE=147852369'), '.env.example must use placeholders');
  assert.ok(!envExample.includes('DEVELOPER_ACCESS_CODE=ATIF1234'), '.env.example must use placeholders');
  assert.match(envExample, /ALLOW_BLOCKING_DEVELOPERS=/);
});
