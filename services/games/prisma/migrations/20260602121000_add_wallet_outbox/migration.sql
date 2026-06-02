-- CreateEnum
CREATE TYPE "WalletOutboxStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'RETRYABLE');

-- CreateEnum
CREATE TYPE "WalletOutboxType" AS ENUM ('WALLET_DEBIT', 'WALLET_CREDIT');

-- CreateTable
CREATE TABLE "wallet_outbox_messages" (
    "id" TEXT NOT NULL,
    "type" "WalletOutboxType" NOT NULL,
    "status" "WalletOutboxStatus" NOT NULL,
    "roundId" TEXT NOT NULL,
    "betId" TEXT,
    "playerId" TEXT NOT NULL,
    "username" TEXT,
    "amountCents" BIGINT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "responseApplied" BOOLEAN,
    "responseBalanceCents" BIGINT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_outbox_messages_referenceId_key" ON "wallet_outbox_messages"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_outbox_messages_status_availableAt_idx" ON "wallet_outbox_messages"("status", "availableAt");

-- CreateIndex
CREATE INDEX "wallet_outbox_messages_roundId_idx" ON "wallet_outbox_messages"("roundId");

-- CreateIndex
CREATE INDEX "wallet_outbox_messages_playerId_createdAt_idx" ON "wallet_outbox_messages"("playerId", "createdAt");
