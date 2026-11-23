-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAnalysis" (
    "id" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageFormat" TEXT NOT NULL,
    "deviceMake" TEXT,
    "deviceModel" TEXT,
    "captureDate" TEXT,
    "hasGps" BOOLEAN NOT NULL DEFAULT false,
    "encryptedPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "imageAnalysisId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisHistory_imageAnalysisId_key" ON "AnalysisHistory"("imageAnalysisId");

-- CreateIndex
CREATE INDEX "AnalysisHistory_userId_createdAt_idx" ON "AnalysisHistory"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AnalysisHistory" ADD CONSTRAINT "AnalysisHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisHistory" ADD CONSTRAINT "AnalysisHistory_imageAnalysisId_fkey" FOREIGN KEY ("imageAnalysisId") REFERENCES "ImageAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

