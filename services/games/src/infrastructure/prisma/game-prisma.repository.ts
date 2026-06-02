import { PrismaClient } from "../../../prisma/generated/client";
import { rankLeaderboardBets } from "../../application/leaderboard";
import {
  GameRepository,
  LeaderboardEntry,
  ListLeaderboardInput,
} from "../../application/ports/game.repository";
import type {
  NewWalletOutboxMessage,
  WalletOutboxMessage,
} from "../../application/wallet-outbox/wallet-outbox-message";
import { Bet, BetStatus } from "../../domain/bet";
import { Round, RoundStatus } from "../../domain/round";
import {
  toWalletOutboxCreateData,
  toWalletOutboxMessage,
} from "./wallet-outbox.mapper";

type RoundRecord = Awaited<ReturnType<PrismaClient["round"]["findFirst"]>>;
type BetRecord = Awaited<ReturnType<PrismaClient["bet"]["findFirst"]>>;
type GamePrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type RoundWithBets = NonNullable<RoundRecord> & {
  bets: NonNullable<BetRecord>[];
};

export class GamePrismaRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentRound(): Promise<Round | null> {
    const round = await this.prisma.round.findFirst({
      where: {
        status: {
          in: ["BETTING", "RUNNING"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        bets: true,
      },
    });

    return round ? this.toRound(round) : null;
  }

  async findLatestRound(): Promise<Round | null> {
    const round = await this.prisma.round.findFirst({
      orderBy: {
        chainIndex: "desc",
      },
      include: {
        bets: true,
      },
    });

    return round ? this.toRound(round) : null;
  }

  async findRoundById(roundId: string): Promise<Round | null> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        bets: true,
      },
    });

    return round ? this.toRound(round) : null;
  }

  async listRoundHistory(limit: number): Promise<Round[]> {
    const rounds = await this.prisma.round.findMany({
      where: {
        status: {
          in: ["CRASHED", "SETTLED"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        bets: true,
      },
    });

    return rounds.map((round) => this.toRound(round));
  }

  async listBetsByPlayerId(playerId: string, limit: number): Promise<Bet[]> {
    const bets = await this.prisma.bet.findMany({
      where: { playerId },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return bets.map((bet) => this.toBet(bet));
  }

  async listLeaderboard(
    input: ListLeaderboardInput,
  ): Promise<LeaderboardEntry[]> {
    const bets = await this.prisma.bet.findMany({
      where: {
        createdAt: {
          gte: input.since,
        },
        status: {
          in: ["CASHED_OUT", "LOST"],
        },
      },
      orderBy: [{ username: "asc" }, { playerId: "asc" }],
    });

    return rankLeaderboardBets(
      bets.map((bet) => ({
        amountCents: bet.amountCents,
        payoutCents: bet.payoutCents,
        playerId: bet.playerId,
        status: bet.status,
        username: bet.username,
      })),
      input.limit,
    );
  }

  async saveRound(round: Round): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      await this.saveRoundWithTransaction(prisma, round);
    });
  }

  async saveRoundWithWalletOutbox(
    round: Round,
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage> {
    return this.prisma.$transaction(async (prisma) => {
      await this.saveRoundWithTransaction(prisma, round);
      const created = await prisma.walletOutboxMessage.create({
        data: toWalletOutboxCreateData(message),
      });

      return toWalletOutboxMessage(created);
    });
  }

  private async saveRoundWithTransaction(
    prisma: GamePrismaTransaction,
    round: Round,
  ): Promise<void> {
    await prisma.round.upsert({
      where: { id: round.id },
      create: {
        id: round.id,
        ...this.toRoundPersistenceData(round),
      },
      update: this.toRoundPersistenceData(round),
    });

    for (const bet of round.bets) {
      await prisma.bet.upsert({
        where: { id: bet.id },
        create: {
          id: bet.id,
          roundId: bet.roundId,
          ...this.toBetPersistenceData(bet),
        },
        update: this.toBetPersistenceData(bet),
      });
    }
  }

  private toRoundPersistenceData(round: Round) {
    return {
      status: round.status,
      bettingStartsAt: round.bettingStartsAt,
      bettingEndsAt: round.bettingEndsAt,
      startedAt: round.startedAt,
      crashedAt: round.crashedAt,
      crashPointBp: round.crashPointBp,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      chainIndex: round.chainIndex,
      nextServerSeedHash: round.nextServerSeedHash,
    };
  }

  private toBetPersistenceData(bet: Bet) {
    return {
      playerId: bet.playerId,
      username: bet.username,
      amountCents: bet.amountCents,
      status: bet.status,
      autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
      cashoutMultiplierBp: bet.cashoutMultiplierBp,
      payoutCents: bet.payoutCents,
      rejectionReason: bet.rejectionReason,
    };
  }

  private toRound(round: RoundWithBets): Round {
    return Round.restore({
      id: round.id,
      status: round.status as RoundStatus,
      bettingStartsAt: round.bettingStartsAt,
      bettingEndsAt: round.bettingEndsAt,
      startedAt: round.startedAt,
      crashedAt: round.crashedAt,
      crashPointBp: round.crashPointBp,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      chainIndex: round.chainIndex,
      nextServerSeedHash: round.nextServerSeedHash,
      bets: round.bets.map((bet) => this.toBet(bet)),
    });
  }

  private toBet(bet: NonNullable<BetRecord>): Bet {
    return Bet.restore({
      id: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      username: bet.username,
      amountCents: bet.amountCents,
      status: bet.status as BetStatus,
      autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
      cashoutMultiplierBp: bet.cashoutMultiplierBp,
      payoutCents: bet.payoutCents,
      rejectionReason: bet.rejectionReason,
    });
  }

}
