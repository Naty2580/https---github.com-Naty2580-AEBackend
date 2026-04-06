-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'DELIVERER', 'VENDOR_STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "ActiveMode" AS ENUM ('CUSTOMER', 'DELIVERER');

-- CreateEnum
CREATE TYPE "VendorMode" AS ENUM ('VENDOR_MANAGED', 'ADMIN_MANAGED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'AWAITING_ACCEPT', 'ASSIGNED', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'VENDOR_BEING_PREPARED', 'VENDOR_FINISHED', 'VENDOR_READY_FOR_PICKUP', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'RECEIVED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'NO_DELIVERER_FOUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('ESCROW_RESERVE', 'REIMBURSEMENT_PAYMENT', 'PLATFORM_REVENUE', 'REFUND', 'DISPUTE_HOLD');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DispatchAction" AS ENUM ('BROADCAST', 'ACCEPTED', 'DECLINED', 'IGNORED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "telegramId" BIGINT NOT NULL,
    "astuEmail" TEXT,
    "email" TEXT,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "activeMode" "ActiveMode" NOT NULL DEFAULT 'CUSTOMER',
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceToken" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "UserAuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "targetUserId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "defaultLocation" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "prefferedPaymentMethod" TEXT,
    "bookmarkRestaurants" TEXT[],
    "bookmarkMeals" TEXT[],

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelivererProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "currentLocation" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "payoutAccount" TEXT,
    "payoutProvider" TEXT,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "DelivererProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mode" "VendorMode" NOT NULL DEFAULT 'VENDOR_MANAGED',
    "location" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openingTime" TEXT,
    "closingTime" TEXT,
    "imageUrl" TEXT,
    "minOrderValue" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "avgRating" DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "restaurantId" UUID,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "businessDocumentUrl" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "VendorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "prepTimeMins" INTEGER NOT NULL DEFAULT 15,
    "isFasting" BOOLEAN NOT NULL DEFAULT false,
    "availabilityReason" TEXT,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shortId" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "delivererId" UUID,
    "restaurantId" UUID NOT NULL,
    "estimatedDeliveryTime" TIMESTAMP(3),
    "foodPrice" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "transactionFee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "tip" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "otpCode" TEXT NOT NULL,
    "otpVerifiedAt" TIMESTAMP(3),
    "chapaRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "oldStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "changedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "userId" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "raisedById" UUID NOT NULL,
    "assignedAdminId" UUID,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "delivererId" UUID NOT NULL,
    "action" "DispatchAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchLog_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_astuEmail_key" ON "User"("astuEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_astuEmail_idx" ON "User"("astuEmail");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

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
CREATE INDEX "UserAuditLog_targetUserId_idx" ON "UserAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "UserAuditLog_actorId_idx" ON "UserAuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE INDEX "CustomerProfile_defaultLocation_idx" ON "CustomerProfile"("defaultLocation");

-- CreateIndex
CREATE INDEX "CustomerProfile_rating_idx" ON "CustomerProfile"("rating");

-- CreateIndex
CREATE INDEX "CustomerProfile_totalOrders_idx" ON "CustomerProfile"("totalOrders");

-- CreateIndex
CREATE UNIQUE INDEX "DelivererProfile_userId_key" ON "DelivererProfile"("userId");

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
CREATE UNIQUE INDEX "Restaurant_phone_key" ON "Restaurant"("phone");

-- CreateIndex
CREATE INDEX "Restaurant_lat_lng_idx" ON "Restaurant"("lat", "lng");

-- CreateIndex
CREATE INDEX "Restaurant_isOpen_isActive_idx" ON "Restaurant"("isOpen", "isActive");

-- CreateIndex
CREATE INDEX "Restaurant_tags_idx" ON "Restaurant" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "VendorProfile_userId_key" ON "VendorProfile"("userId");

-- CreateIndex
CREATE INDEX "VendorProfile_restaurantId_idx" ON "VendorProfile"("restaurantId");

-- CreateIndex
CREATE INDEX "Category_restaurantId_idx" ON "Category"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_price_idx" ON "MenuItem"("price");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_prepTimeMins_idx" ON "MenuItem"("prepTimeMins");

-- CreateIndex
CREATE UNIQUE INDEX "Order_shortId_key" ON "Order"("shortId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_otpCode_key" ON "Order"("otpCode");

-- CreateIndex
CREATE UNIQUE INDEX "Order_chapaRef_key" ON "Order"("chapaRef");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_delivererId_idx" ON "Order"("delivererId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_changedById_idx" ON "OrderStatusHistory"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_orderId_key" ON "Rating"("orderId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reference_key" ON "LedgerEntry"("reference");

-- CreateIndex
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_status_idx" ON "LedgerEntry"("type", "status");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "DispatchLog_orderId_idx" ON "DispatchLog"("orderId");

-- CreateIndex
CREATE INDEX "DispatchLog_delivererId_idx" ON "DispatchLog"("delivererId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelivererProfile" ADD CONSTRAINT "DelivererProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "DelivererProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLog" ADD CONSTRAINT "DispatchLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchLog" ADD CONSTRAINT "DispatchLog_delivererId_fkey" FOREIGN KEY ("delivererId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
