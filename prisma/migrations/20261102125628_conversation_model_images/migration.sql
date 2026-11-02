-- 되돌리기: down 이 없다. Job.imageUrl 을 지우므로 이 마이그레이션은 데이터 기준으로 되돌릴 수 없다.
-- 되돌려야 하면 이전 스키마로 새 마이그레이션을 만든다. NOT NULL 컬럼(model·batchId 등)을 기본값 없이 더하므로 Conversation·Job 이 빈 DB 에만 적용한다.
/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Job` table. All the data in the column will be lost.
  - Added the required column `model` to the `Conversation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `batchId` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seed` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `steps` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "conversationId" TEXT,
    "jobId" TEXT,
    "model" TEXT,
    "prompt" TEXT,
    "seed" INTEGER,
    "steps" INTEGER,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "hasAlpha" BOOLEAN NOT NULL DEFAULT false,
    "bytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "model" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("createdAt", "id", "title", "updatedAt", "userId") SELECT "createdAt", "id", "title", "updatedAt", "userId" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERATE',
    "batchId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "seed" INTEGER NOT NULL,
    "steps" INTEGER NOT NULL,
    "transparent" BOOLEAN NOT NULL DEFAULT false,
    "inputImageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "step" INTEGER NOT NULL DEFAULT 0,
    "queuePosition" INTEGER,
    "error" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Job_inputImageId_fkey" FOREIGN KEY ("inputImageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("conversationId", "createdAt", "error", "id", "model", "prompt", "status", "updatedAt") SELECT "conversationId", "createdAt", "error", "id", "model", "prompt", "status", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_conversationId_createdAt_idx" ON "Job"("conversationId", "createdAt");
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_inputImageId_idx" ON "Job"("inputImageId");
CREATE INDEX "Job_conversationId_batchId_idx" ON "Job"("conversationId", "batchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Image_jobId_key" ON "Image"("jobId");

-- CreateIndex
CREATE INDEX "Image_kind_createdAt_idx" ON "Image"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Image_model_createdAt_idx" ON "Image"("model", "createdAt");

-- CreateIndex
CREATE INDEX "Image_conversationId_idx" ON "Image"("conversationId");

-- CreateIndex
CREATE INDEX "Image_parentId_idx" ON "Image"("parentId");
