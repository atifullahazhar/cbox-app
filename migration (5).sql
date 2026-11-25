-- Additive migration: enforce 1 account per device (signupDeviceHash unique) and support no-OTP signup
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupDeviceHash" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "User_signupDeviceHash_key" ON "User"("signupDeviceHash");
