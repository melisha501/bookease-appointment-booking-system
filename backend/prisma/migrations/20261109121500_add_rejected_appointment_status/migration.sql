-- Add REJECTED as a separate appointment status.
-- Previously rejected requests were stored as cancelled; this keeps the two
-- states distinct in PostgreSQL and in the Prisma client enum.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'rejected';
