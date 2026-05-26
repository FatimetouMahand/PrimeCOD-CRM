-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "distributionType" TEXT NOT NULL DEFAULT 'random',
ALTER COLUMN "price" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProductAgent" (
    "productId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,

    CONSTRAINT "ProductAgent_pkey" PRIMARY KEY ("productId","agentId")
);

-- AddForeignKey
ALTER TABLE "ProductAgent" ADD CONSTRAINT "ProductAgent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAgent" ADD CONSTRAINT "ProductAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
