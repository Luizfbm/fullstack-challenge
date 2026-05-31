import { HOUSE_EDGE_BP } from "../../application/game.constants";
import {
  RoundSeedMaterial,
  RoundSeedProvider,
} from "../../application/ports/round-seed-provider";
import { ProvablyFair } from "../../domain/provably-fair";

type HashChainRoundSeedProviderConfig = {
  rootSeed: string;
  chainLength: number;
  clientSeed: string;
  houseEdgeBp?: number;
};

export class HashChainRoundSeedProvider implements RoundSeedProvider {
  private readonly houseEdgeBp: number;

  constructor(private readonly config: HashChainRoundSeedProviderConfig) {
    if (!config.rootSeed) {
      throw new Error("Hash chain root seed is required");
    }

    if (!Number.isInteger(config.chainLength) || config.chainLength <= 0) {
      throw new Error("Hash chain length must be a positive integer");
    }

    this.houseEdgeBp = config.houseEdgeBp ?? HOUSE_EDGE_BP;
  }

  getRoundSeed(chainIndex: number): RoundSeedMaterial {
    const serverSeed = this.getServerSeed(chainIndex);

    return {
      serverSeed,
      serverSeedHash: ProvablyFair.hashSeed(serverSeed),
      clientSeed: this.config.clientSeed,
      nonce: chainIndex,
      crashPointBp: ProvablyFair.calculateCrashPointBp({
        serverSeed,
        clientSeed: this.config.clientSeed,
        nonce: chainIndex,
        houseEdgeBp: this.houseEdgeBp,
      }),
      nextServerSeedHash: null,
    };
  }

  getServerSeed(chainIndex: number): string {
    this.assertChainIndex(chainIndex);

    let seed = this.config.rootSeed;
    const hashCount = this.config.chainLength - chainIndex;

    for (let index = 0; index < hashCount; index += 1) {
      seed = ProvablyFair.hashSeed(seed);
    }

    return seed;
  }

  private assertChainIndex(chainIndex: number): void {
    if (!Number.isInteger(chainIndex) || chainIndex <= 0) {
      throw new Error("Chain index must be a positive integer");
    }

    if (chainIndex > this.config.chainLength) {
      throw new Error("Hash chain is exhausted");
    }
  }
}
