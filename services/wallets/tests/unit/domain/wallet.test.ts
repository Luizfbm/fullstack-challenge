import { describe, expect, test } from "bun:test";
import { InsufficientFundsError } from "../../../src/domain/wallet.errors";
import { Money } from "../../../src/domain/money";
import { Wallet } from "../../../src/domain/wallet";

describe("Money", () => {
  test("stores cents as bigint", () => {
    const money = Money.fromCents(1000n);

    expect(money.cents).toBe(1000n);
  });

  test("rejects floating point numbers", () => {
    expect(() => Money.fromCents(10.5)).toThrow("Money cents must be an integer");
  });

  test("rejects negative cents", () => {
    expect(() => Money.fromCents(-1n)).toThrow("Money cents cannot be negative");
  });
});

describe("Wallet", () => {
  test("credits money and records a transaction", () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.zero(),
    });

    const transaction = wallet.credit({
      amount: Money.fromCents(100000n),
      referenceId: "seed:player-1",
      reason: "INITIAL_GRANT",
    });

    expect(wallet.balance.cents).toBe(100000n);
    expect(transaction?.type).toBe("CREDIT");
    expect(transaction?.amount.cents).toBe(100000n);
    expect(transaction?.referenceId).toBe("seed:player-1");
  });

  test("debits money when the balance is sufficient", () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(100000n),
    });

    const transaction = wallet.debit({
      amount: Money.fromCents(2500n),
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    expect(wallet.balance.cents).toBe(97500n);
    expect(transaction?.type).toBe("DEBIT");
    expect(transaction?.amount.cents).toBe(2500n);
  });

  test("rejects debit when the balance is insufficient", () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(100n),
    });

    expect(() =>
      wallet.debit({
        amount: Money.fromCents(101n),
        referenceId: "bet:bet-1:debit",
        reason: "BET_PLACED",
      }),
    ).toThrow(InsufficientFundsError);

    expect(wallet.balance.cents).toBe(100n);
  });

  test("does not apply the same reference twice", () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(100000n),
    });

    const first = wallet.debit({
      amount: Money.fromCents(1000n),
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    const duplicate = wallet.debit({
      amount: Money.fromCents(1000n),
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
    expect(wallet.balance.cents).toBe(99000n);
  });

  test("reports whether a debit can be applied", () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(500n),
    });

    expect(wallet.canDebit(Money.fromCents(500n))).toBe(true);
    expect(wallet.canDebit(Money.fromCents(501n))).toBe(false);
  });
});
