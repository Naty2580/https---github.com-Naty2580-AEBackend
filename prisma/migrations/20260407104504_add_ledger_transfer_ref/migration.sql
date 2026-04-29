/*
  Warnings:

  - A unique constraint covering the columns `[transferRef]` on the table `LedgerEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "transferRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_transferRef_key" ON "LedgerEntry"("transferRef");
