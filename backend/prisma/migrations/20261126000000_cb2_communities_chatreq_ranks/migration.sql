-- Chatterbox CB2.0 Additive Migration:
-- 1. Add VICE_ADMIN to GroupRole, CHAT_VIDEO to MediaPurpose, VIDEO to mediaKind
-- 2. Add ChatRequest table (2-step chat approval with 24h deny cooldown)
-- 3. Add chatWallpaper to Conversation & Group, mediaId/mediaKind to GroupMessage
-- 4. Add Discord-style Communities, CommunityChannels (TEXT/VOICE), CommunityMembers, CommunityMessages

ALTER TYPE "GroupRole" ADD VALUE IF NOT EXISTS 'VICE_ADMIN';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'CHAT_VIDEO';

DO $$ BEGIN
  CREATE TYPE "ChatRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityChannelType" AS ENUM ('TEXT', 'VOICE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "wallpaper" VARCHAR(64) NOT NULL DEFAULT 'default';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "wallpaper" VARCHAR(64) NOT NULL DEFAULT 'default';
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "mediaId" TEXT;
ALTER TABLE "GroupMessage" ADD COLUMN IF NOT EXISTS "mediaKind" VARCHAR(16);

CREATE TABLE IF NOT EXISTS "ChatRequest" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "status" "ChatRequestStatus" NOT NULL DEFAULT 'PENDING',
  "deniedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatRequest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRequest_senderId_receiverId_key" ON "ChatRequest"("senderId", "receiverId");
CREATE INDEX IF NOT EXISTS "ChatRequest_receiverId_status_idx" ON "ChatRequest"("receiverId", "status");

CREATE TABLE IF NOT EXISTS "Community" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "description" VARCHAR(300) NOT NULL DEFAULT '',
  "iconEmoji" VARCHAR(16) NOT NULL DEFAULT '🌐',
  "bannerGradient" VARCHAR(64) NOT NULL DEFAULT 'from-sky-600 to-indigo-900',
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "inviteCode" VARCHAR(24) NOT NULL,
  "creatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Community_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Community_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Community_inviteCode_key" ON "Community"("inviteCode");

CREATE TABLE IF NOT EXISTS "CommunityChannel" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "name" VARCHAR(40) NOT NULL,
  "type" "CommunityChannelType" NOT NULL DEFAULT 'TEXT',
  "topic" VARCHAR(160) NOT NULL DEFAULT '',
  "readonlyForMembers" BOOLEAN NOT NULL DEFAULT false,
  "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityChannel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CommunityChannel_communityId_position_idx" ON "CommunityChannel"("communityId", "position");

CREATE TABLE IF NOT EXISTS "CommunityMember" (
  "id" TEXT NOT NULL,
  "communityId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

CREATE TABLE IF NOT EXISTS "CommunityMessage" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" VARCHAR(2000) NOT NULL DEFAULT '',
  "mediaId" TEXT,
  "mediaKind" VARCHAR(16),
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunityChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunityMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CommunityMessage_channelId_createdAt_idx" ON "CommunityMessage"("channelId", "createdAt");
