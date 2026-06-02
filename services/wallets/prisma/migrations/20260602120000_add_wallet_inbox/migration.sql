-- CreateEnum
CREATE TYPE "WalletInboxStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "wallet_inbox_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reason" "WalletTransactionReason" NOT NULL,
    "status" "WalletInboxStatus" NOT NULL,
    "responseOk" BOOLEAN,
    "responseApplied" BOOLEAN,
    "responseBalanceCents" BIGINT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_inbox_messages_messageId_key" ON "wallet_inbox_messages"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_inbox_messages_referenceId_key" ON "wallet_inbox_messages"("referenceId");

-- CreateIndex
CREATE INDEX "wallet_inbox_messages_status_receivedAt_idx" ON "wallet_inbox_messages"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "wallet_inbox_messages_playerId_receivedAt_idx" ON "wallet_inbox_messages"("playerId", "receivedAt");
