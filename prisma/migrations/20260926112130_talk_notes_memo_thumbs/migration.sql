-- AlterTable
ALTER TABLE "SessionDrawing" ADD COLUMN     "thumb" JSONB;

-- CreateTable
CREATE TABLE "TalkNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'talk',
    "text" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalkNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TalkNote_clientId_date_idx" ON "TalkNote"("clientId", "date");

-- AddForeignKey
ALTER TABLE "TalkNote" ADD CONSTRAINT "TalkNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalkNote" ADD CONSTRAINT "TalkNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
