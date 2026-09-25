-- CreateTable
CREATE TABLE "SessionDrawing" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionDrawing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionDrawing_sessionId_key" ON "SessionDrawing"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionDrawing" ADD CONSTRAINT "SessionDrawing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
