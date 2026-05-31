import { describe, expect, test } from "bun:test";
import { WalletsController } from "../../src/presentation/controllers/wallets.controller";

describe("WalletsController", () => {
  test("returns health check payload", () => {
    const controller = new WalletsController();

    expect(controller.check()).toEqual({ status: "ok", service: "wallets" });
  });
});
