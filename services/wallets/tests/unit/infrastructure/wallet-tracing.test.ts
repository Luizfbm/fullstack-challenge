import { describe, expect, test } from "bun:test";
import {
  createWalletTracingConfig,
  registerWalletTracingShutdown,
} from "../../../src/infrastructure/observability/wallet-tracing";

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("wallet tracing config", () => {
  test("is disabled when no OTLP endpoint is configured", () => {
    expect(createWalletTracingConfig({}).enabled).toBe(false);
  });

  test("uses the configured OTLP traces endpoint", () => {
    expect(
      createWalletTracingConfig({
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318",
      }),
    ).toEqual({
      enabled: true,
      serviceName: "wallets",
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

    registerWalletTracingShutdown(
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

    registerWalletTracingShutdown(null, {
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
