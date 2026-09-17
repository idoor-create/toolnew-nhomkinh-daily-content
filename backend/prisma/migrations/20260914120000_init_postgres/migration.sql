-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "facebookPageId" TEXT,
    "facebookPageName" TEXT,
    "facebookToken" TEXT,
    "ayrshareProfileKey" TEXT,
    "tiktokOpenId" TEXT,
    "tiktokProfileName" TEXT,
    "tiktokAvatarUrl" TEXT,
    "tiktokAccessToken" TEXT,
    "tiktokRefreshToken" TEXT,
    "tiktokAccessTokenExpiresAt" TIMESTAMP(3),
    "tiktokRefreshTokenExpiresAt" TIMESTAMP(3),
    "facebookConnected" BOOLEAN NOT NULL DEFAULT false,
    "tiktokConnected" BOOLEAN NOT NULL DEFAULT false,
    "tiktokReconnectRequired" BOOLEAN NOT NULL DEFAULT false,
    "facebookReconnectRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReference" (
    "id" SERIAL NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "referenceIds" TEXT NOT NULL DEFAULT '[]',
    "sheetRow" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookPage" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "pageAccessToken" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "platforms" TEXT NOT NULL,
    "facebookPageIds" TEXT NOT NULL DEFAULT '[]',
    "mediaUrls" TEXT NOT NULL,
    "hashtags" TEXT,
    "scheduledTime" TIMESTAMP(3),
    "publishedTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLog" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ContentReference_customerId_idx" ON "ContentReference"("customerId");

-- CreateIndex
CREATE INDEX "ContentReference_platform_idx" ON "ContentReference"("platform");

-- CreateIndex
CREATE INDEX "ContentDraft_customerId_idx" ON "ContentDraft"("customerId");

-- CreateIndex
CREATE INDEX "FacebookPage_customerId_idx" ON "FacebookPage"("customerId");

-- CreateIndex
CREATE INDEX "FacebookPage_pageId_idx" ON "FacebookPage"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookPage_customerId_pageId_key" ON "FacebookPage"("customerId", "pageId");

-- CreateIndex
CREATE INDEX "Post_customerId_idx" ON "Post"("customerId");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Post_scheduledTime_idx" ON "Post"("scheduledTime");

-- CreateIndex
CREATE INDEX "PostLog_postId_idx" ON "PostLog"("postId");

-- CreateIndex
CREATE INDEX "PostLog_platform_idx" ON "PostLog"("platform");

-- CreateIndex
CREATE INDEX "PostLog_status_idx" ON "PostLog"("status");

-- AddForeignKey
ALTER TABLE "ContentReference" ADD CONSTRAINT "ContentReference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookPage" ADD CONSTRAINT "FacebookPage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLog" ADD CONSTRAINT "PostLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

