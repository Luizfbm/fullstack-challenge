import { Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AdvanceRoundLifecycleUseCase } from "../../application/use-cases/advance-round-lifecycle.use-case";

export class RoundLifecycleRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundLifecycleRunner.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly advanceRoundLifecycleUseCase: AdvanceRoundLifecycleUseCase,
    private readonly intervalMs: number,
  ) {
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new Error("Round lifecycle interval must be a positive integer");
    }
  }

  async onModuleInit(): Promise<void> {
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const result = await this.advanceRoundLifecycleUseCase.execute();

      if (result.action !== "NOOP") {
        this.logger.log(`${result.action}: ${result.round?.id ?? "none"}`);
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Round lifecycle failed",
      );
    } finally {
      this.running = false;
    }
  }
}
