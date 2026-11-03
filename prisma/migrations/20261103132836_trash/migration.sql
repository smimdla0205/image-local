-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Image" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Conversation_deletedAt_idx" ON "Conversation"("deletedAt");

-- CreateIndex
CREATE INDEX "Image_deletedAt_idx" ON "Image"("deletedAt");
