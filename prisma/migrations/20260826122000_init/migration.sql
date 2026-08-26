-- CreateTable
CREATE TABLE "Currency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CurrencySource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "denomination" TEXT NOT NULL DEFAULT 'NEW_SYP',
    "normalizationFactor" REAL NOT NULL DEFAULT 1,
    "lastSuccessAt" DATETIME,
    "lastFailureAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CollectionRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RateObservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currencyId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "collectionRunId" INTEGER,
    "buy" REAL NOT NULL,
    "sell" REAL NOT NULL,
    "mid" REAL NOT NULL,
    "sourceDenomination" TEXT NOT NULL,
    "sourceUpdatedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT NOT NULL,
    "rawContentHash" TEXT NOT NULL,
    "relevantExcerpt" TEXT,
    "extractionJson" TEXT,
    "aiConfidence" REAL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateObservation_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RateObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CurrencySource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RateObservation_collectionRunId_fkey" FOREIGN KEY ("collectionRunId") REFERENCES "CollectionRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RateCalculation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currencyId" INTEGER NOT NULL,
    "collectionRunId" INTEGER NOT NULL,
    "medianBuy" REAL NOT NULL,
    "medianSell" REAL NOT NULL,
    "acceptedObservations" INTEGER NOT NULL,
    "rejectedOutliers" INTEGER NOT NULL,
    "confidence" REAL NOT NULL,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateCalculation_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RateCalculation_collectionRunId_fkey" FOREIGN KEY ("collectionRunId") REFERENCES "CollectionRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PublishedRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currencyId" INTEGER NOT NULL,
    "buy" REAL NOT NULL,
    "sell" REAL NOT NULL,
    "mid" REAL NOT NULL,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FRESH',
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublishedRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");
CREATE UNIQUE INDEX "CurrencySource_slug_key" ON "CurrencySource"("slug");
CREATE INDEX "CurrencySource_enabled_priority_idx" ON "CurrencySource"("enabled", "priority");
CREATE INDEX "RateObservation_currencyId_fetchedAt_idx" ON "RateObservation"("currencyId", "fetchedAt");
CREATE INDEX "RateObservation_sourceId_fetchedAt_idx" ON "RateObservation"("sourceId", "fetchedAt");
CREATE INDEX "RateObservation_collectionRunId_currencyId_idx" ON "RateObservation"("collectionRunId", "currencyId");
CREATE INDEX "RateCalculation_currencyId_calculatedAt_idx" ON "RateCalculation"("currencyId", "calculatedAt");
CREATE UNIQUE INDEX "PublishedRate_currencyId_key" ON "PublishedRate"("currencyId");
