-- AlterTable
ALTER TABLE "AnsMeasurement" ADD COLUMN     "ansType" TEXT,
ADD COLUMN     "parasympathetic" DOUBLE PRECISION,
ADD COLUMN     "parasympatheticLevel" TEXT,
ADD COLUMN     "sympathetic" DOUBLE PRECISION,
ADD COLUMN     "sympatheticLevel" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ClientPhase" ADD COLUMN     "reviewDate" DATE,
ADD COLUMN     "visitFrequency" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "policy" TEXT NOT NULL DEFAULT 'loss',
ADD COLUMN     "policyName" TEXT,
ADD COLUMN     "reviewDate" DATE,
ADD COLUMN     "targetDate" DATE,
ALTER COLUMN "targetWeightKg" DROP NOT NULL,
ALTER COLUMN "paceKey" DROP NOT NULL,
ALTER COLUMN "activityFactor" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MovementCheck" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "movement" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checks" JSONB,
    "condition" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionCheck" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "painArea" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightReview" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovementCheck_clientId_movement_date_idx" ON "MovementCheck"("clientId", "movement", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionCheck_clientId_date_key" ON "ConditionCheck"("clientId", "date");

-- CreateIndex
CREATE INDEX "WeightReview_clientId_date_idx" ON "WeightReview"("clientId", "date");

-- AddForeignKey
ALTER TABLE "MovementCheck" ADD CONSTRAINT "MovementCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionCheck" ADD CONSTRAINT "ConditionCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightReview" ADD CONSTRAINT "WeightReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
