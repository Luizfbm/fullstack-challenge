import { HOUSE_EDGE_BP } from "../game.constants";
import { RoundNotFoundError } from "../game.errors";
import { GameRepository } from "../ports/game.repository";
import { ProvablyFair } from "../../domain/provably-fair";
import { RoundStatus } from "../../domain/round";

type VerifyRoundInput = {
  roundId: string;
};

type VerifyRoundResult = {
  roundId: string;
  status: RoundStatus;
  revealed: boolean;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash: string | null;
  algorithm: string;
  houseEdgeBp: number;
  crashPointBp: number | null;
  recalculatedCrashPointBp: number | null;
  serverSeedMatchesCommitment: boolean | null;
  fair: boolean | null;
};

export class VerifyRoundUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: VerifyRoundInput): Promise<VerifyRoundResult> {
    const round = await this.gameRepository.findRoundById(input.roundId);

    if (!round) {
      throw new RoundNotFoundError(input.roundId);
    }

    if (!round.serverSeed) {
      return {
        roundId: round.id,
        status: round.status,
        revealed: false,
        serverSeedHash: round.serverSeedHash,
        serverSeed: null,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        chainIndex: round.chainIndex,
        nextServerSeedHash: round.nextServerSeedHash,
        algorithm: "HMAC_SHA256(serverSeed, clientSeed:nonce)",
        houseEdgeBp: HOUSE_EDGE_BP,
        crashPointBp: null,
        recalculatedCrashPointBp: null,
        serverSeedMatchesCommitment: null,
        fair: null,
      };
    }

    const serverSeedMatchesCommitment = ProvablyFair.verifySeed(
      round.serverSeed,
      round.serverSeedHash,
    );
    const recalculatedCrashPointBp = ProvablyFair.calculateCrashPointBp({
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      houseEdgeBp: HOUSE_EDGE_BP,
    });

    return {
      roundId: round.id,
      status: round.status,
      revealed: true,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      chainIndex: round.chainIndex,
      nextServerSeedHash: round.nextServerSeedHash,
      algorithm: "HMAC_SHA256(serverSeed, clientSeed:nonce)",
      houseEdgeBp: HOUSE_EDGE_BP,
      crashPointBp: round.crashPointBp,
      recalculatedCrashPointBp,
      serverSeedMatchesCommitment,
      fair:
        serverSeedMatchesCommitment &&
        recalculatedCrashPointBp === round.crashPointBp,
    };
  }
}
