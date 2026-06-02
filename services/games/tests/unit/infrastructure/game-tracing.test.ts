import { describe, expect, test } from "bun:test";
import {
  createGameTracingConfig,
  registerGameTracingShutdown,
} from "../../../src/infrastructure/observability/game-tracing";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("game tracing config", () => {
  test("is disabled when no OTLP endpoint is configured", () => {
    expect(createGameTracingConfig({}).enabled).toBe(false);
  });

  test("uses the configured OTLP traces endpoint", () => {
    expect(
      createGameTracingConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318",
        OTEL_SERVICE_NAME: "games",
      }),
    ).toEqual({
      enabled: true,
      serviceName: "games",
      tracesUrl: "http://otel-collector:4318/v1/traces",
    });
  });

  test("exits after tracing shutdown resolves on SIGTERM", async () => {
    let sigtermListener: (() => void) | null = null;
    const exitCodes: Array<number | undefined> = [];
    let resolveShutdown: (() => void) | null = null;
    const shutdown = new Promise<void>((resolve) => {
      resolveShutdown = resolve;
    });

    registerGameTracingShutdown(
      {
        shutdown: () => shutdown,
      },
      {
        on: (_event, listener) => {
          sigtermListener = listener;
        },
        exit: (code) => {
          exitCodes.push(code);
        },
      },
    );

    sigtermListener?.();
    await flushMicrotasks();
    expect(exitCodes).toEqual([]);

    resolveShutdown?.();
    await flushMicrotasks();

    expect(exitCodes).toEqual([0]);
  });

  test("exits on SIGTERM when tracing is disabled", async () => {
    let sigtermListener: (() => void) | null = null;
    const exitCodes: Array<number | undefined> = [];

    registerGameTracingShutdown(null, {
      on: (_event, listener) => {
        sigtermListener = listener;
      },
      exit: (code) => {
        exitCodes.push(code);
      },
    });

    sigtermListener?.();
    await flushMicrotasks();

    expect(exitCodes).toEqual([0]);
  });
});
