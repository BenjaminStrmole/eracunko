-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "bizboxUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vatNumber" TEXT,
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "eLocation" TEXT,
    "eAddress" TEXT,
    "address" TEXT,
    "postCode" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'SI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompany" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNumber" TEXT,
    "profile" TEXT,
    "buyerName" TEXT,
    "buyerVat" TEXT,
    "grossAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSentInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentNumber" TEXT,
    "bizboxDocumentId" TEXT,
    "profile" TEXT,
    "buyerName" TEXT,
    "buyerVat" TEXT,
    "grossAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT,
    "sentAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- CreateIndex
CREATE INDEX "Company_vatNumber_idx" ON "Company"("vatNumber");

-- CreateIndex
CREATE INDEX "Company_taxId_idx" ON "Company"("taxId");

-- CreateIndex
CREATE INDEX "Company_createdAt_idx" ON "Company"("createdAt");

-- CreateIndex
CREATE INDEX "Company_updatedAt_idx" ON "Company"("updatedAt");

-- CreateIndex
CREATE INDEX "UserCompany_userId_idx" ON "UserCompany"("userId");

-- CreateIndex
CREATE INDEX "UserCompany_companyId_idx" ON "UserCompany"("companyId");

-- CreateIndex
CREATE INDEX "UserCompany_createdAt_idx" ON "UserCompany"("createdAt");

-- CreateIndex
CREATE INDEX "UserCompany_updatedAt_idx" ON "UserCompany"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompany_userId_companyId_key" ON "UserCompany"("userId", "companyId");

-- CreateIndex
CREATE INDEX "InvoiceDraft_userId_idx" ON "InvoiceDraft"("userId");

-- CreateIndex
CREATE INDEX "InvoiceDraft_companyId_idx" ON "InvoiceDraft"("companyId");

-- CreateIndex
CREATE INDEX "InvoiceDraft_documentNumber_idx" ON "InvoiceDraft"("documentNumber");

-- CreateIndex
CREATE INDEX "InvoiceDraft_createdAt_idx" ON "InvoiceDraft"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceDraft_updatedAt_idx" ON "InvoiceDraft"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_createdAt_idx" ON "UserSettings"("createdAt");

-- CreateIndex
CREATE INDEX "UserSettings_updatedAt_idx" ON "UserSettings"("updatedAt");

-- CreateIndex
CREATE INDEX "LocalSentInvoice_userId_idx" ON "LocalSentInvoice"("userId");

-- CreateIndex
CREATE INDEX "LocalSentInvoice_companyId_idx" ON "LocalSentInvoice"("companyId");

-- CreateIndex
CREATE INDEX "LocalSentInvoice_documentNumber_idx" ON "LocalSentInvoice"("documentNumber");

-- CreateIndex
CREATE INDEX "LocalSentInvoice_createdAt_idx" ON "LocalSentInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "LocalSentInvoice_updatedAt_idx" ON "LocalSentInvoice"("updatedAt");

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompany" ADD CONSTRAINT "UserCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDraft" ADD CONSTRAINT "InvoiceDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDraft" ADD CONSTRAINT "InvoiceDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSentInvoice" ADD CONSTRAINT "LocalSentInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSentInvoice" ADD CONSTRAINT "LocalSentInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
