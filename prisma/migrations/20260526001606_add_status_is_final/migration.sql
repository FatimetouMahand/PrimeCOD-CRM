-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Status" ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false;
