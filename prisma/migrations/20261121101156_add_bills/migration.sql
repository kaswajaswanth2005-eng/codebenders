-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultAmountPaise" INTEGER NOT NULL,
    "firstDueDate" TEXT NOT NULL,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "notes" TEXT,
    "archivedOn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BillOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paidDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillOccurrence_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bill_firstDueDate_idx" ON "Bill"("firstDueDate");

-- CreateIndex
CREATE INDEX "BillOccurrence_paidDate_idx" ON "BillOccurrence"("paidDate");

-- CreateIndex
CREATE UNIQUE INDEX "BillOccurrence_billId_dueDate_key" ON "BillOccurrence"("billId", "dueDate");
