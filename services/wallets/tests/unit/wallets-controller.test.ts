import { describe, expect, test } from "bun:test";
import { CreateWalletUseCase } from "../../src/application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "../../src/application/use-cases/get-wallet.use-case";
import { Money } from "../../src/domain/money";
import { Wallet } from "../../src/domain/wallet";
import { WalletsController } from "../../src/presentation/controllers/wallets.controller";

describe("WalletsController", () => {
  test("returns health check payload", () => {
    const controller = new WalletsController(
      undefined as never,
      undefined as never,
    );

    expect(controller.check()).toEqual({ status: "ok", service: "wallets" });
  });

  test("creates wallet for the authenticated user", async () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(100000n),
    });
    const createWalletUseCase = {
      execute: async () => ({ created: true, wallet }),
    } as unknown as CreateWalletUseCase;
    const controller = new WalletsController(
      createWalletUseCase,
      undefined as never,
    );

    const response = await controller.create({
      playerId: "player-1",
      username: "player",
    });

    expect(response).toEqual({
      created: true,
      playerId: "player-1",
      balanceCents: "100000",
    });
  });

  test("returns wallet for the authenticated user", async () => {
    const wallet = Wallet.create({
      id: "wallet-1",
      playerId: "player-1",
      balance: Money.fromCents(99000n),
    });
    const getWalletUseCase = {
      execute: async () => wallet,
    } as unknown as GetWalletUseCase;
    const controller = new WalletsController(
      undefined as never,
      getWalletUseCase,
    );

    const response = await controller.me({
      playerId: "player-1",
      username: "player",
    });

    expect(response).toEqual({
      playerId: "player-1",
      balanceCents: "99000",
    });
  });
});
