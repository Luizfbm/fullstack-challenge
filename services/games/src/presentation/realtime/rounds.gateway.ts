import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketServer,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import type { RoundEventsPublisher } from "../../application/ports/round-events.publisher";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { Bet } from "../../domain/bet";
import { Round } from "../../domain/round";
import {
  BET_CASHED_OUT_EVENT,
  BET_PLACED_EVENT,
  GAME_REALTIME_NAMESPACE,
  ROUND_BETTING_STARTED_EVENT,
  ROUND_CRASHED_EVENT,
  ROUND_SETTLED_EVENT,
  ROUND_SNAPSHOT_EVENT,
  ROUND_STARTED_EVENT,
  ROUND_TICK_EVENT,
} from "./round-realtime.events";
import { RoundRealtimeSerializer } from "./round-realtime.serializer";

@WebSocketGateway({
  namespace: GAME_REALTIME_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RoundsGateway implements OnGatewayConnection, RoundEventsPublisher {
  private readonly logger = new Logger(RoundsGateway.name);

  @WebSocketServer()
  private namespace!: Namespace;

  constructor(
    private readonly getCurrentRoundUseCase: GetCurrentRoundUseCase,
    private readonly roundRealtimeSerializer: RoundRealtimeSerializer,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const round = await this.getCurrentRoundUseCase.execute();

      client.emit(
        ROUND_SNAPSHOT_EVENT,
        this.roundRealtimeSerializer.toSnapshotPayload(round),
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Failed to emit realtime round snapshot",
      );
      client.emit("round.error", {
        message: "Unable to load current round snapshot",
      });
    }
  }

  async publishBettingStarted(round: Round): Promise<void> {
    this.emitRoundEvent(ROUND_BETTING_STARTED_EVENT, round);
  }

  async publishStarted(round: Round): Promise<void> {
    this.emitRoundEvent(ROUND_STARTED_EVENT, round);
  }

  async publishTick(round: Round): Promise<void> {
    this.emitRoundEvent(ROUND_TICK_EVENT, round);
  }

  async publishCrashed(round: Round): Promise<void> {
    this.emitRoundEvent(ROUND_CRASHED_EVENT, round);
  }

  async publishSettled(round: Round): Promise<void> {
    this.emitRoundEvent(ROUND_SETTLED_EVENT, round);
  }

  async publishBetPlaced(bet: Bet): Promise<void> {
    this.emitBetEvent(BET_PLACED_EVENT, bet);
  }

  async publishBetCashedOut(bet: Bet): Promise<void> {
    this.emitBetEvent(BET_CASHED_OUT_EVENT, bet);
  }

  private emitRoundEvent(event: string, round: Round): void {
    if (!this.namespace) {
      return;
    }

    try {
      this.namespace.emit(
        event,
        this.roundRealtimeSerializer.toLifecyclePayload(round),
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Round realtime event publishing failed",
      );
    }
  }

  private emitBetEvent(event: string, bet: Bet): void {
    if (!this.namespace) {
      return;
    }

    try {
      this.namespace.emit(
        event,
        this.roundRealtimeSerializer.toBetRealtimePayload(bet),
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Bet realtime event publishing failed",
      );
    }
  }
}
