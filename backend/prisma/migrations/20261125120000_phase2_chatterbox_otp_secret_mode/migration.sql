-- Chatterbox Phase 2 Additive Migration
-- Adds unique phone + OTP challenges, Secret Mode vault & disappearing timers, privacy toggles, safety reports, and push subscriptions.

CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'RESET_PASSWORD');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phoneNormalized" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "secretPinHash" TEXT,
  ADD COLUMN IF NOT EXISTS "hideOnlineStatus" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "disableReadReceipts" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phoneNormalized_key" ON "User"("phoneNormalized");
CREATE INDEX IF NOT EXISTS "User_phoneNormalized_idx" ON "User"("phoneNormalized");

CREATE TABLE IF NOT EXISTS "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phoneNormalized" VARCHAR(20) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OtpChallenge_phoneNormalized_purpose_createdAt_idx" ON "OtpChallenge"("phoneNormalized", "purpose", "createdAt");

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "hiddenByA" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hiddenByB" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "disappearAfterSeconds" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Message_expiresAt_idx" ON "Message"("expiresAt");

CREATE TABLE IF NOT EXISTS "SafetyReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetPostId" TEXT,
    "reason" VARCHAR(80) NOT NULL,
    "details" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SafetyReport_status_createdAt_idx" ON "SafetyReport"("status", "createdAt");

ALTER TABLE "SafetyReport"
  ADD CONSTRAINT "SafetyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyReport"
  ADD CONSTRAINT "SafetyReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SafetyReport"
  ADD CONSTRAINT "SafetyReport_targetPostId_fkey" FOREIGN KEY ("targetPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
