import { Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { RoundEventsPublisher } from "../../application/ports/round-events.publisher";
import { AdvanceRoundLifecycleUseCase } from "../../application/use-cases/advance-round-lifecycle.use-case";
import type { AdvanceRoundLifecycleResult } from "../../application/use-cases/advance-round-lifecycle.use-case";

export class RoundLifecycleRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundLifecycleRunner.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly advanceRoundLifecycleUseCase: AdvanceRoundLifecycleUseCase,
    private readonly intervalMs: number,
    private readonly roundEventsPublisher: RoundEventsPublisher,
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

      await this.publishRoundEvent(result);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Round lifecycle failed",
      );
    } finally {
      this.running = false;
    }
  }

  private async publishRoundEvent(
    result: AdvanceRoundLifecycleResult,
  ): Promise<void> {
    const round = result.round;

    if (!round) {
      return;
    }

    try {
      if (result.action === "ROUND_OPENED") {
        await this.roundEventsPublisher.publishBettingStarted(round);
        return;
      }

      if (result.action === "ROUND_STARTED") {
        await this.roundEventsPublisher.publishStarted(round);
        return;
      }

      if (result.action === "ROUND_CRASHED") {
        await this.roundEventsPublisher.publishCrashed(round);
        return;
      }

      if (result.action === "ROUND_SETTLED") {
        await this.roundEventsPublisher.publishSettled(round);
        return;
      }

      if (result.action === "NOOP" && round.status === "RUNNING") {
        await this.roundEventsPublisher.publishTick(round);
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Round realtime event publishing failed",
      );
    }
  }
}
