-- CreateEnum
CREATE TYPE "OversightStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "visitor" TEXT;

-- CreateTable
CREATE TABLE "AgencyInvite" (
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
CREATE TABLE "AgencyOversightRequest" (
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
CREATE UNIQUE INDEX "AgencyInvite_tokenHash_key" ON "AgencyInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AgencyInvite_agencyId_idx" ON "AgencyInvite"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyInvite_email_idx" ON "AgencyInvite"("email");

-- CreateIndex
CREATE INDEX "AgencyOversightRequest_householdId_idx" ON "AgencyOversightRequest"("householdId");

-- CreateIndex
CREATE INDEX "AgencyOversightRequest_agencyId_idx" ON "AgencyOversightRequest"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyOversightRequest_agencyId_householdId_key" ON "AgencyOversightRequest"("agencyId", "householdId");

-- AddForeignKey
ALTER TABLE "AgencyInvite" ADD CONSTRAINT "AgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyOversightRequest" ADD CONSTRAINT "AgencyOversightRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyOversightRequest" ADD CONSTRAINT "AgencyOversightRequest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
