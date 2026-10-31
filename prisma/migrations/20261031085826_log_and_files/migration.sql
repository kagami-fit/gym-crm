-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "theme" TEXT;

-- AlterTable
ALTER TABLE "TrainingSet" ADD COLUMN     "detail" JSONB,
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "rating" TEXT,
ADD COLUMN     "springs" TEXT;

-- CreateTable
CREATE TABLE "ClientFile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "title" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientFile_clientId_date_idx" ON "ClientFile"("clientId", "date");

-- CreateIndex
CREATE INDEX "ClientFile_sessionId_idx" ON "ClientFile"("sessionId");

-- AddForeignKey
ALTER TABLE "ClientFile" ADD CONSTRAINT "ClientFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientFile" ADD CONSTRAINT "ClientFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
