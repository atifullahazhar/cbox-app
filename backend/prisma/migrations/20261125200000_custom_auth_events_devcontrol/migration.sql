-- Chatterbox Custom Auth Wizard + Public Events + Developer Control Migration

CREATE TYPE "EventRsvpStatus" AS ENUM ('GOING', 'INTERESTED');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isPrivateProfile" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "Event" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "category" VARCHAR(32) NOT NULL DEFAULT 'Meetup',
    "description" VARCHAR(600) NOT NULL DEFAULT '',
    "location" VARCHAR(120) NOT NULL DEFAULT 'Online on Chatterbox',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "bgGradient" VARCHAR(80) NOT NULL DEFAULT 'from-sky-600 to-indigo-900',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Event_startsAt_idx" ON "Event"("startsAt");

CREATE TABLE IF NOT EXISTS "EventRsvp" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "EventRsvp_eventId_idx" ON "EventRsvp"("eventId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
