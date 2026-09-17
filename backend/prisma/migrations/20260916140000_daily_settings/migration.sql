CREATE TABLE "DailyContentSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "rowCount" INTEGER NOT NULL DEFAULT 3,
  "businessContext" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyContentSettings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DailyContentRun" (
  "id" SERIAL NOT NULL,
  "day" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyContentRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyContentRun_day_rowIndex_key" ON "DailyContentRun"("day", "rowIndex");
