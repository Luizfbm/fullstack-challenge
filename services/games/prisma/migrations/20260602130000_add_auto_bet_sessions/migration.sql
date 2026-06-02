CREATE TABLE "auto_bet_sessions" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountCents" BIGINT NOT NULL,
  "autoCashoutMultiplierBp" INTEGER,
  "maxRounds" INTEGER NOT NULL,
  "roundsPlayed" INTEGER NOT NULL DEFAULT 0,
  "netProfitCents" BIGINT NOT NULL DEFAULT 0,
  "stopLossCents" BIGINT,
  "takeProfitCents" BIGINT,
  "stopReason" TEXT,
  "startsAfterRoundId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3),
  CONSTRAINT "auto_bet_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auto_bet_round_executions" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "betId" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "resultStatus" TEXT,
  "resultDeltaCents" BIGINT,
  "resultAppliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auto_bet_round_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auto_bet_sessions_playerId_createdAt_idx"
ON "auto_bet_sessions" ("playerId", "createdAt");

CREATE INDEX "auto_bet_sessions_status_idx"
ON "auto_bet_sessions" ("status");

CREATE UNIQUE INDEX "AutoBetSession_one_active_per_player"
ON "auto_bet_sessions" ("playerId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "auto_bet_round_executions_sessionId_roundId_key"
ON "auto_bet_round_executions" ("sessionId", "roundId");

CREATE INDEX "auto_bet_round_executions_roundId_idx"
ON "auto_bet_round_executions" ("roundId");

ALTER TABLE "auto_bet_round_executions"
ADD CONSTRAINT "auto_bet_round_executions_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "auto_bet_sessions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
