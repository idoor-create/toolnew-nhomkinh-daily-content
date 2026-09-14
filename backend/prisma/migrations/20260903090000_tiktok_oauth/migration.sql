ALTER TABLE "Customer" ADD COLUMN "tiktokOpenId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tiktokAvatarUrl" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tiktokAccessToken" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tiktokRefreshToken" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tiktokAccessTokenExpiresAt" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "tiktokRefreshTokenExpiresAt" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "tiktokReconnectRequired" BOOLEAN NOT NULL DEFAULT false;
