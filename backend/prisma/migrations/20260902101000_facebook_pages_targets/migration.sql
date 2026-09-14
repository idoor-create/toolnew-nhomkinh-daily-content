CREATE TABLE "FacebookPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FacebookPage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FacebookPage_customerId_pageId_key" ON "FacebookPage"("customerId", "pageId");
CREATE INDEX "FacebookPage_customerId_idx" ON "FacebookPage"("customerId");
CREATE INDEX "FacebookPage_pageId_idx" ON "FacebookPage"("pageId");

ALTER TABLE "Post" ADD COLUMN "facebookPageIds" TEXT NOT NULL DEFAULT '[]';
