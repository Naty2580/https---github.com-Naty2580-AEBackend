/*
  Warnings:

  - The values [STUDENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `defaultDormBlock` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `idCardUrl` on the `DelivererProfile` table. All the data in the column will be lost.
  - You are about to drop the column `payoutAmount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `payoutRef` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `PayoutLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[reference]` on the table `LedgerEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[otpCode]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `Restaurant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CUSTOMER', 'DELIVERER', 'VENDOR_STAFF', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_orderId_fkey";

-- DropIndex
DROP INDEX "Order_payoutRef_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "CustomerProfile" DROP COLUMN "defaultDormBlock",
ADD COLUMN     "bookmarkMeals" TEXT[],
ADD COLUMN     "bookmarkRestaurants" TEXT[],
ADD COLUMN     "defaultLocation" TEXT,
ADD COLUMN     "prefferedPaymentMethod" TEXT,
ADD COLUMN     "totalOrders" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DelivererProfile" DROP COLUMN "idCardUrl",
ADD COLUMN     "currentLocation" TEXT,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "evidence" TEXT;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "payoutAmount",
DROP COLUMN "payoutRef",
ADD COLUMN     "estimatedDeliveryTime" TIMESTAMP(3),
ADD COLUMN     "otpVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "operatingHours" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
ADD COLUMN     "deviceToken" TEXT,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

-- DropTable
DROP TABLE "PayoutLog";

-- DropTable
DROP TABLE "Review";

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "transactionId" TEXT,
    "provider" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "apiResponse" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "tip" DECIMAL(10,2) NOT NULL,
    "refundReason" TEXT,
    "webhookReceivedAt" TIMESTAMP(3),
    "payoutAmount" DECIMAL(10,2) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raterId" UUID NOT NULL,
    "rateeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_type_idx" ON "VerificationToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_orderId_key" ON "Rating"("orderId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "Category_restaurantId_idx" ON "Category"("restaurantId");

-- CreateIndex
CREATE INDEX "CustomerProfile_defaultLocation_idx" ON "CustomerProfile"("defaultLocation");

-- CreateIndex
CREATE INDEX "CustomerProfile_rating_idx" ON "CustomerProfile"("rating");

-- CreateIndex
CREATE INDEX "CustomerProfile_totalOrders_idx" ON "CustomerProfile"("totalOrders");

-- CreateIndex
CREATE INDEX "DelivererProfile_isVerified_idx" ON "DelivererProfile"("isVerified");

-- CreateIndex
CREATE INDEX "DelivererProfile_userId_isOnline_idx" ON "DelivererProfile"("userId", "isOnline");

-- CreateIndex
CREATE INDEX "DelivererProfile_rating_idx" ON "DelivererProfile"("rating");

-- CreateIndex
CREATE INDEX "DelivererProfile_isAvailable_idx" ON "DelivererProfile"("isAvailable");

-- CreateIndex
CREATE INDEX "DelivererProfile_totalDeliveries_idx" ON "DelivererProfile"("totalDeliveries");

-- CreateIndex
CREATE INDEX "DelivererProfile_totalEarnings_idx" ON "DelivererProfile"("totalEarnings");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reference_key" ON "LedgerEntry"("reference");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_price_idx" ON "MenuItem"("price");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_prepTimeMins_idx" ON "MenuItem"("prepTimeMins");

-- CreateIndex
CREATE UNIQUE INDEX "Order_otpCode_key" ON "Order"("otpCode");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_changedById_idx" ON "OrderStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "VendorProfile_restaurantId_idx" ON "VendorProfile"("restaurantId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
