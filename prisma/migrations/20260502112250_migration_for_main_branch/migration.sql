/*
  Warnings:

  - A unique constraint covering the columns `[transferRef]` on the table `LedgerEntry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `payoutAmount` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "transferRef" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "payoutAmount" DECIMAL(10,2) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_transferRef_key" ON "LedgerEntry"("transferRef");
