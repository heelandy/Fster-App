-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "childId" TEXT;

-- CreateIndex
CREATE INDEX "Routine_childId_idx" ON "Routine"("childId");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_childId_fkey" FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
