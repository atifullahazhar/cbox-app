-- Persistent PostgreSQL media storage (prevents avatar/banner/photo loss on Render redeploy/restart)
-- Plus Developer Control user governance fields (isSuspended, isVerified, customFlair)
ALTER TABLE "MediaAsset" ADD COLUMN IF NOT EXISTS "fileData" BYTEA;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customFlair" VARCHAR(32) NOT NULL DEFAULT '';
