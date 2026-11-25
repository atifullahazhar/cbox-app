-- Make phoneNormalized optional now that signup uses Username + 1-Device-1-ID lock
ALTER TABLE "User" ALTER COLUMN "phoneNormalized" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "phoneVerifiedAt" DROP NOT NULL;
