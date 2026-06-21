-- CreateEnum
CREATE TYPE "PlacementResponse" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FosterStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('SCHEDULED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'MET', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourtHearingType" AS ENUM ('PRELIMINARY', 'ADJUDICATION', 'DISPOSITION', 'REVIEW', 'PERMANENCY', 'TERMINATION', 'ADOPTION', 'STATUS_CONFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "EducationRecordType" AS ENUM ('ENROLLMENT', 'IEP', 'MEETING', 'GRADE_REPORT', 'ATTENDANCE', 'CONCERN', 'ACHIEVEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('AGENCY_ADMIN', 'CASE_WORKER', 'AGENCY_VIEWER');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "agencyId" TEXT,
ADD COLUMN     "fosterStatus" "FosterStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "parentResponse" "PlacementResponse" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "respondedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "compNote" TEXT,
ADD COLUMN     "comped" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrainingHour" ADD COLUMN     "category" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyMember" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL DEFAULT 'CASE_WORKER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "agencyId" TEXT,
    "visitType" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'COMPLETED',
    "summary" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "agencyId" TEXT,
    "reportedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'LOW',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "agencyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'OPEN',
    "targetDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "agencyId" TEXT,
    "senderId" TEXT,
    "fromAgency" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "trigger" TEXT,
    "emotion" TEXT,
    "coping" TEXT,
    "intervention" TEXT,
    "strength" TEXT,
    "notes" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "size" TEXT,
    "quantity" INTEGER,
    "needed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "contactId" TEXT,
    "logDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "summary" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtHearing" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT,
    "type" "CourtHearingType" NOT NULL DEFAULT 'OTHER',
    "hearingDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "judge" TEXT,
    "attorney" TEXT,
    "outcome" TEXT,
    "nextHearingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtHearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationRecord" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "EducationRecordType" NOT NULL DEFAULT 'OTHER',
    "recordDate" TIMESTAMP(3) NOT NULL,
    "school" TEXT,
    "grade" TEXT,
    "hasIep" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Immunization" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "vaccine" TEXT NOT NULL,
    "dateGiven" TIMESTAMP(3) NOT NULL,
    "nextDoseDate" TIMESTAMP(3),
    "provider" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Immunization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "AgencyMember_userId_idx" ON "AgencyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyMember_agencyId_userId_key" ON "AgencyMember"("agencyId", "userId");

-- CreateIndex
CREATE INDEX "Visit_householdId_visitDate_idx" ON "Visit"("householdId", "visitDate");

-- CreateIndex
CREATE INDEX "Incident_householdId_createdAt_idx" ON "Incident"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_agencyId_status_idx" ON "Incident"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Announcement_agencyId_createdAt_idx" ON "Announcement"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "Goal_householdId_status_idx" ON "Goal"("householdId", "status");

-- CreateIndex
CREATE INDEX "Message_householdId_createdAt_idx" ON "Message"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "BehaviorLog_householdId_logDate_idx" ON "BehaviorLog"("householdId", "logDate");

-- CreateIndex
CREATE INDEX "BehaviorLog_childId_logDate_idx" ON "BehaviorLog"("childId", "logDate");

-- CreateIndex
CREATE INDEX "InventoryItem_householdId_idx" ON "InventoryItem"("householdId");

-- CreateIndex
CREATE INDEX "CommunicationLog_householdId_logDate_idx" ON "CommunicationLog"("householdId", "logDate");

-- CreateIndex
CREATE INDEX "JournalEntry_householdId_entryDate_idx" ON "JournalEntry"("householdId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_childId_entryDate_idx" ON "JournalEntry"("childId", "entryDate");

-- CreateIndex
CREATE INDEX "CourtHearing_householdId_hearingDate_idx" ON "CourtHearing"("householdId", "hearingDate");

-- CreateIndex
CREATE INDEX "CourtHearing_childId_idx" ON "CourtHearing"("childId");

-- CreateIndex
CREATE INDEX "EducationRecord_householdId_recordDate_idx" ON "EducationRecord"("householdId", "recordDate");

-- CreateIndex
CREATE INDEX "EducationRecord_childId_idx" ON "EducationRecord"("childId");

-- CreateIndex
CREATE INDEX "Immunization_householdId_idx" ON "Immunization"("householdId");

-- CreateIndex
CREATE INDEX "Immunization_childId_idx" ON "Immunization"("childId");

-- CreateIndex
CREATE INDEX "Household_agencyId_idx" ON "Household"("agencyId");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMember" ADD CONSTRAINT "AgencyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorLog" ADD CONSTRAINT "BehaviorLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtHearing" ADD CONSTRAINT "CourtHearing_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtHearing" ADD CONSTRAINT "CourtHearing_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationRecord" ADD CONSTRAINT "EducationRecord_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationRecord" ADD CONSTRAINT "EducationRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Immunization" ADD CONSTRAINT "Immunization_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
