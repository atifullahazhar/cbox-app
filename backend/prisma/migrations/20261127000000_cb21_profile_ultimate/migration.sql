-- Chatterbox CB2.1: Ultimate Profile Update (Additive & Idempotent)
ALTER TYPE "PostAudience" ADD VALUE IF NOT EXISTS 'CLOSE_FRIENDS';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'PROFILE_AUDIO';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarFrame" VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileEffect" VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customStatusEmoji" VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customStatusText" VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileMusicTitle" VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileMusicArtist" VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileMusicPreset" VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileMusicMediaId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bioLinks" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "interestTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showProfileViews" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "StoryHighlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "coverEmoji" VARCHAR(16) NOT NULL DEFAULT '✨',
    "storyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryHighlight_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoryHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StoryHighlight_userId_createdAt_idx" ON "StoryHighlight"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "ProfileView" (
    "id" TEXT NOT NULL,
    "profileUserId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProfileView_profileUserId_fkey" FOREIGN KEY ("profileUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProfileView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileView_profileUserId_viewerId_key" ON "ProfileView"("profileUserId", "viewerId");
CREATE INDEX IF NOT EXISTS "ProfileView_profileUserId_viewedAt_idx" ON "ProfileView"("profileUserId", "viewedAt");

CREATE TABLE IF NOT EXISTS "CloseFriend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseFriend_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CloseFriend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CloseFriend_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CloseFriend_userId_friendId_key" ON "CloseFriend"("userId", "friendId");
CREATE INDEX IF NOT EXISTS "CloseFriend_userId_idx" ON "CloseFriend"("userId");
CREATE INDEX IF NOT EXISTS "CloseFriend_friendId_idx" ON "CloseFriend"("friendId");

CREATE TABLE IF NOT EXISTS "UserModerationPref" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserModerationPref_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserModerationPref_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserModerationPref_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserModerationPref_ownerId_targetId_key" ON "UserModerationPref"("ownerId", "targetId");
CREATE INDEX IF NOT EXISTS "UserModerationPref_ownerId_idx" ON "UserModerationPref"("ownerId");
