-- Chatterbox Phase 3 + Phase 4 Full Reset & Ultimate Upgrade Migration
-- 1. Cleanly removes all legacy test IDs (as requested) so every account requires a verified unique mobile number.
-- 2. Enforces phoneNormalized NOT NULL UNIQUE at the PostgreSQL level.
-- 3. Adds 10-theme themeKey, 2FA TOTP fields, and Group Chats + Admin Roles + Invite Links + Live Polls.

TRUNCATE TABLE "User" CASCADE;
TRUNCATE TABLE "OtpChallenge" CASCADE;
TRUNCATE TABLE "AuditEvent" CASCADE;

CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

ALTER TABLE "User"
  ALTER COLUMN "phoneNormalized" SET NOT NULL,
  ALTER COLUMN "phoneVerifiedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "phoneVerifiedAt" SET NOT NULL,
  ADD COLUMN IF NOT EXISTS "totpSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "themeKey" VARCHAR(32) NOT NULL DEFAULT 'midnight-neon';

CREATE TABLE IF NOT EXISTS "Group" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(240) NOT NULL DEFAULT '',
    "inviteCode" VARCHAR(24) NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Group_inviteCode_key" ON "Group"("inviteCode");
CREATE INDEX IF NOT EXISTS "Group_inviteCode_idx" ON "Group"("inviteCode");

CREATE TABLE IF NOT EXISTS "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");

CREATE TABLE IF NOT EXISTS "GroupMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");

CREATE TABLE IF NOT EXISTS "GroupPoll" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "question" VARCHAR(240) NOT NULL,
    "options" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupPoll_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GroupPoll_groupId_createdAt_idx" ON "GroupPoll"("groupId", "createdAt");

CREATE TABLE IF NOT EXISTS "GroupPollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupPollVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupPollVote_pollId_userId_key" ON "GroupPollVote"("pollId", "userId");
CREATE INDEX IF NOT EXISTS "GroupPollVote_pollId_idx" ON "GroupPollVote"("pollId");

ALTER TABLE "Group" ADD CONSTRAINT "Group_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPoll" ADD CONSTRAINT "GroupPoll_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPoll" ADD CONSTRAINT "GroupPoll_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPollVote" ADD CONSTRAINT "GroupPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "GroupPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPollVote" ADD CONSTRAINT "GroupPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
