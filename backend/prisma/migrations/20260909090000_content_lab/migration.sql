CREATE TABLE "ContentReference" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "customerId" INTEGER NOT NULL,
  "platform" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceTitle" TEXT NOT NULL,
  "sourceImageUrl" TEXT,
  "originalImageUrl" TEXT,
  "views" INTEGER,
  "reactions" INTEGER,
  "comments" INTEGER,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ContentReference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ContentDraft" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "customerId" INTEGER NOT NULL,
  "referenceIds" TEXT NOT NULL DEFAULT '[]',
  "sheetRow" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ContentDraft_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ContentReference_customerId_idx" ON "ContentReference"("customerId");
CREATE INDEX "ContentReference_platform_idx" ON "ContentReference"("platform");
CREATE INDEX "ContentDraft_customerId_idx" ON "ContentDraft"("customerId");
