-- AlterTable: Order — add notes, attempts, updatedAt (default NOW() for existing rows)
ALTER TABLE "Order"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- AlterTable: Status — add isActive + alertAfterHours
ALTER TABLE "Status"
  ADD COLUMN "alertAfterHours" INTEGER,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: User — add startDate
ALTER TABLE "User"
  ADD COLUMN "startDate" TIMESTAMP(3);
