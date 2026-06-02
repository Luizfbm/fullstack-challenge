import { $ } from "bun";
import { describe, expect, test } from "bun:test";
import {
  cashOut,
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  getAccessToken,
  getWallet,
  placeBet,
  prepareDeterministicRound,
  waitForCurrentStatus,
  withE2ELock,
} from "./e2e-helpers";

const RABBITMQ_MANAGEMENT_URL =
  process.env.E2E_RABBITMQ_MANAGEMENT_URL ?? "http://localhost:15672";

type WalletOutboxRow = {
  amountCents: string;
  id: string;
  referenceId: string;
};

type WalletPersistenceCounts = {
  inboxCount: number;
  transactionCount: number;
};

describe("transactional outbox/inbox E2E", () => {
  test(
    "persists wallet debit outbox and inbox without duplicate ledger processing",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const round = await prepareDeterministicRound("cashout");
        const balanceBefore = await getWallet(token);

        const bet = await placeBet(token, "1000");

        expect(bet.status).toBe("ACCEPTED");
        const balanceAfter = await getWallet(token);
        expect(
          BigInt(balanceBefore.balanceCents) - BigInt(balanceAfter.balanceCents),
        ).toBe(1000n);

        const outbox = await getWalletOutboxRow(round.id, "WALLET_DEBIT");
        await expectWalletPersistenceCounts(outbox.referenceId, {
          inboxCount: 1,
          transactionCount: 1,
        });

        await publishDuplicateWalletCommand({
          messageId: outbox.id,
          pattern: "wallet.debit",
          playerId: bet.playerId,
          amountCents: outbox.amountCents,
          referenceId: outbox.referenceId,
          reason: "BET_PLACED",
        });
        await Bun.sleep(1000);

        await expectWalletPersistenceCounts(outbox.referenceId, {
          inboxCount: 1,
          transactionCount: 1,
        });
      });
    },
    { timeout: 120000 },
  );

  test(
    "persists wallet credit outbox and inbox without duplicate ledger processing",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const round = await prepareDeterministicRound("cashout");

        const bet = await placeBet(token, "1000");
        expect(bet.status).toBe("ACCEPTED");
        await forceBettingRoundToStart(round.id);
        await waitForCurrentStatus("RUNNING");

        const cashedOut = await cashOut(token);

        expect(cashedOut.status).toBe("CASHED_OUT");
        const outbox = await getWalletOutboxRow(round.id, "WALLET_CREDIT");
        await expectWalletPersistenceCounts(outbox.referenceId, {
          inboxCount: 1,
          transactionCount: 1,
        });

        await publishDuplicateWalletCommand({
          messageId: outbox.id,
          pattern: "wallet.credit",
          playerId: bet.playerId,
          amountCents: outbox.amountCents,
          referenceId: outbox.referenceId,
          reason: "CASHOUT_PAYOUT",
        });
        await Bun.sleep(1000);

        await expectWalletPersistenceCounts(outbox.referenceId, {
          inboxCount: 1,
          transactionCount: 1,
        });
      });
    },
    { timeout: 120000 },
  );
});

async function getWalletOutboxRow(
  roundId: string,
  type: "WALLET_CREDIT" | "WALLET_DEBIT",
): Promise<WalletOutboxRow> {
  const result =
    await $`docker compose exec -T postgres psql -U admin -d games -At -F '|' -c ${`
      SELECT id, "referenceId", "amountCents"
      FROM wallet_outbox_messages
      WHERE "roundId" = ${sqlLiteral(roundId)}
        AND "type" = '${type}'
      ORDER BY "createdAt" DESC
      LIMIT 1;
    `}`.text();
  const [id, referenceId, amountCents] = result.trim().split("|");

  if (!id || !referenceId || !amountCents) {
    throw new Error(`Wallet outbox row not found for ${roundId} ${type}`);
  }

  return { amountCents, id, referenceId };
}

async function expectWalletPersistenceCounts(
  referenceId: string,
  expected: WalletPersistenceCounts,
): Promise<void> {
  const counts = await getWalletPersistenceCounts(referenceId);

  expect(counts).toEqual(expected);
}

async function getWalletPersistenceCounts(
  referenceId: string,
): Promise<WalletPersistenceCounts> {
  const result =
    await $`docker compose exec -T postgres psql -U admin -d wallets -At -F '|' -c ${`
      SELECT
        (SELECT COUNT(*) FROM wallet_inbox_messages WHERE "referenceId" = ${sqlLiteral(referenceId)}),
        (SELECT COUNT(*) FROM wallet_transactions WHERE "referenceId" = ${sqlLiteral(referenceId)});
    `}`.text();
  const [inboxCount, transactionCount] = result.trim().split("|");

  return {
    inboxCount: Number(inboxCount),
    transactionCount: Number(transactionCount),
  };
}

async function publishDuplicateWalletCommand(input: {
  amountCents: string;
  messageId: string;
  pattern: "wallet.credit" | "wallet.debit";
  playerId: string;
  reason: "BET_PLACED" | "CASHOUT_PAYOUT";
  referenceId: string;
}): Promise<void> {
  const response = await fetch(
    `${RABBITMQ_MANAGEMENT_URL}/api/exchanges/%2F/amq.default/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa("admin:admin")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          content_type: "application/json",
          delivery_mode: 2,
        },
        routing_key: "wallet.commands",
        payload: JSON.stringify({
          messageId: input.messageId,
          pattern: input.pattern,
          data: {
            playerId: input.playerId,
            amountCents: input.amountCents,
            referenceId: input.referenceId,
            reason: input.reason,
          },
        }),
        payload_encoding: "string",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `RabbitMQ duplicate publish failed with ${response.status}: ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { routed?: boolean };

  if (!body.routed) {
    throw new Error("RabbitMQ duplicate publish was not routed");
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
