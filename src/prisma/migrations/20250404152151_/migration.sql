-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "installationNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyBill" (
    "id" SERIAL NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "consumptionKwh" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "barcode" TEXT NOT NULL,
    "billNumber" TEXT,
    "previousReading" TEXT,
    "currentReading" TEXT,
    "readingDate" TIMESTAMP(3),
    "energyTax" DOUBLE PRECISION,
    "processingStatus" TEXT NOT NULL DEFAULT 'PROCESSED',
    "processingErrors" TEXT,

    CONSTRAINT "EnergyBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientNumber_key" ON "Client"("clientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Client_installationNumber_key" ON "Client"("installationNumber");

-- CreateIndex
CREATE INDEX "Client_clientNumber_idx" ON "Client"("clientNumber");

-- CreateIndex
CREATE INDEX "Client_installationNumber_idx" ON "Client"("installationNumber");

-- CreateIndex
CREATE INDEX "EnergyBill_clientNumber_idx" ON "EnergyBill"("clientNumber");

-- CreateIndex
CREATE INDEX "EnergyBill_referenceMonth_idx" ON "EnergyBill"("referenceMonth");

-- CreateIndex
CREATE INDEX "EnergyBill_dueDate_idx" ON "EnergyBill"("dueDate");

-- AddForeignKey
ALTER TABLE "EnergyBill" ADD CONSTRAINT "EnergyBill_clientNumber_fkey" FOREIGN KEY ("clientNumber") REFERENCES "Client"("clientNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
