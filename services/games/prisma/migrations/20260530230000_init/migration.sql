-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('BETTING', 'RUNNING', 'CRASHED', 'SETTLED');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('ACCEPTED', 'REJECTED', 'CASHOUT_PENDING_CREDIT', 'CASHED_OUT', 'LOST');

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "status" "RoundStatus" NOT NULL,
    "bettingStartsAt" TIMESTAMP(3) NOT NULL,
    "bettingEndsAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "crashedAt" TIMESTAMP(3),
    "crashPointBp" INTEGER NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "serverSeed" TEXT,
    "clientSeed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "chainIndex" INTEGER NOT NULL,
    "nextServerSeedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "status" "BetStatus" NOT NULL,
    "cashoutMultiplierBp" INTEGER,
    "payoutCents" BIGINT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rounds_status_createdAt_idx" ON "rounds"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_chainIndex_key" ON "rounds"("chainIndex");

-- CreateIndex
CREATE INDEX "bets_playerId_createdAt_idx" ON "bets"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "bets_roundId_status_idx" ON "bets"("roundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bets_roundId_playerId_key" ON "bets"("roundId", "playerId");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
