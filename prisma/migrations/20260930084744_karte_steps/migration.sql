-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "assignedOn" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "checkedOn" DATE,
    "note" TEXT,
    "createdById" TEXT,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyTheme" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "theme" TEXT,
    "trainingTheme" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPhase" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnsMeasurement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "measuredOn" DATE NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnsMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Homework_clientId_status_idx" ON "Homework"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyTheme_clientId_month_key" ON "MonthlyTheme"("clientId", "month");

-- CreateIndex
CREATE INDEX "ClientPhase_clientId_startDate_idx" ON "ClientPhase"("clientId", "startDate");

-- CreateIndex
CREATE INDEX "AnsMeasurement_clientId_measuredOn_idx" ON "AnsMeasurement"("clientId", "measuredOn");

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyTheme" ADD CONSTRAINT "MonthlyTheme_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPhase" ADD CONSTRAINT "ClientPhase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnsMeasurement" ADD CONSTRAINT "AnsMeasurement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
