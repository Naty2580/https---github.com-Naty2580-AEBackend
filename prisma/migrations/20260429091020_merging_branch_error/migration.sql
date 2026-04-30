-- AlterTable
ALTER TABLE "DelivererProfile" ADD COLUMN     "lastPingAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "DelivererProfile_lat_lng_idx" ON "DelivererProfile"("lat", "lng");
