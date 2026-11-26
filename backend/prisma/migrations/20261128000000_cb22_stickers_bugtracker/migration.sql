-- Chatterbox CB2.2: Custom Sticker Maker & Bug Tracker (Additive & Idempotent)
ALTER TYPE "MediaPurpose" ADD VALUE IF NOT EXISTS 'CUSTOM_STICKER';

DO $$ BEGIN
  CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FIXED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CustomSticker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomSticker_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomSticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomSticker_userId_createdAt_idx" ON "CustomSticker"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "BugReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "section" VARCHAR(32) NOT NULL DEFAULT 'General',
    "severity" VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    "description" VARCHAR(1000) NOT NULL,
    "deviceInfo" VARCHAR(240) NOT NULL DEFAULT '',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "devNote" VARCHAR(400) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BugReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BugReport_reporterId_idx" ON "BugReport"("reporterId");
