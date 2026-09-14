ALTER TABLE "Customer" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "facebookPageName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tiktokProfileName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "facebookConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN "tiktokConnected" BOOLEAN NOT NULL DEFAULT false;
