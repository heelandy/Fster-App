-- Made idempotent so it can be re-applied safely on a database that already has
-- some/all of these objects (e.g. created earlier via `prisma db push`). This is
-- what caused the P3009 failure: `ADD COLUMN "visitor"` hit an already-existing
-- column. Every statement below now no-ops if the object already exists.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OversightStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "visitor" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyInvite" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'CASE_WORKER',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyOversightRequest" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "status" "OversightStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AgencyOversightRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyInvite_tokenHash_key" ON "AgencyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyInvite_agencyId_idx" ON "AgencyInvite"("agencyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyInvite_email_idx" ON "AgencyInvite"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyOversightRequest_householdId_idx" ON "AgencyOversightRequest"("householdId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyOversightRequest_agencyId_idx" ON "AgencyOversightRequest"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyOversightRequest_agencyId_householdId_key" ON "AgencyOversightRequest"("agencyId", "householdId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AgencyOversightRequest" ADD CONSTRAINT "AgencyOversightRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AgencyOversightRequest" ADD CONSTRAINT "AgencyOversightRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
