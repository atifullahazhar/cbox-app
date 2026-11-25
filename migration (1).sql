-- Cbox Phase 1 Power Pack Additive Migration
-- Safe to run on existing Render PostgreSQL database without dropping user data.

ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'CHAT_IMAGE';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'CHAT_AUDIO';
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'STORY_IMAGE';

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "mediaId" TEXT,
  ADD COLUMN IF NOT EXISTS "mediaKind" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Message_mediaId_key" ON "Message"("mediaId");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

ALTER TABLE "MessageReaction"
  ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageReaction"
  ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");
CREATE INDEX IF NOT EXISTS "PostLike_postId_idx" ON "PostLike"("postId");

ALTER TABLE "PostLike"
  ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostLike"
  ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(600) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PostComment_postId_deletedAt_createdAt_idx" ON "PostComment"("postId", "deletedAt", "createdAt");

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Story" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mediaId" TEXT,
    "textContent" VARCHAR(280) NOT NULL DEFAULT '',
    "bgGradient" VARCHAR(80) NOT NULL DEFAULT 'from-sky-600 to-indigo-900',
    "audience" "PostAudience" NOT NULL DEFAULT 'FRIENDS_ONLY',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Story_mediaId_key" ON "Story"("mediaId");
CREATE INDEX IF NOT EXISTS "Story_authorId_expiresAt_deletedAt_idx" ON "Story"("authorId", "expiresAt", "deletedAt");
CREATE INDEX IF NOT EXISTS "Story_audience_expiresAt_deletedAt_idx" ON "Story"("audience", "expiresAt", "deletedAt");

ALTER TABLE "Story"
  ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Story"
  ADD CONSTRAINT "Story_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");
CREATE INDEX IF NOT EXISTS "StoryView_storyId_idx" ON "StoryView"("storyId");

ALTER TABLE "StoryView"
  ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryView"
  ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
