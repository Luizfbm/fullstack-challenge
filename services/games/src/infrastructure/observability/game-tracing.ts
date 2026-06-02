import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

type Env = Record<string, string | undefined>;

export type ShutdownTarget = {
  shutdown: () => Promise<unknown> | unknown;
} | null;

type ProcessLike = {
  on: (event: "SIGTERM", listener: () => void) => unknown;
  exit: (code?: number) => never | void;
};

export type TracingConfig = {
  enabled: boolean;
  serviceName: string;
  tracesUrl: string;
};

export function createGameTracingConfig(env: Env): TracingConfig {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;

  return {
    enabled: Boolean(endpoint),
    serviceName: env.OTEL_SERVICE_NAME ?? "games",
    tracesUrl: `${endpoint?.replace(/\/$/, "") ?? ""}/v1/traces`,
  };
}

export function startGameTracing(env: Env = process.env): NodeSDK | null {
  const config = createGameTracingConfig(env);

  if (!config.enabled) {
    return null;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: config.tracesUrl,
    }),
  });

  sdk.start();
  return sdk;
}

export function registerGameTracingShutdown(
  sdk: ShutdownTarget,
  processLike: ProcessLike = process,
): void {
  processLike.on("SIGTERM", () => {
    void Promise.resolve(sdk?.shutdown()).finally(() => processLike.exit(0));
  });
}
