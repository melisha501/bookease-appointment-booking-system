-- CreateEnum
CREATE TYPE "ScheduleExceptionType" AS ENUM ('holiday', 'unavailable');

-- CreateTable
CREATE TABLE "SpecialistDateException" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" "ScheduleExceptionType" NOT NULL DEFAULT 'unavailable',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistDateException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecialistDateException_specialistId_date_idx" ON "SpecialistDateException"("specialistId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistDateException_specialistId_date_key" ON "SpecialistDateException"("specialistId", "date");

-- AddForeignKey
ALTER TABLE "SpecialistDateException" ADD CONSTRAINT "SpecialistDateException_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
