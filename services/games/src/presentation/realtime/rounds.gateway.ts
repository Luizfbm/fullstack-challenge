import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import {
  GAME_REALTIME_NAMESPACE,
  ROUND_SNAPSHOT_EVENT,
} from "./round-realtime.events";
import { RoundRealtimeSerializer } from "./round-realtime.serializer";

@WebSocketGateway({
  namespace: GAME_REALTIME_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RoundsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RoundsGateway.name);

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
}
