import { describe, expect, test } from "bun:test";
import { GamesController } from "../../src/presentation/controllers/games.controller";

describe("GamesController", () => {
  test("returns health check payload", () => {
    const controller = new GamesController();

    expect(controller.check()).toEqual({ status: "ok", service: "games" });
  });
});
