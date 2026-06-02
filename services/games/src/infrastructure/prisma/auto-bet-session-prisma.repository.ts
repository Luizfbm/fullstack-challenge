import { PrismaClient } from "../../../prisma/generated/client";
import type {
  AutoBetRoundExecution,
  AutoBetSession,
} from "../../application/auto-bet/auto-bet-session";
import type {
  ApplyAutoBetResultInput,
  AutoBetSessionRepository,
  NewAutoBetRoundExecution,
  NewAutoBetSession,
  StopAutoBetSessionInput,
} from "../../application/ports/auto-bet-session.repository";
import {
  toAutoBetRoundExecution,
  toAutoBetSession,
} from "./auto-bet-session.mapper";

export class AutoBetSessionPrismaRepository
  implements AutoBetSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: NewAutoBetSession): Promise<AutoBetSession> {
    const session = await this.prisma.autoBetSession.create({
      data: input,
    });

    return toAutoBetSession(session);
  }

  async findActiveByPlayer(playerId: string): Promise<AutoBetSession | null> {
    const session = await this.prisma.autoBetSession.findFirst({
      where: {
        playerId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return session ? toAutoBetSession(session) : null;
  }

  async findLatestByPlayer(playerId: string): Promise<AutoBetSession | null> {
    const session = await this.prisma.autoBetSession.findFirst({
      where: { playerId },
      orderBy: {
        createdAt: "desc",
      },
    });

    return session ? toAutoBetSession(session) : null;
  }

  async listActive(): Promise<AutoBetSession[]> {
    const sessions = await this.prisma.autoBetSession.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return sessions.map(toAutoBetSession);
  }

  async stop(input: StopAutoBetSessionInput): Promise<AutoBetSession> {
    const session = await this.prisma.autoBetSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        status: "STOPPED",
        stopReason: input.reason,
        stoppedAt: new Date(),
      },
    });

    return toAutoBetSession(session);
  }

  async findExecution(
    sessionId: string,
    roundId: string,
  ): Promise<AutoBetRoundExecution | null> {
    const execution = await this.prisma.autoBetRoundExecution.findUnique({
      where: {
        sessionId_roundId: {
          sessionId,
          roundId,
        },
      },
    });

    return execution ? toAutoBetRoundExecution(execution) : null;
  }

  async findExecutionByBetId(
    betId: string,
  ): Promise<AutoBetRoundExecution | null> {
    const execution = await this.prisma.autoBetRoundExecution.findFirst({
      where: {
        betId,
      },
    });

    return execution ? toAutoBetRoundExecution(execution) : null;
  }

  async recordExecution(
    input: NewAutoBetRoundExecution,
  ): Promise<AutoBetRoundExecution> {
    const execution = await this.prisma.autoBetRoundExecution.create({
      data: input,
    });

    return toAutoBetRoundExecution(execution);
  }

  async incrementRoundsPlayed(sessionId: string): Promise<AutoBetSession> {
    const session = await this.prisma.autoBetSession.update({
      where: {
        id: sessionId,
      },
      data: {
        roundsPlayed: {
          increment: 1,
        },
      },
    });

    return toAutoBetSession(session);
  }

  async applyBetResult(
    input: ApplyAutoBetResultInput,
  ): Promise<AutoBetSession | null> {
    return this.prisma.$transaction(async (prisma) => {
      const execution = await prisma.autoBetRoundExecution.findUnique({
        where: {
          id: input.executionId,
        },
      });

      if (!execution || execution.resultAppliedAt !== null) {
        return null;
      }

      const updatedExecution = await prisma.autoBetRoundExecution.updateMany({
        where: {
          id: input.executionId,
          resultAppliedAt: null,
        },
        data: {
          resultStatus: input.resultStatus,
          resultDeltaCents: input.deltaCents,
          resultAppliedAt: new Date(),
        },
      });

      if (updatedExecution.count === 0) {
        return null;
      }

      const session = await prisma.autoBetSession.update({
        where: {
          id: execution.sessionId,
        },
        data: {
          netProfitCents: {
            increment: input.deltaCents,
          },
        },
      });

      return toAutoBetSession(session);
    });
  }
}
