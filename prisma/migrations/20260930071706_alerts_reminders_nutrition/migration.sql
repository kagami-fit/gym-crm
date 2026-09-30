-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'date',
    "dueDate" DATE NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'open',
    "snoozeUntil" DATE,
    "doneAt" TIMESTAMP(3),
    "doneNote" TEXT,
    "doneById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "until" DATE,
    "note" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionWeek" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetKcal" DOUBLE PRECISION,
    "avgKcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_clientId_status_idx" ON "Reminder"("clientId", "status");

-- CreateIndex
CREATE INDEX "AlertAction_clientId_rule_idx" ON "AlertAction"("clientId", "rule");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionWeek_clientId_weekStart_key" ON "NutritionWeek"("clientId", "weekStart");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAction" ADD CONSTRAINT "AlertAction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAction" ADD CONSTRAINT "AlertAction_byId_fkey" FOREIGN KEY ("byId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionWeek" ADD CONSTRAINT "NutritionWeek_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
