ALTER TABLE "auto_bet_sessions"
  ADD COLUMN "strategy" TEXT NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "nextAmountCents" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "martingaleMultiplier" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "martingaleMaxSteps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "martingaleCurrentStep" INTEGER NOT NULL DEFAULT 0;

UPDATE "auto_bet_sessions"
SET "nextAmountCents" = "amountCents"
WHERE "nextAmountCents" = 0;
