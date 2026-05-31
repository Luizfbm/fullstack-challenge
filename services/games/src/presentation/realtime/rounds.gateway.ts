import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketServer,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import type { RoundEventsPublisher } from "../../application/ports/round-events.publisher";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { Round } from "../../domain/round";
import {
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

  private emitRoundEvent(event: string, round: Round): void {
    if (!this.namespace) {
      return;
    }

    this.namespace.emit(
      event,
      this.roundRealtimeSerializer.toLifecyclePayload(round),
    );
  }
}
